import {
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ContentCutIcon from "@mui/icons-material/ContentCut";
import DisabledByDefaultOutlinedIcon from "@mui/icons-material/DisabledByDefaultOutlined";
import SquareOutlinedIcon from "@mui/icons-material/SquareOutlined";
import { useRef } from "react";
import type { CellContextMenuState } from "../app/types";
import type { RhythmProject } from "../domain/rhythmProject";
import { canSplitCell } from "../domain/rhythmProject";

interface CellContextMenuViewState {
  anchorPosition: { left: number; top: number };
  canConnect: boolean;
  canSplit: boolean;
  hasReleaseMarker: boolean;
}

export function CellContextMenu(props: {
  cellContextMenu: CellContextMenuState | null;
  onAddReleaseMarker: () => void;
  onClose: () => void;
  onConnect: () => void;
  onRemoveReleaseMarker: () => void;
  onSplit: () => void;
  project: RhythmProject;
}) {
  const {
    cellContextMenu,
    onAddReleaseMarker,
    onClose,
    onConnect,
    onRemoveReleaseMarker,
    onSplit,
    project,
  } = props;
  const lastViewStateRef = useRef<CellContextMenuViewState | null>(null);

  if (cellContextMenu) {
    const contextCell = project.lines[cellContextMenu.position.lineIndex]?.cells[
        cellContextMenu.position.cellIndex
      ];

    lastViewStateRef.current = {
      anchorPosition: { left: cellContextMenu.mouseX, top: cellContextMenu.mouseY },
      canConnect: Boolean(
        project.lines[cellContextMenu.position.lineIndex]?.cells[
          cellContextMenu.position.cellIndex + 1
        ],
      ),
      canSplit: Boolean(contextCell && canSplitCell(contextCell)),
      hasReleaseMarker: Boolean(
        contextCell?.checks.some((check) => check.keyUp),
      ),
    };
  }

  const viewState = lastViewStateRef.current;
  const hasReleaseMarker = viewState?.hasReleaseMarker ?? false;

  return (
    <Menu
      anchorPosition={viewState?.anchorPosition}
      anchorReference="anchorPosition"
      onClose={onClose}
      open={Boolean(cellContextMenu)}
    >
      <MenuItem
        disabled={!viewState?.canConnect}
        onClick={onConnect}
      >
        <ListItemIcon>
          <AddIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Connect</ListItemText>
      </MenuItem>
      <MenuItem disabled={!viewState?.canSplit} onClick={onSplit}>
        <ListItemIcon>
          <ContentCutIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Split</ListItemText>
      </MenuItem>
      <MenuItem
        onClick={
          hasReleaseMarker
            ? onRemoveReleaseMarker
            : onAddReleaseMarker
        }
        sx={hasReleaseMarker ? { color: "error.main" } : undefined}
      >
        <ListItemIcon sx={hasReleaseMarker ? { color: "error.main" } : undefined}>
          {hasReleaseMarker ? (
            <DisabledByDefaultOutlinedIcon fontSize="small" />
          ) : (
            <SquareOutlinedIcon fontSize="small" />
          )}
        </ListItemIcon>
        <ListItemText>
          {hasReleaseMarker ? "Remove release marker" : "Add release marker"}
        </ListItemText>
      </MenuItem>
    </Menu>
  );
}
