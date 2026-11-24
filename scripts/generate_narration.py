#!/usr/bin/env python3
"""Generate the approved Arabic voice track with Edge TTS word-boundary metadata."""
from __future__ import annotations
import argparse
import asyncio
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

import edge_tts

ROOT = Path(__file__).resolve().parents[1]
TIMELINE = ROOT / 'src' / 'data' / 'timeline.json'
VOICE = 'ar-SA-HamedNeural'
RATE = '-6%'
FPS = 30
TOTAL_FRAMES = 670
TOTAL_SECONDS = TOTAL_FRAMES / FPS

SEGMENTS = [
    {'id':'scene-01', 'startFrame':0, 'endFrame':105, 'text':'العباءة إنما جعلت للستر ولم تجعل للزينة،'},
    {'id':'scene-02', 'startFrame':120, 'endFrame':204, 'text':'لا يكون فيها زركشة ولا فيها تطريز،'},
    {'id':'scene-03', 'startFrame':210, 'endFrame':294, 'text':'وإنما تكون سادة لا تلفت النظر،'},
    {'id':'scene-04', 'startFrame':300, 'endFrame':474, 'text':'وتكون أيضاً ضافية، تكون ساترة وتكون فضفاضة وواسعة،'},
    {'id':'scene-05', 'startFrame':480, 'endFrame':555, 'text':'ليست عباءة شفافة'},
    {'id':'scene-06', 'startFrame':570, 'endFrame':670, 'text':'واسمها عباءة وهي لا تستر، هذا تلاعب.'},
]


def require_binary(name: str) -> str:
    path = shutil.which(name)
    if not path:
        raise RuntimeError(f'Required executable not found in PATH: {name}')
    return path


def run(cmd: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, check=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def probe_duration(ffprobe: str, path: Path) -> float:
    result = run([ffprobe, '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', str(path)])
    return float(result.stdout.strip())


async def synthesize_segment(text: str, voice: str, rate: str, mp3_path: Path) -> list[dict[str, Any]]:
    communicate = edge_tts.Communicate(text, voice=voice, rate=rate, boundary='WordBoundary')
    audio = bytearray()
    boundaries: list[dict[str, Any]] = []
    async for chunk in communicate.stream():
        kind = chunk.get('type')
        if kind == 'audio':
            audio.extend(chunk.get('data', b''))
        elif kind == 'WordBoundary':
            boundaries.append({
                'text': str(chunk.get('text', '')).strip(),
                'offsetTicks': int(chunk.get('offset', 0)),
                'durationTicks': int(chunk.get('duration', 0)),
            })
    if not audio:
        raise RuntimeError(f'Edge TTS returned no audio for segment: {text}')
    if not boundaries:
        raise RuntimeError('Edge TTS returned no WordBoundary data; cannot claim word-level synchronization.')
    mp3_path.write_bytes(audio)
    return boundaries


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--voice', default=VOICE)
    parser.add_argument('--rate', default=RATE)
    args = parser.parse_args()
    ffmpeg, ffprobe = require_binary('ffmpeg'), require_binary('ffprobe')

    data = json.loads(TIMELINE.read_text(encoding='utf-8'))
    expected_text = data.get('narrationText', '')
    segments = SEGMENTS
    generated_words: list[dict[str, Any]] = []
    full_text = ' '.join(s['text'] for s in segments)
    if expected_text and full_text.replace('،', '،').strip() != expected_text.strip():
        raise RuntimeError('Narration segment text no longer matches timeline.narrationText.')

    audio_dir = ROOT / 'public' / 'audio'
    audio_dir.mkdir(parents=True, exist_ok=True)
    wav_out = audio_dir / 'narration.wav'
    timing_path = audio_dir / 'narration-word-timings.json'
    narration_text_path = audio_dir / 'narration.txt'
    narration_text_path.write_text(expected_text or full_text, encoding='utf-8')

    with tempfile.TemporaryDirectory(prefix='edge-tts-abaya-') as td:
        temp = Path(td)
        segment_wavs: list[Path] = []
        ffmpeg_inputs: list[tuple[Path, int]] = []
        reports: list[dict[str, Any]] = []
        for n, segment in enumerate(segments, start=1):
            mp3_path = temp / f'segment-{n:02d}.mp3'
            raw_boundaries = asyncio.run(synthesize_segment(segment['text'], args.voice, args.rate, mp3_path))
            raw_duration = probe_duration(ffprobe, mp3_path)
            slot_seconds = (segment['endFrame'] - segment['startFrame']) / FPS
            tempo = max(1.0, raw_duration / slot_seconds)
            if tempo > 2.0:
                raise RuntimeError(f'TTS segment {segment["id"]} is too long for its scene even at 2x speed ({raw_duration:.2f}s for {slot_seconds:.2f}s).')
            wav_path = temp / f'segment-{n:02d}.wav'
            filters = []
            if tempo > 1.001:
                filters.append(f'atempo={tempo:.6f}')
            filters.extend(['aresample=48000', 'aformat=sample_fmts=s16:channel_layouts=stereo'])
            run([ffmpeg, '-y', '-hide_banner', '-loglevel', 'error', '-i', str(mp3_path),
                 '-af', ','.join(filters), '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', str(wav_path)])
            actual_wav_duration = probe_duration(ffprobe, wav_path)
            if actual_wav_duration > slot_seconds + 0.03:
                raise RuntimeError(f'Processed speech segment {segment["id"]} exceeds scene slot ({actual_wav_duration:.3f}s > {slot_seconds:.3f}s).')
            segment_wavs.append(wav_path)
            ffmpeg_inputs.append((wav_path, round(segment['startFrame'] * 1000 / FPS)))
            word_start = len(generated_words)
            for b in raw_boundaries:
                offset_s = (b['offsetTicks'] / 10_000_000) / tempo
                duration_s = (b['durationTicks'] / 10_000_000) / tempo
                global_start = segment['startFrame'] / FPS + offset_s
                global_end = min(segment['endFrame'] / FPS, global_start + max(duration_s, 0.035))
                if global_start >= segment['endFrame'] / FPS:
                    continue
                start_frame = max(segment['startFrame'], min(segment['endFrame'] - 1, round(global_start * FPS)))
                end_frame = max(start_frame + 1, min(segment['endFrame'], round(global_end * FPS)))
                generated_words.append({
                    'index': len(generated_words) + 1,
                    'text': b['text'],
                    'segmentId': segment['id'],
                    'startSeconds': round(global_start, 4),
                    'endSeconds': round(global_end, 4),
                    'startFrame': start_frame,
                    'endFrame': end_frame,
                })
            reports.append({
                'id': segment['id'], 'text': segment['text'],
                'startFrame': segment['startFrame'], 'endFrame': segment['endFrame'],
                'rawTtsDurationSeconds': round(raw_duration, 4),
                'renderedSpeechDurationSeconds': round(actual_wav_duration, 4),
                'tempoFactor': round(tempo, 5), 'wordCount': len(generated_words) - word_start,
            })

        # Silence canvas keeps exactly 670 frames; each speech segment begins at its planned scene boundary.
        cmd = [ffmpeg, '-y', '-hide_banner', '-loglevel', 'error',
               '-f', 'lavfi', '-i', f'anullsrc=r=48000:cl=stereo:d={TOTAL_SECONDS:.9f}']
        for wav_path, _ in ffmpeg_inputs:
            cmd.extend(['-i', str(wav_path)])
        filters = ['[0:a]anull[silence]']
        labels = ['[silence]']
        for idx, (_, delay_ms) in enumerate(ffmpeg_inputs, start=1):
            label = f'seg{idx}'
            filters.append(f'[{idx}:a]adelay={delay_ms}|{delay_ms},atrim=duration={TOTAL_SECONDS:.9f}[{label}]')
            labels.append(f'[{label}]')
        filters.append(''.join(labels) + f'amix=inputs={len(labels)}:duration=first:normalize=0,alimiter=limit=0.97,atrim=duration={TOTAL_SECONDS:.9f}[aout]')
        cmd.extend(['-filter_complex', ';'.join(filters), '-map', '[aout]', '-ar', '48000', '-ac', '2',
                    '-c:a', 'pcm_s16le', '-t', f'{TOTAL_SECONDS:.9f}', str(wav_out)])
        run(cmd)

    actual_duration = probe_duration(ffprobe, wav_out)
    if abs(actual_duration - TOTAL_SECONDS) > 0.01:
        raise RuntimeError(f'Generated WAV duration {actual_duration:.6f}s differs from target {TOTAL_SECONDS:.6f}s.')
    if not generated_words:
        raise RuntimeError('No word-level timestamps were generated.')

    data['wordTimings'] = generated_words
    data.setdefault('audio', {}).setdefault('narration', {})['voice'] = args.voice
    data['audio']['narration']['rate'] = args.rate
    data['audio']['narration']['timingSource'] = 'Edge TTS WordBoundary metadata; offsets converted from 100-ns ticks'
    data['audio']['narration']['actualDurationSeconds'] = round(actual_duration, 6)
    data['audio']['narration']['wordCount'] = len(generated_words)
    data['audio']['narration']['segments'] = reports
    TIMELINE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    timing_path.write_text(json.dumps({'voice':args.voice,'rate':args.rate,'fps':FPS,
                                       'durationFrames':TOTAL_FRAMES,'durationSeconds':actual_duration,
                                       'words':generated_words}, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    report_path = ROOT / 'out' / 'narration-report.json'
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps({'voice':args.voice,'rate':args.rate,'durationSeconds':actual_duration,
                                       'wordCount':len(generated_words),'segments':reports},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'EDGE TTS: PASS — voice={args.voice}, duration={actual_duration:.3f}s, words={len(generated_words)}')
    print(f'WAV: {wav_out}')
    print(f'Word timings: {timing_path}')
    return 0

if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f'ERROR: {exc}', file=sys.stderr)
        raise SystemExit(1)
