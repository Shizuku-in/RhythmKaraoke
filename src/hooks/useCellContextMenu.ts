import { useCallback, useState } from "react";
import type { MouseEvent } from "react";
import type { CellContextMenuState } from "../app/types";
import type { CellPosition, RhythmProject } from "../domain/rhythmProject";
import {
  addCheckAtCell,
  mergeCellWithNext,
  removeReleaseMarkerAtCell,
} from "../domain/rhythmProject";

export function useCellContextMenu(options: {
  commitProject: (
    nextProject: RhythmProject,
    nextPointIndex?: number,
    nextSelectedCell?: CellPosition,
  ) => void;
  focusEditorHost: () => void;
  handleCellSelect: (position: CellPosition) => void;
  project: RhythmProject;
  dismissRubyEditor: () => void;
  setStatus: (status: string) => void;
}) {
  const {
    commitProject,
    dismissRubyEditor,
    focusEditorHost,
    handleCellSelect,
    project,
    setStatus,
  } = options;
  const [cellContextMenu, setCellContextMenu] =
    useState<CellContextMenuState | null>(null);

  const closeCellContextMenu = useCallback(() => {
    setCellContextMenu(null);
    focusEditorHost();
  }, [focusEditorHost]);

  const handleCellContextMenu = useCallback(
    (event: MouseEvent, position: CellPosition) => {
      event.preventDefault();
      dismissRubyEditor();
      handleCellSelect(position);
      setCellContextMenu({
        mouseX: event.clientX + 2,
        mouseY: event.clientY - 6,
        position,
      });
    },
    [dismissRubyEditor, handleCellSelect],
  );

  const addReleaseMarkerAtContextCell = useCallback(() => {
    const position = cellContextMenu?.position;

    if (!position) {
      return;
    }

    const cell = project.lines[position.lineIndex]?.cells[position.cellIndex];

    if (!cell || cell.checks.some((check) => check.keyUp)) {
      closeCellContextMenu();
      return;
    }

    const result = addCheckAtCell(project, position, true);
    commitProject(result.project, result.pointIndex, position);
    setStatus("Release marker added");
    closeCellContextMenu();
  }, [cellContextMenu, closeCellContextMenu, commitProject, project, setStatus]);

  const removeReleaseMarkerAtContextCell = useCallback(() => {
    const position = cellContextMenu?.position;

    if (!position) {
      return;
    }

    const cell = project.lines[position.lineIndex]?.cells[position.cellIndex];

    if (!cell || !cell.checks.some((check) => check.keyUp)) {
      closeCellContextMenu();
      return;
    }

    const result = removeReleaseMarkerAtCell(project, position);
    commitProject(result.project, result.pointIndex, position);
    setStatus("Release marker removed");
    closeCellContextMenu();
  }, [cellContextMenu, closeCellContextMenu, commitProject, project, setStatus]);

  const connectContextCell = useCallback(() => {
    const position = cellContextMenu?.position;

    if (!position) {
      return;
    }

    const result = mergeCellWithNext(project, position);
    commitProject(result.project, result.pointIndex, result.selectedCell);
    setStatus("Cells connected");
    closeCellContextMenu();
  }, [cellContextMenu, closeCellContextMenu, commitProject, project, setStatus]);

  return {
    addReleaseMarkerAtContextCell,
    cellContextMenu,
    closeCellContextMenu,
    connectContextCell,
    handleCellContextMenu,
    removeReleaseMarkerAtContextCell,
  };
}
