#!/usr/bin/env python3
"""Meta MMS-TTS for Yoruba / Hausa / Igbo (+ German) — Language Studio voice path."""
from __future__ import annotations

import argparse
import re
import sys

MODELS = {
    "yo": "facebook/mms-tts-yor",
    "ha": "facebook/mms-tts-hau",
    "ig": "facebook/mms-tts-ibo",
    "de": "facebook/mms-tts-deu",
}

# Keep chunks short — VITS can degrade / OOM on very long strings
MAX_CHARS = 280


def chunk_text(text: str, max_chars: int = MAX_CHARS) -> list[str]:
    text = re.sub(r"\s+", " ", (text or "").strip())
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]
    parts: list[str] = []
    buf = ""
    for sentence in re.split(r"(?<=[.!?。…])\s+", text):
        if not sentence:
            continue
        if len(buf) + len(sentence) + 1 <= max_chars:
            buf = f"{buf} {sentence}".strip()
        else:
            if buf:
                parts.append(buf)
            if len(sentence) <= max_chars:
                buf = sentence
            else:
                # hard wrap long run-ons
                for i in range(0, len(sentence), max_chars):
                    parts.append(sentence[i : i + max_chars])
                buf = ""
    if buf:
        parts.append(buf)
    return parts


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", required=True, choices=sorted(MODELS.keys()))
    ap.add_argument("--text", required=True)
    ap.add_argument("--out", required=True, help="Output wav path")
    args = ap.parse_args()

    import numpy as np
    import scipy.io.wavfile as wav
    import torch
    from transformers import AutoTokenizer, VitsModel

    model_id = MODELS[args.lang]
    chunks = chunk_text(args.text)
    if not chunks:
        print("empty text", file=sys.stderr)
        return 2

    tok = AutoTokenizer.from_pretrained(model_id)
    model = VitsModel.from_pretrained(model_id)
    model.eval()
    sr = int(model.config.sampling_rate)
    waves: list[np.ndarray] = []

    with torch.no_grad():
        for chunk in chunks:
            inputs = tok(chunk, return_tensors="pt")
            out = model(**inputs).waveform
            arr = out.squeeze().detach().cpu().numpy().astype(np.float32)
            waves.append(arr)
            # short silence between chunks
            waves.append(np.zeros(int(sr * 0.18), dtype=np.float32))

    audio = np.concatenate(waves) if waves else np.zeros(sr, dtype=np.float32)
    # scipy wav wants int16 for broad player support
    peak = float(np.max(np.abs(audio))) or 1.0
    pcm = (audio / peak * 0.9 * 32767.0).astype(np.int16)
    wav.write(args.out, sr, pcm)
    print(f"ok lang={args.lang} model={model_id} samples={len(pcm)} sr={sr} chunks={len(chunks)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
