#!/usr/bin/env python3
"""
Pyannote Speaker Diarization Microservice
Advanced speaker diarization using pyannote.audio (95%+ accuracy)
"""

from pyannote.audio import Pipeline
from flask import Flask, request, jsonify
import os
import tempfile
import logging

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

# Initialize pyannote pipeline
# Requires HuggingFace token: https://huggingface.co/pyannote/speaker-diarization
HF_TOKEN = os.getenv('HUGGINGFACE_TOKEN')

if not HF_TOKEN:
    logging.warning("HUGGINGFACE_TOKEN not set - pyannote will not work!")
    pipeline = None
else:
    logging.info("Loading pyannote speaker diarization pipeline...")
    pipeline = Pipeline.from_pretrained(
        "pyannote/speaker-diarization-3.1",
        use_auth_token=HF_TOKEN
    )
    logging.info("Pipeline loaded successfully!")

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy' if pipeline else 'no_token',
        'model': 'pyannote/speaker-diarization-3.1'
    })

@app.route('/v1/audio/diarization', methods=['POST'])
def diarize():
    """
    Perform speaker diarization on audio file
    Returns speaker segments with timestamps
    """
    try:
        if not pipeline:
            return jsonify({'error': 'HUGGINGFACE_TOKEN not configured'}), 500
        
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        audio_file = request.files['file']
        min_speakers = request.form.get('min_speakers', None)
        max_speakers = request.form.get('max_speakers', None)
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(audio_file.filename)[1]) as tmp_file:
            audio_file.save(tmp_file.name)
            tmp_path = tmp_file.name
        
        logging.info(f"Diarizing file: {audio_file.filename}")
        
        # Run diarization
        diarization_params = {}
        if min_speakers:
            diarization_params['min_speakers'] = int(min_speakers)
        if max_speakers:
            diarization_params['max_speakers'] = int(max_speakers)
        
        diarization = pipeline(tmp_path, **diarization_params)
        
        # Convert to JSON format
        segments = []
        speakers = set()
        
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            segments.append({
                'start': turn.start,
                'end': turn.end,
                'speaker': speaker,
                'duration': turn.end - turn.start
            })
            speakers.add(speaker)
        
        response = {
            'num_speakers': len(speakers),
            'speakers': sorted(list(speakers)),
            'segments': segments,
            'total_duration': max([s['end'] for s in segments]) if segments else 0
        }
        
        # Cleanup
        os.unlink(tmp_path)
        
        logging.info(f"Diarization complete: {len(speakers)} speakers, {len(segments)} segments")
        return jsonify(response)
        
    except Exception as e:
        logging.error(f"Diarization error: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)
