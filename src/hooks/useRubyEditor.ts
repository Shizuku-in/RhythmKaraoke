import { useCallback, useRef, useState } from "react";
import type { CellPosition, RhythmProject } from "../domain/rhythmProject";
import {
  mergeCellWithNext,
  setCellRuby,
} from "../domain/rhythmProject";

export function useRubyEditor(options: {
  commitProject: (
    nextProject: RhythmProject,
    nextPointIndex?: number,
    nextSelectedCell?: CellPosition,
  ) => void;
  focusEditorHost: () => void;
  project: RhythmProject;
  selectedCell: CellPosition;
}) {
  const { commitProject, focusEditorHost, project, selectedCell } = options;
  const [rubyEditorOpen, setRubyEditorOpen] = useState(false);
  const [rubyInput, setRubyInput] = useState("");
  const cellButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const selectedCellData =
    project.lines[selectedCell.lineIndex]?.cells[selectedCell.cellIndex] ?? null;
  const rubyAnchorEl = selectedCellData
    ? cellButtonRefs.current.get(selectedCellData.id) ?? null
    : null;

  const registerCellButton = useCallback(
    (cellId: string, element: HTMLButtonElement | null) => {
      if (element) {
        cellButtonRefs.current.set(cellId, element);
      } else {
        cellButtonRefs.current.delete(cellId);
      }
    },
    [],
  );

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

  const dismissRubyEditor = useCallback(() => {
    setRubyEditorOpen(false);
  }, []);

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

  return {
    closeRubyEditor,
    commitRubyEdit,
    connectSelectedCell,
    dismissRubyEditor,
    openRubyEditor,
    registerCellButton,
    rubyAnchorEl,
    rubyEditorOpen,
    rubyInput,
    setRubyInput,
  };
}
