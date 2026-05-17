import { useCallback, useRef, useState } from "react";

export function useAudioTransport(options: {
  onPlayStart: () => void;
  onStop: () => void;
}) {
  const { onPlayStart, onStop } = options;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const play = useCallback(async () => {
    if (!audioRef.current) {
      return;
    }

    await audioRef.current.play();
    setIsPlaying(true);
    onPlayStart();
  }, [onPlayStart]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setCurrentTimeMs(0);
    setIsPlaying(false);
    onStop();
  }, [onStop]);

  const seekBy = useCallback((deltaMs: number) => {
    if (!audioRef.current) {
      return;
    }

    const nextTime = Math.max(
      0,
      Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + deltaMs / 1000),
    );
    audioRef.current.currentTime = nextTime;
    setCurrentTimeMs(nextTime * 1000);
  }, []);

  const setPlaybackPositionMs = useCallback((nextMs: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = nextMs / 1000;
    }
    setCurrentTimeMs(nextMs);
  }, []);

  return {
    audioRef,
    currentTimeMs,
    durationMs,
    isPlaying,
    pause,
    play,
    seekBy,
    setCurrentTimeMs,
    setDurationMs,
    setIsPlaying,
    setPlaybackPositionMs,
    stop,
  };
}
