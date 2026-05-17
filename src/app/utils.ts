export function shouldIgnoreKeyboard(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  const tagName = target?.tagName;

  return (
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT" ||
    Boolean(target?.isContentEditable)
  );
}

export function sanitizeFileName(title: string): string {
  const cleaned = title.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_");
  return `${cleaned || "untitled"}.rhythm-karaoke.json`;
}

export function currentAudioTimeMs(audio: HTMLAudioElement | null, fallbackMs: number): number {
  return audio ? audio.currentTime * 1000 : fallbackMs;
}
