import type { CellPosition, EditorMode, RhythmProject } from "../domain/rhythmProject";

export interface Snapshot {
  project: RhythmProject;
  pointIndex: number;
  selectedCell: CellPosition;
}

export interface SpacePress {
  mode: EditorMode;
  pointIndex: number;
  startedAt: number;
  baseProject?: RhythmProject;
  foldWithPrevious?: boolean;
}

export interface CellContextMenuState {
  mouseX: number;
  mouseY: number;
  position: CellPosition;
}

export interface IssueChip {
  label: string;
  color: "error" | "warning" | "success";
}
