# Weights — NOT in the installer

The desktop app is a **~120MB thin client**. SkyReels V2 DF 1.3B-540P (~4.2GB) lives on the **RunPod saver**:

- Pod: `xuvnute41511og`
- Path: `/workspace/skyreels-1.3b-4.2GB`
- Volume: `reelstorm-weights` (70GB)

Generate always goes:

`Studio → api.reelstorm.uk/api/generate → RunPod /generate → R2 URL`

Do **not** download weights onto user PCs. See `docs/FINAL_ARCH_0MB_WEB_120MB_DESKTOP_VIA_SAVER.md`.
