import { Box, Typography } from "@mui/material";
import type { MouseEvent } from "react";
import type {
  CellPosition,
  CheckRef,
  EditorMode,
  RhythmProject,
} from "../domain/rhythmProject";
import { LyricCellView } from "./LyricCellView";

export function LyricsSurface(props: {
  checkRefs: CheckRef[];
  effectiveMode: EditorMode;
  onCellContextMenu: (event: MouseEvent, position: CellPosition) => void;
  onCellSelect: (position: CellPosition) => void;
  pointIndex: number;
  project: RhythmProject;
  registerCellButton: (cellId: string, element: HTMLButtonElement | null) => void;
  selectedCell: CellPosition;
}) {
  const {
    checkRefs,
    effectiveMode,
    onCellContextMenu,
    onCellSelect,
    pointIndex,
    project,
    registerCellButton,
    selectedCell,
  } = props;

  return (
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
                    onSelect={() => onCellSelect({ lineIndex, cellIndex })}
                    onContextMenu={(event) =>
                      onCellContextMenu(event, { lineIndex, cellIndex })
                    }
                    refCallback={(element) => registerCellButton(cell.id, element)}
                  />
                );
              })}
            </Box>
          </Box>
        ))
      )}
    </Box>
  );
}
