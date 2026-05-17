import {
  AppBar,
  Button,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import AudioFileIcon from "@mui/icons-material/AudioFile";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import DownloadIcon from "@mui/icons-material/Download";
import FileOpenIcon from "@mui/icons-material/FileOpen";
import RedoIcon from "@mui/icons-material/Redo";
import SaveIcon from "@mui/icons-material/Save";
import TextSnippetIcon from "@mui/icons-material/TextSnippet";
import UndoIcon from "@mui/icons-material/Undo";
import type { EditorMode } from "../domain/rhythmProject";

export function TopToolbar(props: {
  canRedo: boolean;
  canUndo: boolean;
  effectiveMode: EditorMode;
  hasLyrics: boolean;
  isAutoRubyRunning: boolean;
  onImportAudio: () => void;
  onImportLyrics: () => void;
  onLoadProject: () => void;
  onModeChange: (mode: EditorMode) => void;
  onRedo: () => void;
  onRunAutoRuby: () => void;
  onSaveProject: (forceDialog: boolean) => void;
  onUndo: () => void;
}) {
  const {
    canRedo,
    canUndo,
    effectiveMode,
    hasLyrics,
    isAutoRubyRunning,
    onImportAudio,
    onImportLyrics,
    onLoadProject,
    onModeChange,
    onRedo,
    onRunAutoRuby,
    onSaveProject,
    onUndo,
  } = props;

  return (
    <AppBar position="static" color="default" elevation={0} className="top-bar">
      <Toolbar variant="dense" className="toolbar">
        <Typography variant="h6" className="brand">
          RhythmKaraoke
        </Typography>
        <Stack direction="row" spacing={1} className="toolbar-actions">
          <Tooltip title="Import audio">
            <Button startIcon={<AudioFileIcon />} onClick={onImportAudio} variant="contained">
              Audio
            </Button>
          </Tooltip>
          <Tooltip title="Import lyrics">
            <Button startIcon={<TextSnippetIcon />} onClick={onImportLyrics}>
              Lyrics
            </Button>
          </Tooltip>
          <Tooltip title="Open project">
            <Button startIcon={<FileOpenIcon />} onClick={onLoadProject}>
              Open
            </Button>
          </Tooltip>
          <Tooltip title="Save project">
            <Button startIcon={<SaveIcon />} onClick={() => onSaveProject(false)}>
              Save
            </Button>
          </Tooltip>
          <Tooltip title="Export JSON">
            <Button startIcon={<DownloadIcon />} onClick={() => onSaveProject(true)}>
              Export
            </Button>
          </Tooltip>
          <Tooltip title="Auto Ruby">
            <span>
              <Button
                disabled={isAutoRubyRunning || !hasLyrics}
                onClick={onRunAutoRuby}
                startIcon={<AutoAwesomeIcon />}
              >
                Auto Ruby
              </Button>
            </span>
          </Tooltip>
        </Stack>
        <ToggleButtonGroup
          exclusive
          value={effectiveMode}
          onChange={(_, value: EditorMode | null) => value && onModeChange(value)}
          size="small"
          className="mode-toggle"
        >
          <ToggleButton value="check">Check</ToggleButton>
          <ToggleButton value="tag">Tag</ToggleButton>
        </ToggleButtonGroup>
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Undo">
            <span>
              <Button disabled={!canUndo} onClick={onUndo}>
                <UndoIcon />
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Redo">
            <span>
              <Button disabled={!canRedo} onClick={onRedo}>
                <RedoIcon />
              </Button>
            </span>
          </Tooltip>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
