import { useCallback, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Snapshot } from "../app/types";
import { sanitizeFileName } from "../app/utils";
import {
  type CellPosition,
  type EditorMode,
  type RhythmProject,
  clearTimeAtPoint,
  applyAutoRuby,
  clampPointIndex,
  createEmptyProject,
  createProjectFromLyrics,
  deserializeProject,
  findFirstUntimedPointIndex,
  getCheckRefs,
  getFirstCellPosition,
  serializeProject,
  updateAudioMetadata,
  validateProject,
} from "../domain/rhythmProject";
import { tokenizeRubyLines } from "../platform/autoRuby";
import {
  type AudioSelection,
  audioUrlFromPath,
  openAudioFile,
  openLyricsFile,
  openProjectFile,
  saveJsonFile,
} from "../platform/files";

export function useProjectEditor(options: {
  focusEditorHost: () => void;
  onAutoRubyApplied: () => void;
}) {
  const { focusEditorHost, onAutoRubyApplied } = options;
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
  const [status, setStatus] = useState("Ready");
  const [isAutoRubyRunning, setIsAutoRubyRunning] = useState(false);

  const checkRefs = useMemo(() => getCheckRefs(project), [project]);
  const currentRef = checkRefs[pointIndex] ?? null;
  const validationIssues = useMemo(() => validateProject(project), [project]);
  const validationErrors = validationIssues.filter(
    (issue) => issue.severity === "error",
  ).length;
  const validationWarnings = validationIssues.length - validationErrors;
  const effectiveMode: EditorMode = temporaryCheckMode ? "check" : mode;

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
      onAutoRubyApplied();
      setStatus("Auto Ruby applied");
      focusEditorHost();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Auto Ruby failed");
    } finally {
      setIsAutoRubyRunning(false);
    }
  }, [commitProject, focusEditorHost, onAutoRubyApplied, project]);

  const clearCurrentTime = useCallback(() => {
    const result = clearTimeAtPoint(project, pointIndex);
    commitProject(result.project, result.pointIndex, selectedCell);
  }, [commitProject, pointIndex, project, selectedCell]);

  return {
    audio,
    checkRefs,
    clearCurrentTime,
    commitProject,
    currentRef,
    effectiveMode,
    future,
    handleCellSelect,
    history,
    importAudio,
    importLyrics,
    isAutoRubyRunning,
    loadProject,
    mode,
    pointIndex,
    project,
    projectPath,
    redo,
    runAutoRuby,
    saveProject,
    selectedCell,
    setMode,
    setPointIndex,
    setProject: setProject as Dispatch<SetStateAction<RhythmProject>>,
    setSelectedCell,
    setStatus,
    setTemporaryCheckMode,
    status,
    undo,
    validationErrors,
    validationIssues,
    validationWarnings,
  };
}
