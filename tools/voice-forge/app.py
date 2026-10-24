"""
ReelStorm Voice Forge — self-hosted clone + TTS (no ElevenLabs, no Coqui CPML).
Primary: Microsoft SpeechT5 + speaker embedding from your sample (MIT / commercial-OK).
Fallback: espeak-ng (local).
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import uuid
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

ROOT = Path(os.environ.get("VOICE_FORGE_DATA", Path(__file__).resolve().parent / "data"))
VOICES = ROOT / "voices"
TMP = ROOT / "tmp"
VOICES.mkdir(parents=True, exist_ok=True)
TMP.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="ReelStorm Voice Forge", version="1.1.0")

_engine = None
_engine_error: str | None = None


def _slug(name: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "_", (name or "voice").strip()).strip("_").lower()
    return s or f"voice_{uuid.uuid4().hex[:8]}"


def _load_engine():
    """Lazy-load SpeechT5 + speaker encoder."""
    global _engine, _engine_error
    if _engine is not None:
        return _engine
    if _engine_error and os.environ.get("VOICE_FORGE_RETRY") != "1":
        return None
    try:
        import torch
        from transformers import SpeechT5ForTextToSpeech, SpeechT5HifiGan, SpeechT5Processor

        device = "cuda" if torch.cuda.is_available() else "cpu"
        processor = SpeechT5Processor.from_pretrained("microsoft/speecht5_tts")
        model = SpeechT5ForTextToSpeech.from_pretrained("microsoft/speecht5_tts").to(device)
        vocoder = SpeechT5HifiGan.from_pretrained("microsoft/speecht5_hifigan").to(device)
        # Speaker embedding via speechbrain ECAPA (or mean mel fallback)
        spk = None
        try:
            from speechbrain.inference.speaker import EncoderClassifier

            spk = EncoderClassifier.from_hparams(
                source="speechbrain/spkrec-xvect-voxceleb",
                savedir=str(ROOT / "spkrec"),
                run_opts={"device": device},
            )
        except Exception as e:
            spk = None
            _engine_error = f"speaker_encoder_optional:{e}"[:200]

        _engine = {
            "kind": "speecht5",
            "device": device,
            "processor": processor,
            "model": model,
            "vocoder": vocoder,
            "spk": spk,
            "torch": torch,
        }
        _engine_error = None
        return _engine
    except Exception as e:
        _engine_error = str(e)[:400]
        return None


def _speaker_embedding(eng: dict, wav_path: Path):
    import numpy as np
    import soundfile as sf
    import torch

    torch_mod = eng["torch"]
    waveform, sr = sf.read(str(wav_path))
    if waveform.ndim > 1:
        waveform = waveform.mean(axis=1)
    # SpeechT5 expects 16k
    if sr != 16000:
        # resample via ffmpeg to temp
        tmp = TMP / f"spk_{uuid.uuid4().hex[:8]}.wav"
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(wav_path), "-ac", "1", "-ar", "16000", str(tmp)],
            capture_output=True,
        )
        waveform, sr = sf.read(str(tmp))
        if waveform.ndim > 1:
            waveform = waveform.mean(axis=1)

    wav = torch_mod.tensor(waveform).float().unsqueeze(0)
    if eng.get("spk") is not None:
        with torch_mod.no_grad():
            emb = eng["spk"].encode_batch(wav)
            # xvector -> project-ish to 512 for SpeechT5
            emb = emb.squeeze()
            if emb.numel() != 512:
                # pad/truncate to 512
                out = torch_mod.zeros(512)
                n = min(512, emb.numel())
                out[:n] = emb.flatten()[:n]
                emb = out
            return emb.unsqueeze(0).to(eng["device"])

    # Fallback: deterministic pseudo-embedding from audio stats (still speaker-conditioned weakly)
    rng = np.random.RandomState(abs(hash(wav_path.name)) % (2**32))
    base = rng.randn(512).astype(np.float32) * 0.01
    base[:32] = np.array(
        [
            float(np.mean(waveform)),
            float(np.std(waveform)),
            float(np.max(np.abs(waveform))),
            float(len(waveform) / max(sr, 1)),
        ]
        + [0.0] * 28,
        dtype=np.float32,
    )[:32]
    return torch_mod.tensor(base).unsqueeze(0).to(eng["device"])


def _speecht5_synth(text: str, speaker_wav: Path, out: Path) -> None:
    eng = _load_engine()
    if not eng:
        raise RuntimeError(f"SpeechT5 unavailable: {_engine_error}")
    torch = eng["torch"]
    processor = eng["processor"]
    model = eng["model"]
    vocoder = eng["vocoder"]
    # Chunk long text
    chunks = []
    remaining = text.strip()
    while remaining:
        chunks.append(remaining[:180])
        remaining = remaining[180:]
    waves = []
    speaker_embeddings = _speaker_embedding(eng, speaker_wav)
    with torch.no_grad():
        for chunk in chunks:
            inputs = processor(text=chunk, return_tensors="pt")
            speech = model.generate_speech(
                inputs["input_ids"].to(eng["device"]),
                speaker_embeddings,
                vocoder=vocoder,
            )
            waves.append(speech.cpu().numpy())
    import numpy as np
    import soundfile as sf

    audio = np.concatenate(waves) if len(waves) > 1 else waves[0]
    out.parent.mkdir(parents=True, exist_ok=True)
    wav_out = out if out.suffix.lower() == ".wav" else out.with_suffix(".wav")
    sf.write(str(wav_out), audio, 16000)
    if out.suffix.lower() == ".mp3":
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(wav_out), "-codec:a", "libmp3lame", "-q:a", "3", str(out)],
            capture_output=True,
        )
        if not out.exists():
            shutil.copy(wav_out, out)


def _profile_path(voice_id: str) -> Path:
    return VOICES / voice_id / "meta.json"


def _load_profile(voice_id: str) -> dict[str, Any]:
    p = _profile_path(voice_id)
    if not p.exists():
        raise HTTPException(404, f"voice not found: {voice_id}")
    return json.loads(p.read_text())


def _list_profiles() -> list[dict[str, Any]]:
    out = []
    for meta in sorted(VOICES.glob("*/meta.json")):
        try:
            out.append(json.loads(meta.read_text()))
        except Exception:
            continue
    return out


def _ffmpeg_to_wav(src: Path, dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    proc = subprocess.run(
        ["ffmpeg", "-y", "-i", str(src), "-ac", "1", "-ar", "16000", str(dest)],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0 or not dest.exists():
        raise RuntimeError((proc.stderr or "ffmpeg failed")[-400:])
    return dest


def _espeak_tts(text: str, out: Path) -> bool:
    bin_ = shutil.which("espeak-ng") or shutil.which("espeak")
    if not bin_:
        return False
    wav = out.with_suffix(".wav")
    proc = subprocess.run([bin_, "-w", str(wav), "-s", "155", "-v", "en", text], capture_output=True)
    if proc.returncode != 0 or not wav.exists():
        return False
    if out.suffix.lower() == ".mp3":
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(wav), "-codec:a", "libmp3lame", "-q:a", "4", str(out)],
            capture_output=True,
        )
        return out.exists()
    shutil.copy(wav, out)
    return True


class TtsBody(BaseModel):
    text: str
    voice_id: str | None = None
    language: str = "en"
    format: str = "mp3"


@app.get("/health")
@app.get("/voice/health")
def health():
    eng = _load_engine()
    return {
        "ok": True,
        "service": "voice-forge",
        "engine": "speecht5" if eng else "espeak",
        "clone": bool(eng),
        "device": (eng or {}).get("device"),
        "engine_error": _engine_error,
        "voices": len(_list_profiles()),
        "external_saas": False,
        "license": "SpeechT5 MIT — commercial OK (no Coqui CPML / no ElevenLabs)",
        "default_voice": os.environ.get("VOICE_FORGE_DEFAULT_ID"),
        "note": "Self-hosted Voice Forge — New Recording 22 locked as Founder",
    }


@app.get("/voice/voices")
@app.get("/voices")
def voices():
    return {"voices": _list_profiles(), "engine": "voice-forge"}


@app.post("/voice/clone")
async def clone_voice(
    name: str = Form(...),
    description: str = Form(""),
    file: UploadFile = File(...),
):
    voice_id = _slug(name) + "_" + uuid.uuid4().hex[:6]
    folder = VOICES / voice_id
    folder.mkdir(parents=True, exist_ok=True)
    raw = folder / f"upload{Path(file.filename or 'sample.wav').suffix or '.wav'}"
    raw.write_bytes(await file.read())
    ref = folder / "ref.wav"
    try:
        _ffmpeg_to_wav(raw, ref)
    except Exception as e:
        raise HTTPException(400, f"Could not normalize sample: {e}") from e

    meta = {
        "voice_id": voice_id,
        "name": name,
        "description": description,
        "ref": str(ref),
        "status": "ready",
        "engine": "speecht5" if _load_engine() else "local_ref",
        "provider": "voice-forge",
    }
    (folder / "meta.json").write_text(json.dumps(meta, indent=2) + "\n")
    return meta


@app.post("/voice/tts")
def tts(body: TtsBody):
    text = (body.text or "").strip()
    if not text:
        raise HTTPException(400, "text required")
    voice_id = body.voice_id or os.environ.get("VOICE_FORGE_DEFAULT_ID", "")
    out = TMP / f"tts_{uuid.uuid4().hex[:10]}.{body.format or 'mp3'}"

    speaker_wav = None
    if voice_id:
        try:
            prof = _load_profile(voice_id)
            speaker_wav = Path(prof["ref"])
        except HTTPException:
            speaker_wav = None

    err = ""
    if speaker_wav and speaker_wav.exists():
        try:
            _speecht5_synth(text, speaker_wav, out)
            if out.exists() and out.stat().st_size > 100:
                return FileResponse(
                    out,
                    media_type="audio/mpeg" if out.suffix == ".mp3" else "audio/wav",
                    filename=out.name,
                    headers={
                        "X-Voice-Engine": "speecht5",
                        "X-Voice-Id": voice_id or "",
                    },
                )
        except Exception as e:
            err = str(e)[:200]

    if _espeak_tts(text, out):
        return FileResponse(
            out,
            media_type="audio/mpeg" if out.suffix == ".mp3" else "audio/wav",
            filename=out.name,
            headers={"X-Voice-Engine": "espeak", "X-Voice-Note": err[:80]},
        )

    raise HTTPException(503, f"Voice Forge TTS failed. last={err or _engine_error}")


@app.post("/tts")
def tts_alias(body: TtsBody):
    return tts(body)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("VOICE_FORGE_PORT", "8090")))
