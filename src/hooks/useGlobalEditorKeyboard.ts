import { useCallback, useEffect, useRef } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { SpacePress } from "../app/types";
import { currentAudioTimeMs, shouldIgnoreKeyboard } from "../app/utils";
import {
  type CellPosition,
  type CheckRef,
  type EditorMode,
  type RhythmProject,
  addCheckAtCell,
  clearChecksAtCell,
  clearTimeAtPoint,
  formatTime,
  getCheckRefs,
  removeLastCheckAtCell,
  removePreviousTime,
  setKeyUpAtPoint,
  setTimeAtPoint,
} from "../domain/rhythmProject";

export function useGlobalEditorKeyboard(options: {
  audioRef: RefObject<HTMLAudioElement | null>;
  checkRefsLength: number;
  closeRubyEditor: () => void;
  commitProject: (
    nextProject: RhythmProject,
    nextPointIndex?: number,
    nextSelectedCell?: CellPosition,
  ) => void;
  currentRef: CheckRef | null;
  currentTimeMs: number;
  effectiveMode: EditorMode;
  openRubyEditor: () => void;
  pause: () => void;
  play: () => Promise<void>;
  pointIndex: number;
  project: RhythmProject;
  redo: () => void;
  rubyEditorOpen: boolean;
  seekBy: (deltaMs: number) => void;
  selectedCell: CellPosition;
  setPointIndex: (pointIndex: number) => void;
  setProject: Dispatch<SetStateAction<RhythmProject>>;
  setSelectedCell: (position: CellPosition) => void;
  setStatus: (status: string) => void;
  setTemporaryCheckMode: (temporaryCheckMode: boolean) => void;
  stop: () => void;
  undo: () => void;
}) {
  const {
    audioRef,
    checkRefsLength,
    closeRubyEditor,
    commitProject,
    currentRef,
    currentTimeMs,
    effectiveMode,
    openRubyEditor,
    pause,
    play,
    pointIndex,
    project,
    redo,
    rubyEditorOpen,
    seekBy,
    selectedCell,
    setPointIndex,
    setProject,
    setSelectedCell,
    setStatus,
    setTemporaryCheckMode,
    stop,
    undo,
  } = options;
  const spacePressRef = useRef<SpacePress | null>(null);

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
    [audioRef, currentTimeMs],
  );

  const tagPoint = useCallback(
    (index: number, keyUp = false) => {
      if (checkRefsLength === 0) {
        return null;
      }

      const result = stampPoint(project, index, keyUp);
      commitProject(result.project, result.pointIndex, selectedCell);
      setStatus(`Tagged ${formatTime(result.stampedTime)}`);
      return result;
    },
    [checkRefsLength, commitProject, project, selectedCell, setStatus, stampPoint],
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
      audioRef,
      closeRubyEditor,
      commitProject,
      currentRef,
      effectiveMode,
      openRubyEditor,
      pause,
      play,
      pointIndex,
      project,
      redo,
      rubyEditorOpen,
      seekBy,
      selectedCell,
      setTemporaryCheckMode,
      stop,
      tagPoint,
      undo,
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
    [
      commitProject,
      project,
      selectedCell,
      setPointIndex,
      setProject,
      setSelectedCell,
      setStatus,
      setTemporaryCheckMode,
      stampPoint,
    ],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);
}
