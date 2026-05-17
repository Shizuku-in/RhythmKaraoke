import { Box, Chip, Divider, Stack, Typography } from "@mui/material";
import TimerIcon from "@mui/icons-material/Timer";
import type { MouseEvent, RefObject } from "react";
import type { IssueChip } from "../app/types";
import type {
  CellPosition,
  CheckRef,
  EditorMode,
  RhythmProject,
} from "../domain/rhythmProject";
import { LyricsSurface } from "./LyricsSurface";

export function EditorPane(props: {
  checkRefs: CheckRef[];
  editorHostRef: RefObject<HTMLDivElement | null>;
  effectiveMode: EditorMode;
  issueChip: IssueChip;
  onCellContextMenu: (event: MouseEvent, position: CellPosition) => void;
  onCellSelect: (position: CellPosition) => void;
  pointIndex: number;
  project: RhythmProject;
  registerCellButton: (cellId: string, element: HTMLButtonElement | null) => void;
  selectedCell: CellPosition;
}) {
  const {
    checkRefs,
    editorHostRef,
    effectiveMode,
    issueChip,
    onCellContextMenu,
    onCellSelect,
    pointIndex,
    project,
    registerCellButton,
    selectedCell,
  } = props;

  return (
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
      <LyricsSurface
        checkRefs={checkRefs}
        effectiveMode={effectiveMode}
        onCellContextMenu={onCellContextMenu}
        onCellSelect={onCellSelect}
        pointIndex={pointIndex}
        project={project}
        registerCellButton={registerCellButton}
        selectedCell={selectedCell}
      />
    </Box>
  );
}
