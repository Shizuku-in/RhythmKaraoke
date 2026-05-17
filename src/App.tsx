import { Box, CssBaseline, ThemeProvider } from "@mui/material";
import { useCallback, useRef } from "react";
import "./App.css";
import { theme } from "./app/theme";
import { CellContextMenu } from "./components/CellContextMenu";
import { EditorPane } from "./components/EditorPane";
import { RubyEditorPopper } from "./components/RubyEditorPopper";
import { SidePanel } from "./components/SidePanel";
import { TopToolbar } from "./components/TopToolbar";
import { TransportBar } from "./components/TransportBar";
import { useAudioTransport } from "./hooks/useAudioTransport";
import { useCellContextMenu } from "./hooks/useCellContextMenu";
import { useGlobalEditorKeyboard } from "./hooks/useGlobalEditorKeyboard";
import { useProjectEditor } from "./hooks/useProjectEditor";
import { useRubyEditor } from "./hooks/useRubyEditor";

function App() {
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const closeRubyEditorRef = useRef<() => void>(() => undefined);

  const focusEditorHost = useCallback(() => {
    window.setTimeout(() => editorHostRef.current?.focus(), 0);
  }, []);

  const projectEditor = useProjectEditor({
    focusEditorHost,
    onAutoRubyApplied: () => closeRubyEditorRef.current(),
  });
  const transport = useAudioTransport({
    onPlayStart: () => projectEditor.setMode("tag"),
    onStop: () => projectEditor.setMode("check"),
  });
  const rubyEditor = useRubyEditor({
    commitProject: projectEditor.commitProject,
    focusEditorHost,
    project: projectEditor.project,
    selectedCell: projectEditor.selectedCell,
  });
  const cellContextMenu = useCellContextMenu({
    commitProject: projectEditor.commitProject,
    focusEditorHost,
    handleCellSelect: projectEditor.handleCellSelect,
    project: projectEditor.project,
    dismissRubyEditor: rubyEditor.dismissRubyEditor,
    setStatus: projectEditor.setStatus,
  });

  closeRubyEditorRef.current = rubyEditor.closeRubyEditor;

  useGlobalEditorKeyboard({
    audioRef: transport.audioRef,
    checkRefsLength: projectEditor.checkRefs.length,
    closeRubyEditor: rubyEditor.closeRubyEditor,
    commitProject: projectEditor.commitProject,
    currentRef: projectEditor.currentRef,
    currentTimeMs: transport.currentTimeMs,
    effectiveMode: projectEditor.effectiveMode,
    openRubyEditor: rubyEditor.openRubyEditor,
    pause: transport.pause,
    play: transport.play,
    pointIndex: projectEditor.pointIndex,
    project: projectEditor.project,
    redo: projectEditor.redo,
    rubyEditorOpen: rubyEditor.rubyEditorOpen,
    seekBy: transport.seekBy,
    selectedCell: projectEditor.selectedCell,
    setPointIndex: projectEditor.setPointIndex,
    setProject: projectEditor.setProject,
    setSelectedCell: projectEditor.setSelectedCell,
    setStatus: projectEditor.setStatus,
    setTemporaryCheckMode: projectEditor.setTemporaryCheckMode,
    stop: transport.stop,
    undo: projectEditor.undo,
  });

  const issueChip = projectEditor.validationErrors
    ? { label: `${projectEditor.validationErrors} errors`, color: "error" as const }
    : projectEditor.validationWarnings
      ? { label: `${projectEditor.validationWarnings} warnings`, color: "warning" as const }
      : { label: "Timing OK", color: "success" as const };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box className="app-shell">
        <TopToolbar
          canRedo={projectEditor.future.length > 0}
          canUndo={projectEditor.history.length > 0}
          effectiveMode={projectEditor.effectiveMode}
          hasLyrics={projectEditor.project.lines.length > 0}
          isAutoRubyRunning={projectEditor.isAutoRubyRunning}
          onImportAudio={() => void projectEditor.importAudio()}
          onImportLyrics={() => void projectEditor.importLyrics()}
          onLoadProject={() => void projectEditor.loadProject()}
          onModeChange={projectEditor.setMode}
          onRedo={projectEditor.redo}
          onRunAutoRuby={() => void projectEditor.runAutoRuby()}
          onSaveProject={(forceDialog) => void projectEditor.saveProject(forceDialog)}
          onUndo={projectEditor.undo}
        />

        <Box className="workspace">
          <EditorPane
            checkRefs={projectEditor.checkRefs}
            editorHostRef={editorHostRef}
            effectiveMode={projectEditor.effectiveMode}
            issueChip={issueChip}
            onCellContextMenu={cellContextMenu.handleCellContextMenu}
            onCellSelect={projectEditor.handleCellSelect}
            pointIndex={projectEditor.pointIndex}
            project={projectEditor.project}
            registerCellButton={rubyEditor.registerCellButton}
            selectedCell={projectEditor.selectedCell}
          />

          <SidePanel
            audio={projectEditor.audio}
            checkRefsLength={projectEditor.checkRefs.length}
            currentRef={projectEditor.currentRef}
            pointIndex={projectEditor.pointIndex}
            projectPath={projectEditor.projectPath}
            selectedCell={projectEditor.selectedCell}
            validationIssues={projectEditor.validationIssues}
          />
        </Box>

        <CellContextMenu
          cellContextMenu={cellContextMenu.cellContextMenu}
          onAddReleaseMarker={cellContextMenu.addReleaseMarkerAtContextCell}
          onClose={cellContextMenu.closeCellContextMenu}
          onConnect={cellContextMenu.connectContextCell}
          onRemoveReleaseMarker={cellContextMenu.removeReleaseMarkerAtContextCell}
          project={projectEditor.project}
        />

        <RubyEditorPopper
          anchorEl={rubyEditor.rubyAnchorEl}
          onClose={rubyEditor.closeRubyEditor}
          onCommit={rubyEditor.commitRubyEdit}
          onConnectSelectedCell={rubyEditor.connectSelectedCell}
          open={rubyEditor.rubyEditorOpen}
          rubyInput={rubyEditor.rubyInput}
          setRubyInput={rubyEditor.setRubyInput}
        />

        <TransportBar
          audio={projectEditor.audio}
          audioRef={transport.audioRef}
          checkRefsLength={projectEditor.checkRefs.length}
          currentTimeMs={transport.currentTimeMs}
          durationMs={transport.durationMs}
          isPlaying={transport.isPlaying}
          onClearCurrentTime={projectEditor.clearCurrentTime}
          onPause={transport.pause}
          onPlay={() => void transport.play()}
          onSeekBy={transport.seekBy}
          onSetCurrentTimeMs={transport.setCurrentTimeMs}
          onSetDurationMs={transport.setDurationMs}
          onSetIsPlaying={transport.setIsPlaying}
          onSetPlaybackPositionMs={transport.setPlaybackPositionMs}
          onStop={transport.stop}
          progress={transport.progress}
          seekStepMs={projectEditor.project.settings.seekStepMs}
          status={projectEditor.status}
        />
      </Box>
    </ThemeProvider>
  );
}

export default App;
