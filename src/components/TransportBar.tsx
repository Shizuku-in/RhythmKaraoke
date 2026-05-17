import { Box, Button, Slider, Stack, Tooltip, Typography } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import FastForwardIcon from "@mui/icons-material/FastForward";
import FastRewindIcon from "@mui/icons-material/FastRewind";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import type { RefObject } from "react";
import { formatTime } from "../domain/rhythmProject";
import type { AudioSelection } from "../platform/files";

export function TransportBar(props: {
  audio: AudioSelection | null;
  audioRef: RefObject<HTMLAudioElement | null>;
  checkRefsLength: number;
  currentTimeMs: number;
  durationMs: number;
  isPlaying: boolean;
  onClearCurrentTime: () => void;
  onPause: () => void;
  onPlay: () => void;
  onSeekBy: (deltaMs: number) => void;
  onSetCurrentTimeMs: (currentTimeMs: number) => void;
  onSetDurationMs: (durationMs: number) => void;
  onSetIsPlaying: (isPlaying: boolean) => void;
  onSetPlaybackPositionMs: (positionMs: number) => void;
  onStop: () => void;
  seekStepMs: number;
  status: string;
}) {
  const {
    audio,
    audioRef,
    checkRefsLength,
    currentTimeMs,
    durationMs,
    isPlaying,
    onClearCurrentTime,
    onPause,
    onPlay,
    onSeekBy,
    onSetCurrentTimeMs,
    onSetDurationMs,
    onSetIsPlaying,
    onSetPlaybackPositionMs,
    onStop,
    seekStepMs,
    status,
  } = props;

  return (
    <Box className="transport">
      <audio
        onDurationChange={(event) =>
          onSetDurationMs((event.currentTarget.duration || 0) * 1000)
        }
        onEnded={() => onSetIsPlaying(false)}
        onPause={() => onSetIsPlaying(false)}
        onPlay={() => onSetIsPlaying(true)}
        onTimeUpdate={(event) =>
          onSetCurrentTimeMs(event.currentTarget.currentTime * 1000)
        }
        ref={audioRef}
        src={audio?.url}
      />
      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
        <Tooltip title="Play">
          <span>
            <Button disabled={!audio} onClick={onPlay}>
              <PlayArrowIcon />
            </Button>
          </span>
        </Tooltip>
        <Tooltip title="Pause">
          <span>
            <Button disabled={!audio || !isPlaying} onClick={onPause}>
              <PauseIcon />
            </Button>
          </span>
        </Tooltip>
        <Tooltip title="Stop">
          <span>
            <Button disabled={!audio} onClick={onStop}>
              <StopIcon />
            </Button>
          </span>
        </Tooltip>
        <Tooltip title="Rewind">
          <span>
            <Button disabled={!audio} onClick={() => onSeekBy(-seekStepMs)}>
              <FastRewindIcon />
            </Button>
          </span>
        </Tooltip>
        <Tooltip title="Forward">
          <span>
            <Button disabled={!audio} onClick={() => onSeekBy(seekStepMs)}>
              <FastForwardIcon />
            </Button>
          </span>
        </Tooltip>
        <Tooltip title="Clear current time">
          <span>
            <Button
              disabled={checkRefsLength === 0}
              onClick={onClearCurrentTime}
            >
              <DeleteIcon />
            </Button>
          </span>
        </Tooltip>
      </Stack>
      <Box className="time-strip">
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography variant="body2" className="time-readout">
            {formatTime(currentTimeMs)}
          </Typography>
          <Slider
            aria-label="Playback position"
            disabled={!audio || durationMs === 0}
            max={Math.max(durationMs, 1)}
            min={0}
            onChange={(_, value) => {
              const nextMs = Array.isArray(value) ? value[0] : value;
              onSetPlaybackPositionMs(nextMs);
            }}
            size="small"
            value={Math.min(currentTimeMs, Math.max(durationMs, 1))}
          />
          <Typography variant="body2" className="time-readout">
            {formatTime(durationMs)}
          </Typography>
        </Stack>
      </Box>
      <Typography variant="caption" className="status-text">
        {status}
      </Typography>
    </Box>
  );
}
