/**
 * DEPRECATED critical path — re-exports Voice Forge so existing imports keep working.
 * ElevenLabs SaaS is NOT called. Self-hosted XTTS / piper / espeak only.
 */
export {
  listVoices,
  synthesizeVoice,
  cloneVoice,
  synthesizeVoiceToFile,
  voiceForgeHealth,
  type VoiceRequest,
  type VoiceCloneRequest,
  type ForgeVoice as ElevenVoice,
} from "./voiceForge.js";
