#!/usr/bin/env python3
"""Local Whisper STT for Language Studio (pod fallback)."""
from __future__ import annotations

import argparse
import json
import sys


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--audio", required=True, help="Local wav/mp3/mp4 path")
    ap.add_argument("--model", default="base")
    ap.add_argument("--language", default="en")
    ap.add_argument("--out", required=True, help="Write JSON transcript here")
    args = ap.parse_args()

    import whisper

    model = whisper.load_model(args.model)
    result = model.transcribe(
        args.audio,
        language=args.language or None,
        verbose=False,
        word_timestamps=False,
    )
    segments = []
    for s in result.get("segments") or []:
        text = str(s.get("text") or "").strip()
        if not text:
            continue
        segments.append(
            {
                "start": round(float(s.get("start") or 0), 2),
                "end": round(float(s.get("end") or 0), 2),
                "text": text,
            }
        )
    text = str(result.get("text") or "").strip()
    if not text and segments:
        text = " ".join(x["text"] for x in segments)
    payload = {
        "text": text,
        "language": str(result.get("language") or args.language or "en"),
        "segments": segments,
        "engine": f"whisper-local-{args.model}",
    }
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
    if not text:
        print("empty transcript", file=sys.stderr)
        return 2
    print(json.dumps({"ok": True, "chars": len(text), "segments": len(segments)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
