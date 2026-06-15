// Celebration sound — plays the bundled "woohoo" MP3 from /public.

const SOUND_URL = "/woohoo.mp3";

let audioElement: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined" || typeof Audio === "undefined") return null;
  if (!audioElement) {
    audioElement = new Audio(SOUND_URL);
    audioElement.preload = "auto";
    audioElement.volume = 0.7;
  }
  return audioElement;
}

/**
 * Play the celebration sound. Resets to the start on each call so rapid
 * triggers replay cleanly rather than queueing. Silently no-ops if audio
 * is unavailable or blocked by browser autoplay policy.
 */
export function playCelebrationSound(): void {
  const audio = getAudio();
  if (!audio) return;
  try {
    audio.currentTime = 0;
  } catch {
    // Some browsers throw if currentTime is set before the media is ready.
  }
  audio.play().catch(() => {
    // Autoplay policy blocked or other failure — fail silently.
  });
}
