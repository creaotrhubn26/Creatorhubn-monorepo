#!/usr/bin/env python3
"""
Faster-Whisper Microservice
On-premise Whisper transcription service using faster-whisper
Provides REST API compatible with OpenAI Whisper API format
"""

from faster_whisper import WhisperModel
from flask import Flask, request, jsonify
import os
import tempfile
import logging

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

# Initialize faster-whisper model
MODEL_SIZE = os.getenv('WHISPER_MODEL_SIZE', 'base')
DEVICE = os.getenv('WHISPER_DEVICE', 'cpu')
COMPUTE_TYPE = os.getenv('WHISPER_COMPUTE_TYPE', 'int8')

logging.info(f"Loading faster-whisper model: {MODEL_SIZE} on {DEVICE} with {COMPUTE_TYPE}")
model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
logging.info("Model loaded successfully!")

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'model': MODEL_SIZE, 'device': DEVICE})

@app.route('/v1/audio/transcriptions', methods=['POST'])
def transcribe():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        audio_file = request.files['file']
        language = request.form.get('language', None)
        response_format = request.form.get('response_format', 'json')
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(audio_file.filename)[1]) as tmp_file:
            audio_file.save(tmp_file.name)
            tmp_path = tmp_file.name
        
        logging.info(f"Transcribing file: {audio_file.filename}")
        
        segments, info = model.transcribe(
            tmp_path,
            language=language,
            beam_size=5,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500)
        )
        
        segments_list = list(segments)
        
        if response_format == 'verbose_json':
            response = {
                'text': ' '.join([segment.text for segment in segments_list]),
                'language': info.language,
                'duration': info.duration,
                'segments': [
                    {
                        'id': i,
                        'seek': int(segment.start * 100),
                        'start': segment.start,
                        'end': segment.end,
                        'text': segment.text,
                        'tokens': [],
                        'temperature': 0.0,
                        'avg_logprob': segment.avg_logprob if hasattr(segment, 'avg_logprob') else 0.0,
                        'compression_ratio': segment.compression_ratio if hasattr(segment, 'compression_ratio') else 0.0,
                        'no_speech_prob': segment.no_speech_prob if hasattr(segment, 'no_speech_prob') else 0.0,
                    }
                    for i, segment in enumerate(segments_list)
                ]
            }
        else:
            response = {'text': ' '.join([segment.text for segment in segments_list])}
        
        os.unlink(tmp_path)
        logging.info(f"Transcription complete: {len(segments_list)} segments")
        return jsonify(response)
        
    except Exception as e:
        logging.error(f"Transcription error: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
