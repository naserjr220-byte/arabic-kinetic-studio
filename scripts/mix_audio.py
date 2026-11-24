#!/usr/bin/env python3
"""Mix narration with frame-accurate SFX, targeting 15%-25% of narration loudness."""
from __future__ import annotations

import argparse
import json
import math
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]


def run(cmd: list[str], *, capture: bool = False) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, check=True, text=True, stdout=subprocess.PIPE if capture else None,
                          stderr=subprocess.PIPE if capture else None)


def require_binary(name: str) -> str:
    path = shutil.which(name)
    if not path:
        raise RuntimeError(f"Required executable not found in PATH: {name}")
    return path


def public_path(relative: str) -> Path:
    rel = relative.lstrip("/\\")
    if rel.startswith("public/"):
        rel = rel[len("public/"):]
    return ROOT / "public" / rel


def mean_volume_db(path: Path, ffmpeg: str) -> float:
    result = subprocess.run(
        [ffmpeg, "-hide_banner", "-i", str(path), "-af", "volumedetect", "-f", "null", "-"],
        text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    match = re.search(r"mean_volume:\s*(-?inf|-?[0-9.]+)\s*dB", result.stderr, re.IGNORECASE)
    if not match:
        raise RuntimeError(f"Could not read mean volume from {path}. FFmpeg output:\n{result.stderr[-1200:]}")
    value = match.group(1).lower()
    return -120.0 if value == "-inf" else float(value)


def collect_events(timeline: dict[str, Any], default_gain: float) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    fps = int(timeline["project"]["fps"])
    sfx_assets = timeline.get("assets", {}).get("sfx", {})
    for scene in timeline.get("scenes", []):
        for item in scene.get("sfxEvents", []):
            name = item.get("name", "pop")
            src = item.get("src") or sfx_assets.get(name)
            if src:
                events.append({"id": item.get("id", f"sfx-{len(events)+1}"), "src": src,
                               "frame": int(item.get("atFrame", 0)), "gain": float(item.get("volume", default_gain))})
        for item in scene.get("stickerEvents", []):
            name = item.get("sfxName")
            src = sfx_assets.get(name) if name else None
            if src:
                events.append({"id": f"{item.get('id', 'sticker')}-sfx", "src": src,
                               "frame": int(item.get("startFrame", scene.get("startFrame", 0))),
                               "gain": float(item.get("sfxVolume", default_gain))})
    events.sort(key=lambda item: (item["frame"], item["id"]))
    for event in events:
        event["seconds"] = event["frame"] / fps
    return events


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--timeline", default="src/data/timeline.json")
    parser.add_argument("--output", default=None, help="Output WAV path relative to project root")
    args = parser.parse_args()

    ffmpeg = require_binary("ffmpeg")
    timeline_path = (ROOT / args.timeline).resolve()
    timeline = json.loads(timeline_path.read_text(encoding="utf-8"))
    narration_rel = timeline["audio"]["narration"]["src"]
    narration = public_path(narration_rel)
    if not narration.is_file():
        raise FileNotFoundError(f"Narration file not found: {narration}\nPlace the source recording at public/{narration_rel}")

    duration = float(timeline["project"]["durationSeconds"])
    fps = int(timeline["project"]["fps"])
    mix_cfg = timeline.get("audio", {}).get("sfxMix", {})
    target = float(mix_cfg.get("targetGain", 0.20))
    allowed = mix_cfg.get("allowedRange", [0.15, 0.25])
    low, high = float(allowed[0]), float(allowed[1])
    if not (0 < low <= high <= 1):
        raise ValueError(f"Invalid sfxMix.allowedRange: {allowed}")
    narration_mean = mean_volume_db(narration, ffmpeg)
    events = collect_events(timeline, target)

    output_rel = args.output or timeline.get("audio", {}).get("renderedMixSrc", "audio/mixed_narration.wav")
    output = public_path(output_rel)
    output.parent.mkdir(parents=True, exist_ok=True)

    cmd = [ffmpeg, "-y", "-hide_banner", "-i", str(narration)]
    input_events: list[dict[str, Any]] = []
    for event in events:
        sfx_path = public_path(event["src"])
        if not sfx_path.is_file():
            raise FileNotFoundError(f"SFX file not found for event {event['id']}: {sfx_path}")
        gain = max(low, min(high, event["gain"]))
        sfx_mean = mean_volume_db(sfx_path, ffmpeg)
        target_db = narration_mean + 20.0 * math.log10(gain)
        gain_db = max(-60.0, min(24.0, target_db - sfx_mean))
        event.update({"path": sfx_path, "gain": gain, "gainDb": gain_db, "meanDb": sfx_mean})
        cmd.extend(["-i", str(sfx_path)])
        input_events.append(event)

    filters = [f"[0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad,atrim=duration={duration:.6f}[narr]"]
    mix_labels = ["[narr]"]
    for index, event in enumerate(input_events, start=1):
        delay_ms = round(event["seconds"] * 1000)
        label = f"sfx{index}"
        filters.append(
            f"[{index}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,"
            f"volume={event['gainDb']:.4f}dB,asetpts=PTS-STARTPTS,adelay={delay_ms}|{delay_ms},"
            f"atrim=duration={duration:.6f}[{label}]"
        )
        mix_labels.append(f"[{label}]")
    filters.append(
        "".join(mix_labels) + f"amix=inputs={len(mix_labels)}:duration=first:dropout_transition=0:normalize=0,"
        f"alimiter=limit=0.97,atrim=duration={duration:.6f}[outa]"
    )
    cmd.extend(["-filter_complex", ";".join(filters), "-map", "[outa]", "-ar", "48000", "-ac", "2",
                "-c:a", "pcm_s16le", "-t", f"{duration:.6f}", str(output)])
    run(cmd)

    log_path = ROOT / "out" / "audio-mix-report.json"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    report = {
        "narration": str(narration.relative_to(ROOT)),
        "output": str(output.relative_to(ROOT)),
        "durationSeconds": duration,
        "fps": fps,
        "narrationMeanVolumeDb": narration_mean,
        "targetSfxGainRange": [low, high],
        "events": [{k: (str(v.relative_to(ROOT)) if isinstance(v, Path) else v)
                    for k, v in event.items() if k != "seconds"} | {"seconds": event["seconds"]}
                   for event in input_events],
    }
    log_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Audio mix created: {output}")
    print(f"Narration mean level: {narration_mean:.2f} dBFS; SFX events mixed: {len(input_events)}")
    print(f"Report: {log_path}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # concise CI-friendly error
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
