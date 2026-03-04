#!/usr/bin/env python3
"""
StoryArc Demucs + Wiener speech denoise helper.

Pipeline:
1) Optional Demucs vocal separation (when demucs is installed)
2) Resample (default 48 kHz)
3) Pre-emphasis
4) Wiener post-filter (STFT mask)
5) De-emphasis
6) Peak limiter
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

import torch
import torchaudio


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Demucs-assisted denoise')
    parser.add_argument('--input', required=True, help='Input audio path')
    parser.add_argument('--output', required=True, help='Output audio path')
    parser.add_argument('--model', default='htdemucs', help='Demucs model name')
    parser.add_argument('--device', default='auto', help='auto|cpu|cuda')
    parser.add_argument('--target-sr', type=int, default=48_000, help='Output sample rate')
    parser.add_argument('--alpha', type=float, default=0.97, help='Pre/de-emphasis alpha')
    parser.add_argument('--wiener-floor', type=float, default=0.05, help='Minimum Wiener gain')
    parser.add_argument('--noise-quantile', type=float, default=0.2, help='Low-energy frame quantile used as noise profile')
    parser.add_argument('--disable-demucs', action='store_true', help='Skip Demucs and run Wiener-only denoise')
    return parser.parse_args()


def resolve_device(raw: str) -> str:
    normalized = (raw or 'auto').strip().lower()
    if normalized in {'cpu', 'cuda', 'auto'}:
        return normalized
    return 'auto'


def choose_torch_device(mode: str) -> torch.device:
    if mode == 'cuda' and torch.cuda.is_available():
        return torch.device('cuda')
    if mode == 'auto' and torch.cuda.is_available():
        return torch.device('cuda')
    return torch.device('cpu')


def load_audio(path: str, target_sr: int, device: torch.device) -> tuple[torch.Tensor, int, int]:
    waveform, input_sr = torchaudio.load(path)
    if waveform.numel() == 0:
        raise RuntimeError('Input audio is empty')
    waveform = waveform.to(device)
    if input_sr != target_sr:
        resampler = torchaudio.transforms.Resample(orig_freq=input_sr, new_freq=target_sr).to(device)
        waveform = resampler(waveform)
    return waveform, input_sr, target_sr


def pre_emphasis(waveform: torch.Tensor, alpha: float) -> torch.Tensor:
    if alpha <= 0:
        return waveform
    alpha = float(max(0.0, min(0.999, alpha)))
    a_coeffs = torch.tensor([1.0, 0.0], dtype=waveform.dtype, device=waveform.device)
    b_coeffs = torch.tensor([1.0, -alpha], dtype=waveform.dtype, device=waveform.device)
    return torchaudio.functional.lfilter(
        waveform,
        a_coeffs=a_coeffs,
        b_coeffs=b_coeffs,
        clamp=False,
        batching=True,
    )


def de_emphasis(waveform: torch.Tensor, alpha: float) -> torch.Tensor:
    if alpha <= 0:
        return waveform
    alpha = float(max(0.0, min(0.999, alpha)))
    a_coeffs = torch.tensor([1.0, -alpha], dtype=waveform.dtype, device=waveform.device)
    b_coeffs = torch.tensor([1.0, 0.0], dtype=waveform.dtype, device=waveform.device)
    return torchaudio.functional.lfilter(
        waveform,
        a_coeffs=a_coeffs,
        b_coeffs=b_coeffs,
        clamp=False,
        batching=True,
    )


def frame_rms_energy(waveform_mono: torch.Tensor, frame: int, hop: int) -> torch.Tensor:
    if waveform_mono.numel() < frame:
        padded = torch.nn.functional.pad(waveform_mono, (0, max(0, frame - waveform_mono.numel())))
        return torch.sqrt(torch.mean(padded * padded, dim=0, keepdim=True))

    energies = []
    start = 0
    end = waveform_mono.shape[0] - frame
    while start <= end:
        segment = waveform_mono[start:start + frame]
        energies.append(torch.sqrt(torch.mean(segment * segment) + 1e-12))
        start += hop
    if not energies:
        energies.append(torch.sqrt(torch.mean(waveform_mono * waveform_mono) + 1e-12))
    return torch.stack(energies)


def estimate_vad_ratio(waveform: torch.Tensor, sample_rate: int) -> float:
    mono = torch.mean(waveform, dim=0)
    frame = max(1, int(sample_rate * 0.03))
    hop = max(1, int(sample_rate * 0.01))
    energies = frame_rms_energy(mono, frame, hop)
    if energies.numel() == 0:
        return 0.0
    threshold = torch.quantile(energies, 0.65) * 0.7
    voiced = (energies > threshold).float().mean().item()
    return float(max(0.0, min(1.0, voiced)))


def wiener_denoise(
    waveform: torch.Tensor,
    wiener_floor: float,
    noise_quantile: float,
    n_fft: int = 1024,
    hop_length: int = 256,
) -> torch.Tensor:
    floor = float(max(0.001, min(0.8, wiener_floor)))
    quantile = float(max(0.05, min(0.45, noise_quantile)))

    device = waveform.device
    window = torch.hann_window(n_fft, device=device)
    output = torch.zeros_like(waveform)
    eps = 1e-9

    for ch in range(waveform.shape[0]):
        x = waveform[ch]
        spec = torch.stft(
            x,
            n_fft=n_fft,
            hop_length=hop_length,
            win_length=n_fft,
            window=window,
            return_complex=True,
        )
        power = spec.abs().pow(2)
        frame_energy = power.mean(dim=0)
        noise_threshold = torch.quantile(frame_energy, quantile)
        noise_mask = frame_energy <= noise_threshold
        if int(noise_mask.sum().item()) < 2:
            noise_mask = frame_energy <= torch.mean(frame_energy)
        noise_psd = power[:, noise_mask].mean(dim=1, keepdim=True)
        snr = power / (noise_psd + eps)
        gain = snr / (snr + 1.0)
        gain = torch.clamp(gain, min=floor, max=1.0)
        filtered = spec * gain
        reconstructed = torch.istft(
            filtered,
            n_fft=n_fft,
            hop_length=hop_length,
            win_length=n_fft,
            window=window,
            length=x.shape[0],
        )
        output[ch] = reconstructed

    return output


def run_demucs_cli(input_path: str, model: str, device_mode: str, work_dir: str) -> tuple[bool, str | None, str | None]:
    if importlib.util.find_spec('demucs') is None:
        return False, None, 'demucs package not installed'

    demucs_output_root = Path(work_dir) / 'demucs-out'
    demucs_output_root.mkdir(parents=True, exist_ok=True)

    cmd = [sys.executable, '-m', 'demucs.separate', '-n', model, '--two-stems', 'vocals', '-o', str(demucs_output_root), input_path]
    if device_mode in {'cpu', 'cuda'}:
        cmd += ['-d', device_mode]

    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        stderr = (proc.stderr or '').strip()
        stdout = (proc.stdout or '').strip()
        detail = stderr if stderr else stdout
        return False, None, f'demucs.separate failed ({detail[:400]})'

    input_stem = Path(input_path).stem
    expected = demucs_output_root / model / input_stem / 'vocals.wav'
    if expected.exists():
        return True, str(expected), None

    matches = list(demucs_output_root.glob('**/vocals.wav'))
    if matches:
        return True, str(matches[0]), None

    return False, None, 'demucs output vocals.wav not found'


def main() -> int:
    args = parse_args()

    input_path = os.path.abspath(args.input)
    output_path = os.path.abspath(args.output)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    if not os.path.exists(input_path):
        print(json.dumps({'error': f'Input not found: {input_path}'}), file=sys.stderr)
        return 1

    device_mode = resolve_device(args.device)
    torch_device = choose_torch_device(device_mode)

    demucs_used = False
    demucs_warning = None
    source_path = input_path

    with tempfile.TemporaryDirectory(prefix='storyarc-demucs-') as tmp_dir:
        if not args.disable_demucs:
            success, vocals_path, warning = run_demucs_cli(input_path, args.model, device_mode, tmp_dir)
            if success and vocals_path:
                source_path = vocals_path
                demucs_used = True
            elif warning:
                demucs_warning = warning

        waveform, input_sr, output_sr = load_audio(source_path, int(args.target_sr), torch_device)
        vad_ratio = estimate_vad_ratio(waveform, output_sr)

        alpha = float(max(0.0, min(0.999, args.alpha)))
        wiener_floor = float(max(0.001, min(0.8, args.wiener_floor)))
        noise_quantile = float(max(0.05, min(0.45, args.noise_quantile)))

        emphasized = pre_emphasis(waveform, alpha)
        denoised = wiener_denoise(emphasized, wiener_floor=wiener_floor, noise_quantile=noise_quantile)
        restored = de_emphasis(denoised, alpha)

        peak = torch.max(torch.abs(restored)).item()
        limiter_gain = 1.0
        if peak > 0.99:
            limiter_gain = 0.99 / peak
            restored = restored * limiter_gain

        restored = torch.clamp(restored, -0.999, 0.999)
        torchaudio.save(output_path, restored.detach().cpu(), output_sr)

        result: dict[str, Any] = {
            'ok': True,
            'input_path': input_path,
            'source_path': source_path,
            'output_path': output_path,
            'demucs_used': demucs_used,
            'demucs_model': args.model,
            'demucs_device_mode': device_mode,
            'demucs_warning': demucs_warning,
            'target_sample_rate': output_sr,
            'input_sample_rate': input_sr,
            'device': str(torch_device),
            'pre_emphasis_alpha': alpha,
            'wiener_floor': wiener_floor,
            'noise_quantile': noise_quantile,
            'vad_ratio': vad_ratio,
            'limiter_gain': limiter_gain,
        }
        print(json.dumps(result))
        return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception as error:
        print(json.dumps({'ok': False, 'error': str(error)}), file=sys.stderr)
        raise SystemExit(1)
