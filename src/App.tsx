import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  ClickAwayListener,
  CssBaseline,
  Divider,
  Fade,
  IconButton,
  LinearProgress,
  Paper,
  Popper,
  Slider,
  Stack,
  TextField,
  ThemeProvider,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Tooltip,
  Typography,
  createTheme,
} from "@mui/material";
import AudioFileIcon from "@mui/icons-material/AudioFile";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import FastForwardIcon from "@mui/icons-material/FastForward";
import FastRewindIcon from "@mui/icons-material/FastRewind";
import FileOpenIcon from "@mui/icons-material/FileOpen";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SaveIcon from "@mui/icons-material/Save";
import StopIcon from "@mui/icons-material/Stop";
import TextSnippetIcon from "@mui/icons-material/TextSnippet";
import TimerIcon from "@mui/icons-material/Timer";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import AddIcon from "@mui/icons-material/Add";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import {
  type CellPosition,
  type CheckRef,
  type EditorMode,
  type RhythmProject,
  addCheckAtCell,
  applyAutoRuby,
  clampPointIndex,
  clearChecksAtCell,
  clearTimeAtPoint,
  createEmptyProject,
  createProjectFromLyrics,
  deserializeProject,
  findFirstUntimedPointIndex,
  formatTime,
  getCheckRefs,
  getFirstCellPosition,
  removeLastCheckAtCell,
  removePreviousTime,
  serializeProject,
  setCellRuby,
  setKeyUpAtPoint,
  setTimeAtPoint,
  splitJapaneseMora,
  mergeCellWithNext,
  updateAudioMetadata,
  validateProject,
} from "./domain/rhythmProject";
import { tokenizeRubyLines } from "./platform/autoRuby";
import {
  type AudioSelection,
  audioUrlFromPath,
  openAudioFile,
  openLyricsFile,
  openProjectFile,
  saveJsonFile,
} from "./platform/files";

interface Snapshot {
  project: RhythmProject;
  pointIndex: number;
  selectedCell: CellPosition;
}

interface SpacePress {
  mode: EditorMode;
  pointIndex: number;
  startedAt: number;
  baseProject?: RhythmProject;
  foldWithPrevious?: boolean;
}

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#176b87",
    },
    secondary: {
      main: "#9b287b",
    },
    background: {
      default: "#f5f7f9",
      paper: "#ffffff",
    },
    warning: {
      main: "#b26a00",
    },
  },
  shape: {
    borderRadius: 6,
  },
  typography: {
    button: {
      textTransform: "none",
      fontWeight: 600,
    },
  },
});

function shouldIgnoreKeyboard(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  const tagName = target?.tagName;

  return (
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT" ||
    Boolean(target?.isContentEditable)
  );
}

function sanitizeFileName(title: string): string {
  const cleaned = title.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_");
  return `${cleaned || "untitled"}.rhythm-karaoke.json`;
}

function currentAudioTimeMs(audio: HTMLAudioElement | null, fallbackMs: number): number {
  return audio ? audio.currentTime * 1000 : fallbackMs;
}

function App() {
  const [project, setProject] = useState<RhythmProject>(() => createEmptyProject());
  const [projectPath, setProjectPath] = useState<string | undefined>();
  const [audio, setAudio] = useState<AudioSelection | null>(null);
  const [mode, setMode] = useState<EditorMode>("check");
  const [temporaryCheckMode, setTemporaryCheckMode] = useState(false);
  const [pointIndex, setPointIndex] = useState(0);
  const [selectedCell, setSelectedCell] = useState<CellPosition>(() =>
    getFirstCellPosition(createEmptyProject()),
  );
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [isAutoRubyRunning, setIsAutoRubyRunning] = useState(false);
  const [rubyEditorOpen, setRubyEditorOpen] = useState(false);
  const [rubyInput, setRubyInput] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const cellButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const spacePressRef = useRef<SpacePress | null>(null);

  const checkRefs = useMemo(() => getCheckRefs(project), [project]);
  const currentRef = checkRefs[pointIndex] ?? null;
  const selectedCellData =
    project.lines[selectedCell.lineIndex]?.cells[selectedCell.cellIndex] ?? null;
  const rubyAnchorEl = selectedCellData
    ? cellButtonRefs.current.get(selectedCellData.id) ?? null
    : null;
  const validationIssues = useMemo(() => validateProject(project), [project]);
  const validationErrors = validationIssues.filter(
    (issue) => issue.severity === "error",
  ).length;
  const validationWarnings = validationIssues.length - validationErrors;
  const effectiveMode: EditorMode = temporaryCheckMode ? "check" : mode;
  const progress = durationMs > 0 ? (currentTimeMs / durationMs) * 100 : 0;

  const commitProject = useCallback(
    (
      nextProject: RhythmProject,
      nextPointIndex = pointIndex,
      nextSelectedCell = selectedCell,
    ) => {
      setHistory((previous) => [
        ...previous.slice(-79),
        { project, pointIndex, selectedCell },
      ]);
      setFuture([]);
      setProject(nextProject);
      setPointIndex(clampPointIndex(nextProject, nextPointIndex));
      setSelectedCell(nextSelectedCell);
    },
    [pointIndex, project, selectedCell],
  );

  const focusEditorHost = useCallback(() => {
    window.setTimeout(() => editorHostRef.current?.focus(), 0);
  }, []);

  const openRubyEditor = useCallback(() => {
    const cell = project.lines[selectedCell.lineIndex]?.cells[selectedCell.cellIndex];

    if (!cell) {
      return;
    }

    setRubyInput(cell.ruby ?? "");
    setRubyEditorOpen(true);
  }, [project, selectedCell]);

  const closeRubyEditor = useCallback(() => {
    setRubyEditorOpen(false);
    focusEditorHost();
  }, [focusEditorHost]);

  const commitRubyEdit = useCallback(() => {
    const result = setCellRuby(project, selectedCell, rubyInput);
    commitProject(result.project, result.pointIndex, selectedCell);
    setRubyEditorOpen(false);
    focusEditorHost();
  }, [commitProject, focusEditorHost, project, rubyInput, selectedCell]);

  const connectSelectedCell = useCallback(() => {
    const result = mergeCellWithNext(project, selectedCell);
    const mergedCell =
      result.project.lines[result.selectedCell.lineIndex]?.cells[
        result.selectedCell.cellIndex
      ] ?? null;

    commitProject(result.project, result.pointIndex, result.selectedCell);
    setRubyInput(mergedCell?.ruby ?? "");
    setRubyEditorOpen(Boolean(mergedCell));
    focusEditorHost();
  }, [commitProject, focusEditorHost, project, selectedCell]);

  const runAutoRuby = useCallback(async () => {
    if (project.lines.length === 0) {
      return;
    }

    setIsAutoRubyRunning(true);
    setStatus("Auto Ruby initializing...");

    try {
      const tokenizedLines = await tokenizeRubyLines(project.lines.map((line) => line.text));
      const result = applyAutoRuby(project, tokenizedLines);
      const nextSelectedCell = getFirstCellPosition(result.project);

      commitProject(result.project, result.pointIndex, nextSelectedCell);
      setRubyEditorOpen(false);
      setStatus("Auto Ruby applied");
      focusEditorHost();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Auto Ruby failed");
    } finally {
      setIsAutoRubyRunning(false);
    }
  }, [commitProject, focusEditorHost, project]);

  const undo = useCallback(() => {
    setHistory((previous) => {
      const snapshot = previous[previous.length - 1];

      if (!snapshot) {
        return previous;
      }

      setFuture((nextFuture) => [
        { project, pointIndex, selectedCell },
        ...nextFuture,
      ]);
      setProject(snapshot.project);
      setPointIndex(snapshot.pointIndex);
      setSelectedCell(snapshot.selectedCell);
      return previous.slice(0, -1);
    });
  }, [pointIndex, project, selectedCell]);

  const redo = useCallback(() => {
    setFuture((nextFuture) => {
      const snapshot = nextFuture[0];

      if (!snapshot) {
        return nextFuture;
      }

      setHistory((previous) => [
        ...previous,
        { project, pointIndex, selectedCell },
      ]);
      setProject(snapshot.project);
      setPointIndex(snapshot.pointIndex);
      setSelectedCell(snapshot.selectedCell);
      return nextFuture.slice(1);
    });
  }, [pointIndex, project, selectedCell]);

  const importAudio = useCallback(async () => {
    const selection = await openAudioFile();

    if (!selection) {
      return;
    }

    setAudio(selection);
    commitProject(
      updateAudioMetadata(project, {
        name: selection.name,
        path: selection.path,
      }),
    );
    setStatus(`Audio loaded: ${selection.name}`);
  }, [commitProject, project]);

  const importLyrics = useCallback(async () => {
    const selection = await openLyricsFile();

    if (!selection) {
      return;
    }

    const nextProject = createProjectFromLyrics(selection.contents, {
      name: selection.name,
      path: selection.path,
      encoding: selection.encoding,
    });
    const nextPointIndex = findFirstUntimedPointIndex(nextProject);

    setHistory([]);
    setFuture([]);
    setProject(nextProject);
    setProjectPath(undefined);
    setPointIndex(nextPointIndex);
    setSelectedCell(getFirstCellPosition(nextProject));
    setStatus(`Lyrics loaded: ${selection.name}`);
  }, []);

  const loadProject = useCallback(async () => {
    const selection = await openProjectFile();

    if (!selection) {
      return;
    }

    try {
      const nextProject = deserializeProject(selection.contents);
      setHistory([]);
      setFuture([]);
      setProject(nextProject);
      setProjectPath(selection.path);
      setPointIndex(findFirstUntimedPointIndex(nextProject));
      setSelectedCell(getFirstCellPosition(nextProject));

      if (nextProject.metadata.audio?.path) {
        setAudio({
          name: nextProject.metadata.audio.name,
          path: nextProject.metadata.audio.path,
          url: audioUrlFromPath(nextProject.metadata.audio.path),
        });
      }

      setStatus(`Project opened: ${selection.name}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Project open failed");
    }
  }, []);

  const saveProject = useCallback(
    async (forceDialog = false) => {
      if (validationErrors > 0) {
        const shouldContinue = window.confirm(
          "This project has timing errors. Save anyway?",
        );

        if (!shouldContinue) {
          return;
        }
      }

      const path = await saveJsonFile({
        contents: serializeProject(project),
        defaultName: sanitizeFileName(project.metadata.title),
        path: projectPath,
        forceDialog,
      });

      if (path) {
        setProjectPath(path);
        setStatus(`Project saved: ${path}`);
      } else {
        setStatus("Project exported");
      }
    },
    [project, projectPath, validationErrors],
  );

  const play = useCallback(async () => {
    if (!audioRef.current) {
      return;
    }

    await audioRef.current.play();
    setIsPlaying(true);
    setMode("tag");
  }, []);

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
    setMode("check");
  }, []);

  const seekBy = useCallback(
    (deltaMs: number) => {
      if (!audioRef.current) {
        return;
      }

      const nextTime = Math.max(
        0,
        Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + deltaMs / 1000),
      );
      audioRef.current.currentTime = nextTime;
      setCurrentTimeMs(nextTime * 1000);
    },
    [],
  );

  const stampPoint = useCallback(
    (baseProject: RhythmProject, index: number, keyUp = false) => {
      const stampedTime =
        currentAudioTimeMs(audioRef.current, currentTimeMs) +
        baseProject.settings.inputOffsetMs;

      return {
        ...setTimeAtPoint(baseProject, index, stampedTime, keyUp),
        stampedTime,
      };
    },
    [currentTimeMs],
  );

  const tagPoint = useCallback(
    (index: number, keyUp = false) => {
      if (checkRefs.length === 0) {
        return null;
      }

      const result = stampPoint(project, index, keyUp);
      commitProject(result.project, result.pointIndex, selectedCell);
      setStatus(`Tagged ${formatTime(result.stampedTime)}`);
      return result;
    },
    [checkRefs.length, commitProject, project, selectedCell, stampPoint],
  );

  const handleCellSelect = useCallback(
    (position: CellPosition) => {
      setSelectedCell(position);
      const nextIndex = checkRefs.findIndex(
        (ref) =>
          ref.lineIndex === position.lineIndex && ref.cellIndex === position.cellIndex,
      );

      if (nextIndex !== -1) {
        setPointIndex(nextIndex);
      }
    },
    [checkRefs],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (shouldIgnoreKeyboard(event)) {
        return;
      }

      const key = event.key.toLowerCase();

      if (event.ctrlKey && key === "z") {
        event.preventDefault();
        undo();
        return;
      }

      if (event.ctrlKey && (key === "y" || key === "x")) {
        event.preventDefault();
        redo();
        return;
      }

      if (event.key === "Shift") {
        setTemporaryCheckMode(true);
        return;
      }

      if (event.key === "Escape" && rubyEditorOpen) {
        event.preventDefault();
        closeRubyEditor();
        return;
      }

      if (event.key === "F2") {
        event.preventDefault();
        openRubyEditor();
        return;
      }

      if (key === "a") {
        event.preventDefault();
        void play();
        return;
      }

      if (key === "d") {
        event.preventDefault();
        pause();
        return;
      }

      if (key === "s") {
        event.preventDefault();
        stop();
        return;
      }

      if (key === "z") {
        event.preventDefault();
        seekBy(-project.settings.seekStepMs);
        return;
      }

      if (key === "x") {
        event.preventDefault();
        seekBy(project.settings.seekStepMs);
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();

        if (effectiveMode === "check") {
          const result = removeLastCheckAtCell(project, selectedCell);
          commitProject(result.project, result.pointIndex, selectedCell);
        } else {
          const result = removePreviousTime(project, pointIndex);
          commitProject(result.project, result.pointIndex, selectedCell);

          if (audioRef.current) {
            audioRef.current.currentTime = result.seekMs / 1000;
          }
        }
        return;
      }

      if (event.key === "Delete") {
        event.preventDefault();

        if (effectiveMode === "check") {
          const result = clearChecksAtCell(project, selectedCell);
          commitProject(result.project, result.pointIndex, selectedCell);
        } else {
          const result = clearTimeAtPoint(project, pointIndex);
          commitProject(result.project, result.pointIndex, selectedCell);
        }
        return;
      }

      if ((event.code === "Space" || event.key === " ") && !event.repeat) {
        event.preventDefault();

        if (effectiveMode === "check") {
          const result = addCheckAtCell(project, selectedCell);
          spacePressRef.current = {
            mode: "check",
            pointIndex: result.pointIndex,
            startedAt: performance.now(),
          };
          commitProject(result.project, result.pointIndex, selectedCell);
          return;
        }

        if (currentRef?.check.keyUp) {
          spacePressRef.current = {
            mode: "tag",
            pointIndex,
            startedAt: performance.now(),
          };
          return;
        }

        const result = tagPoint(pointIndex);
        const nextRef = result
          ? getCheckRefs(result.project)[result.pointIndex]
          : null;

        if (result && nextRef?.check.keyUp) {
          spacePressRef.current = {
            mode: "tag",
            pointIndex: result.pointIndex,
            startedAt: performance.now(),
            baseProject: result.project,
            foldWithPrevious: true,
          };
        }
      }
    },
    [
      commitProject,
      currentRef,
      effectiveMode,
      pause,
      play,
      pointIndex,
      project,
      redo,
      seekBy,
      selectedCell,
      stop,
      tagPoint,
      undo,
      openRubyEditor,
      rubyEditorOpen,
      closeRubyEditor,
    ],
  );

  const handleKeyUp = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        setTemporaryCheckMode(false);
        return;
      }

      if (!(event.code === "Space" || event.key === " ")) {
        return;
      }

      const press = spacePressRef.current;
      spacePressRef.current = null;

      if (!press) {
        return;
      }

      const heldMs = performance.now() - press.startedAt;

      if (press.mode === "check" && heldMs >= 350) {
        setProject((current) => setKeyUpAtPoint(current, press.pointIndex, true).project);
        setStatus("Key-up check marked");
      }

      if (press.mode === "tag") {
        const baseProject = press.baseProject ?? project;
        const result = stampPoint(baseProject, press.pointIndex, true);

        if (press.foldWithPrevious) {
          setProject(result.project);
          setPointIndex(result.pointIndex);
          setSelectedCell(selectedCell);
          setStatus(`Extended to ${formatTime(result.stampedTime)}`);
        } else {
          commitProject(result.project, result.pointIndex, selectedCell);
          setStatus(`Tagged ${formatTime(result.stampedTime)}`);
        }
      }
    },
    [commitProject, project, selectedCell, stampPoint],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  const issueChip = validationErrors
    ? { label: `${validationErrors} errors`, color: "error" as const }
    : validationWarnings
      ? { label: `${validationWarnings} warnings`, color: "warning" as const }
      : { label: "Timing OK", color: "success" as const };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box className="app-shell">
        <AppBar position="static" color="default" elevation={0} className="top-bar">
          <Toolbar variant="dense" className="toolbar">
            <Typography variant="h6" className="brand">
              RhythmKaraoke
            </Typography>
            <Stack direction="row" spacing={1} className="toolbar-actions">
              <Tooltip title="Import audio">
                <Button startIcon={<AudioFileIcon />} onClick={importAudio} variant="contained">
                  Audio
                </Button>
              </Tooltip>
              <Tooltip title="Import lyrics">
                <Button startIcon={<TextSnippetIcon />} onClick={importLyrics}>
                  Lyrics
                </Button>
              </Tooltip>
              <Tooltip title="Open project">
                <Button startIcon={<FileOpenIcon />} onClick={loadProject}>
                  Open
                </Button>
              </Tooltip>
              <Tooltip title="Save project">
                <Button startIcon={<SaveIcon />} onClick={() => void saveProject(false)}>
                  Save
                </Button>
              </Tooltip>
              <Tooltip title="Export JSON">
                <Button startIcon={<DownloadIcon />} onClick={() => void saveProject(true)}>
                  Export
                </Button>
              </Tooltip>
              <Tooltip title="Auto Ruby">
                <span>
                  <Button
                    disabled={isAutoRubyRunning || project.lines.length === 0}
                    onClick={() => void runAutoRuby()}
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
              onChange={(_, value: EditorMode | null) => value && setMode(value)}
              size="small"
              className="mode-toggle"
            >
              <ToggleButton value="check">Check</ToggleButton>
              <ToggleButton value="tag">Tag</ToggleButton>
            </ToggleButtonGroup>
            <Stack direction="row" spacing={0.5}>
              <Tooltip title="Undo">
                <span>
                  <Button disabled={history.length === 0} onClick={undo}>
                    <UndoIcon />
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title="Redo">
                <span>
                  <Button disabled={future.length === 0} onClick={redo}>
                    <RedoIcon />
                  </Button>
                </span>
              </Tooltip>
            </Stack>
          </Toolbar>
        </AppBar>

        <Box className="workspace">
          <Box className="editor-pane" ref={editorHostRef} tabIndex={-1}>
            <Box className="editor-header">
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <TimerIcon color="primary" />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {project.metadata.title}
                </Typography>
                <Chip
                  size="small"
                  label={effectiveMode === "check" ? "Check mode" : "Tag mode"}
                  color={effectiveMode === "check" ? "primary" : "secondary"}
                />
                <Chip size="small" label={issueChip.label} color={issueChip.color} />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {checkRefs.length} checks
              </Typography>
            </Box>
            <Divider />
            <Box className="lyrics-surface">
              {project.lines.length === 0 ? (
                <Box className="empty-state">
                  <Typography variant="h6">No lyrics loaded</Typography>
                </Box>
              ) : (
                project.lines.map((line, lineIndex) => (
                  <Box className="lyric-line" key={line.id}>
                    <Typography className="line-number">
                      {(lineIndex + 1).toString().padStart(2, "0")}
                    </Typography>
                    <Box className="line-cells">
                      {line.cells.map((cell, cellIndex) => {
                        const firstPointIndex = checkRefs.findIndex(
                          (ref) =>
                            ref.lineIndex === lineIndex && ref.cellIndex === cellIndex,
                        );
                        const isCurrent =
                          firstPointIndex !== -1 &&
                          cell.checks.some((_, checkIndex) => {
                            const ref = checkRefs[pointIndex];
                            return (
                              ref?.lineIndex === lineIndex &&
                              ref.cellIndex === cellIndex &&
                              ref.checkIndex === checkIndex
                            );
                          });
                        const isSelected =
                          selectedCell.lineIndex === lineIndex &&
                          selectedCell.cellIndex === cellIndex;

                        return (
                          <LyricCellView
                            cellText={cell.text}
                            ruby={cell.ruby}
                            checks={cell.checks}
                            isCurrent={isCurrent}
                            isSelected={effectiveMode === "check" && isSelected}
                            key={cell.id}
                            onSelect={() => handleCellSelect({ lineIndex, cellIndex })}
                            refCallback={(element) => {
                              if (element) {
                                cellButtonRefs.current.set(cell.id, element);
                              } else {
                                cellButtonRefs.current.delete(cell.id);
                              }
                            }}
                          />
                        );
                      })}
                    </Box>
                  </Box>
                ))
              )}
            </Box>
          </Box>

          <Box className="side-panel">
            <Typography variant="overline">Project</Typography>
            <Typography variant="body2">{projectPath || "Unsaved project"}</Typography>
            <Divider />
            <Typography variant="overline">Audio</Typography>
            <Typography variant="body2">{audio?.name || "No audio"}</Typography>
            <Typography variant="overline">Selection</Typography>
            <Stack spacing={0.5}>
              <Typography variant="body2">
                Line {selectedCell.lineIndex + 1}, Cell {selectedCell.cellIndex + 1}
              </Typography>
              <Typography variant="body2">
                Point {checkRefs.length === 0 ? 0 : pointIndex + 1} / {checkRefs.length}
              </Typography>
              <Typography variant="body2">
                Time {formatTime(currentRef?.check.timeMs)}
              </Typography>
            </Stack>
            <Divider />
            <Typography variant="overline">Validation</Typography>
            <Stack spacing={1}>
              {validationIssues.slice(0, 5).map((issue) => (
                <Alert severity={issue.severity} key={`${issue.message}-${issue.ref?.checkIndex}`}>
                  {issue.message}
                </Alert>
              ))}
              {validationIssues.length > 5 ? (
                <Typography variant="caption" color="text.secondary">
                  {validationIssues.length - 5} more
                </Typography>
              ) : null}
            </Stack>
          </Box>
        </Box>

        <Popper
          anchorEl={rubyAnchorEl}
          className="ruby-editor-popper"
          open={rubyEditorOpen && Boolean(rubyAnchorEl)}
          placement="top-start"
          transition
        >
          {({ TransitionProps }) => (
            <Fade {...TransitionProps} timeout={160}>
              <div className="ruby-editor-transition">
                <ClickAwayListener onClickAway={closeRubyEditor}>
                  <Paper className="ruby-editor-paper" elevation={6} role="dialog">
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <TextField
                        autoFocus
                        label="Ruby"
                        onChange={(event) => setRubyInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            commitRubyEdit();
                          }

                          if (event.key === "Escape") {
                            event.preventDefault();
                            closeRubyEditor();
                          }
                        }}
                        size="small"
                        value={rubyInput}
                      />
                      <Tooltip title="连接">
                        <IconButton
                          aria-label="连接"
                          className="ruby-connect-button"
                          onClick={connectSelectedCell}
                          size="small"
                        >
                          <AddIcon />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Paper>
                </ClickAwayListener>
              </div>
            </Fade>
          )}
        </Popper>

        <Box className="transport">
          <audio
            onDurationChange={(event) =>
              setDurationMs((event.currentTarget.duration || 0) * 1000)
            }
            onEnded={() => setIsPlaying(false)}
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            onTimeUpdate={(event) =>
              setCurrentTimeMs(event.currentTarget.currentTime * 1000)
            }
            ref={audioRef}
            src={audio?.url}
          />
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
            <Tooltip title="Play">
              <span>
                <Button disabled={!audio} onClick={() => void play()}>
                  <PlayArrowIcon />
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Pause">
              <span>
                <Button disabled={!audio || !isPlaying} onClick={pause}>
                  <PauseIcon />
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Stop">
              <span>
                <Button disabled={!audio} onClick={stop}>
                  <StopIcon />
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Rewind">
              <span>
                <Button disabled={!audio} onClick={() => seekBy(-project.settings.seekStepMs)}>
                  <FastRewindIcon />
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Forward">
              <span>
                <Button disabled={!audio} onClick={() => seekBy(project.settings.seekStepMs)}>
                  <FastForwardIcon />
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Clear current time">
              <span>
                <Button
                  disabled={checkRefs.length === 0}
                  onClick={() => {
                    const result = clearTimeAtPoint(project, pointIndex);
                    commitProject(result.project, result.pointIndex, selectedCell);
                  }}
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
                  if (audioRef.current) {
                    audioRef.current.currentTime = nextMs / 1000;
                  }
                  setCurrentTimeMs(nextMs);
                }}
                size="small"
                value={Math.min(currentTimeMs, Math.max(durationMs, 1))}
              />
              <Typography variant="body2" className="time-readout">
                {formatTime(durationMs)}
              </Typography>
            </Stack>
            <LinearProgress variant="determinate" value={Math.min(100, progress)} />
          </Box>
          <Typography variant="caption" className="status-text">
            {status}
          </Typography>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

function LyricCellView(props: {
  cellText: string;
  ruby?: string;
  checks: CheckRef["check"][];
  isCurrent: boolean;
  isSelected: boolean;
  onSelect: () => void;
  refCallback: (element: HTMLButtonElement | null) => void;
}) {
  const { cellText, ruby, checks, isCurrent, isSelected, onSelect, refCallback } = props;
  const orderedChecks = [
    ...checks.filter((check) => !check.keyUp),
    ...checks.filter((check) => check.keyUp),
  ];
  const keyDownChecks = checks.filter((check) => !check.keyUp);
  const timedKeyDownCount = keyDownChecks.filter((check) => check.timeMs !== null).length;
  const rubyMora = ruby ? splitJapaneseMora(ruby) : [];
  const hasTimedCheck = ruby
    ? keyDownChecks.length > 0 &&
      keyDownChecks.every((check) => check.timeMs !== null)
    : checks.some((check) => check.timeMs !== null);
  const hasKeyUp = checks.some((check) => check.keyUp);

  return (
    <button
      className={[
        "lyric-cell",
        isSelected ? "selected" : "",
        isCurrent ? "current" : "",
        hasTimedCheck ? "timed" : "",
        hasKeyUp ? "keyup" : "",
      ].join(" ")}
      onClick={(event) => {
        event.currentTarget.blur();
        onSelect();
      }}
      ref={refCallback}
      type="button"
    >
      {ruby ? (
        <span className="cell-ruby">
          {rubyMora.map((mora, index) => (
            <span
              className={[
                "cell-ruby-mora",
                index < timedKeyDownCount ? "timed" : "",
              ].join(" ")}
              key={`${mora}-${index}`}
            >
              {mora}
            </span>
          ))}
        </span>
      ) : (
        <span className="cell-ruby" />
      )}
      <span className="cell-text">{cellText === " " ? "\u00a0" : cellText}</span>
      <span className="check-row">
        {orderedChecks.map((check, checkIndex) => (
          <span
            className={[
              "check-mark",
              checkIndex > 0 && !check.keyUp ? "extra" : "",
              check.timeMs !== null ? "set" : "",
              check.keyUp ? "release" : "",
            ].join(" ")}
            key={check.id}
          />
        ))}
      </span>
    </button>
  );
}

export default App;
