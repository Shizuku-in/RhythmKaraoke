import { Alert, Box, Divider, Stack, Typography } from "@mui/material";
import type {
  AudioSelection,
} from "../platform/files";
import type {
  CellPosition,
  CheckRef,
  ValidationIssue,
} from "../domain/rhythmProject";
import { formatTime } from "../domain/rhythmProject";

export function SidePanel(props: {
  audio: AudioSelection | null;
  checkRefsLength: number;
  currentRef: CheckRef | null;
  pointIndex: number;
  projectPath?: string;
  selectedCell: CellPosition;
  validationIssues: ValidationIssue[];
}) {
  const {
    audio,
    checkRefsLength,
    currentRef,
    pointIndex,
    projectPath,
    selectedCell,
    validationIssues,
  } = props;

  return (
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
          Point {checkRefsLength === 0 ? 0 : pointIndex + 1} / {checkRefsLength}
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
  );
}
