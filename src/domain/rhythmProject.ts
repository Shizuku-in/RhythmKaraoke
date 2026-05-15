export type EditorMode = "check" | "tag";

export type Severity = "error" | "warning";

export interface ProjectMetadata {
  title: string;
  audio?: {
    path?: string;
    name: string;
  };
  lyricsSource?: {
    path?: string;
    name: string;
    encoding?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSettings {
  rewindOnDeleteMs: number;
  seekStepMs: number;
  inputOffsetMs: number;
  minGapMs: number;
}

export interface CheckPoint {
  id: string;
  timeMs: number | null;
  keyUp: boolean;
}

export interface LyricCell {
  id: string;
  text: string;
  checks: CheckPoint[];
  timeMs: number | null;
  keyUp: boolean;
  ruby?: string;
  ass?: Record<string, unknown>;
}

export interface LyricLine {
  id: string;
  text: string;
  cells: LyricCell[];
}

export interface RhythmProject {
  schemaVersion: 1;
  metadata: ProjectMetadata;
  settings: ProjectSettings;
  lines: LyricLine[];
}

export interface CellPosition {
  lineIndex: number;
  cellIndex: number;
}

export interface CheckRef extends CellPosition {
  checkIndex: number;
  check: CheckPoint;
  cell: LyricCell;
}

export interface ValidationIssue {
  severity: Severity;
  message: string;
  ref?: Pick<CheckRef, "lineIndex" | "cellIndex" | "checkIndex">;
}

export interface EditResult {
  project: RhythmProject;
  pointIndex: number;
}

const DEFAULT_SETTINGS: ProjectSettings = {
  rewindOnDeleteMs: 3000,
  seekStepMs: 3000,
  inputOffsetMs: -23,
  minGapMs: 40,
};

let idCounter = 0;

function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter.toString(36)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function createEmptyProject(): RhythmProject {
  const timestamp = nowIso();

  return {
    schemaVersion: 1,
    metadata: {
      title: "Untitled",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    settings: { ...DEFAULT_SETTINGS },
    lines: [],
  };
}

export function splitGraphemes(text: string): string[] {
  const segmenterCtor = (Intl as unknown as {
    Segmenter?: new (
      locale?: string,
      options?: { granularity: "grapheme" },
    ) => { segment(input: string): Iterable<{ segment: string }> };
  }).Segmenter;

  if (segmenterCtor) {
    const segmenter = new segmenterCtor(undefined, { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), (part) => part.segment);
  }

  return Array.from(text);
}

function isAsciiWord(grapheme: string): boolean {
  return /^[A-Za-z0-9]$/.test(grapheme);
}

function isAsciiWordPart(grapheme: string): boolean {
  return /^[A-Za-z0-9']$/.test(grapheme);
}

function isBoundarySpace(grapheme: string): boolean {
  return grapheme === " " || grapheme === "\u3000";
}

function isCjkOrKanaOrHangul(grapheme: string): boolean {
  return (
    /^\p{Script=Han}$/u.test(grapheme) ||
    /^\p{Script=Hiragana}$/u.test(grapheme) ||
    /^\p{Script=Katakana}$/u.test(grapheme) ||
    /^\p{Script=Hangul}$/u.test(grapheme)
  );
}

function isSingableEnd(grapheme: string): boolean {
  return isCjkOrKanaOrHangul(grapheme) || isAsciiWord(grapheme);
}

export function shouldAutoCheck(
  grapheme: string,
  previousGrapheme: string | null,
): boolean {
  if (/^\s$/u.test(grapheme)) {
    return false;
  }

  if (isCjkOrKanaOrHangul(grapheme)) {
    return true;
  }

  if (isAsciiWord(grapheme)) {
    return previousGrapheme === null || !isAsciiWordPart(previousGrapheme);
  }

  return false;
}

function createCheck(keyUp = false): CheckPoint {
  return {
    id: nextId("check"),
    timeMs: null,
    keyUp,
  };
}

function orderChecks(checks: CheckPoint[]): CheckPoint[] {
  return [
    ...checks.filter((check) => !check.keyUp),
    ...checks.filter((check) => check.keyUp),
  ];
}

function orderChecksWithIndexes(
  checks: CheckPoint[],
): Array<{ check: CheckPoint; checkIndex: number }> {
  return checks
    .map((check, checkIndex) => ({ check, checkIndex }))
    .sort((left, right) => Number(left.check.keyUp) - Number(right.check.keyUp));
}

function createCell(grapheme: string, previousGrapheme: string | null): LyricCell {
  const checks = shouldAutoCheck(grapheme, previousGrapheme)
    ? [createCheck()]
    : [];

  return {
    id: nextId("cell"),
    text: grapheme,
    checks,
    timeMs: null,
    keyUp: false,
  };
}

function findPreviousSingableCell(
  cells: LyricCell[],
  startIndex: number,
): number | null {
  for (let index = startIndex; index >= 0; index -= 1) {
    if (isSingableEnd(cells[index].text)) {
      return index;
    }
  }

  return null;
}

function addReleaseCheckTargets(cells: LyricCell[]): LyricCell[] {
  const targetIndexes = new Set<number>();

  cells.forEach((cell, index) => {
    if (isBoundarySpace(cell.text)) {
      const targetIndex = findPreviousSingableCell(cells, index - 1);

      if (targetIndex !== null) {
        targetIndexes.add(targetIndex);
      }
    }
  });

  const endTargetIndex = findPreviousSingableCell(cells, cells.length - 1);

  if (endTargetIndex !== null) {
    targetIndexes.add(endTargetIndex);
  }

  return cells.map((cell, index) => {
    if (!targetIndexes.has(index)) {
      return cell;
    }

    if (cell.checks.some((check) => check.keyUp)) {
      return cell;
    }

    return {
      ...cell,
      checks: [...cell.checks, createCheck(true)],
    };
  });
}

export function createProjectFromLyrics(
  lyrics: string,
  source?: { name: string; path?: string; encoding?: string },
): RhythmProject {
  const normalized = lyrics.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rawLines = normalized.length > 0 ? normalized.split("\n") : [""];
  const project = createEmptyProject();

  project.metadata.title = source?.name?.replace(/\.[^.]+$/, "") || "Untitled";
  project.metadata.lyricsSource = source;
  project.lines = rawLines.map((lineText) => {
    let previous: string | null = null;
    const cells = splitGraphemes(lineText).map((grapheme) => {
      const cell = createCell(grapheme, previous);
      previous = grapheme;
      return cell;
    });

    return {
      id: nextId("line"),
      text: lineText,
      cells: addReleaseCheckTargets(cells),
    };
  });

  return touchProject(project);
}

function touchProject(project: RhythmProject): RhythmProject {
  return {
    ...project,
    metadata: {
      ...project.metadata,
      updatedAt: nowIso(),
    },
  };
}

function normalizeCell(cell: LyricCell): LyricCell {
  const checks = orderChecks(cell.checks);
  const firstTimed = checks.find((check) => check.timeMs !== null);

  return {
    ...cell,
    checks,
    timeMs: firstTimed?.timeMs ?? null,
    keyUp: checks.some((check) => check.keyUp),
  };
}

function updateCell(
  project: RhythmProject,
  position: CellPosition,
  updater: (cell: LyricCell) => LyricCell,
): RhythmProject {
  const line = project.lines[position.lineIndex];
  const cell = line?.cells[position.cellIndex];

  if (!line || !cell) {
    return project;
  }

  const nextLines = project.lines.map((currentLine, lineIndex) => {
    if (lineIndex !== position.lineIndex) {
      return currentLine;
    }

    return {
      ...currentLine,
      cells: currentLine.cells.map((currentCell, cellIndex) =>
        cellIndex === position.cellIndex
          ? normalizeCell(updater(currentCell))
          : currentCell,
      ),
    };
  });

  return touchProject({ ...project, lines: nextLines });
}

export function getCheckRefs(project: RhythmProject): CheckRef[] {
  return project.lines.flatMap((line, lineIndex) =>
    line.cells.flatMap((cell, cellIndex) =>
      orderChecksWithIndexes(cell.checks).map(({ check, checkIndex }) => ({
        lineIndex,
        cellIndex,
        checkIndex,
        check,
        cell,
      })),
    ),
  );
}

export function clampPointIndex(project: RhythmProject, pointIndex: number): number {
  const refs = getCheckRefs(project);

  if (refs.length === 0) {
    return 0;
  }

  return Math.max(0, Math.min(pointIndex, refs.length - 1));
}

export function getFirstCellPosition(project: RhythmProject): CellPosition {
  for (let lineIndex = 0; lineIndex < project.lines.length; lineIndex += 1) {
    if (project.lines[lineIndex].cells.length > 0) {
      return { lineIndex, cellIndex: 0 };
    }
  }

  return { lineIndex: 0, cellIndex: 0 };
}

export function findFirstUntimedPointIndex(project: RhythmProject): number {
  const refs = getCheckRefs(project);
  const index = refs.findIndex((ref) => ref.check.timeMs === null);
  return index === -1 ? Math.max(0, refs.length - 1) : index;
}

export function addCheckAtCell(
  project: RhythmProject,
  position: CellPosition,
  keyUp = false,
): EditResult {
  let addedCheckId: string | null = null;
  const nextProject = updateCell(project, position, (cell) => {
    const check = createCheck(keyUp);
    const releaseIndex = cell.checks.findIndex((currentCheck) => currentCheck.keyUp);
    addedCheckId = check.id;

    if (keyUp || releaseIndex === -1) {
      return { ...cell, checks: [...cell.checks, check] };
    }

    return {
      ...cell,
      checks: [
        ...cell.checks.slice(0, releaseIndex),
        check,
        ...cell.checks.slice(releaseIndex),
      ],
    };
  });

  const refs = getCheckRefs(nextProject);
  const pointIndex = refs.findIndex((ref) => ref.check.id === addedCheckId);

  return {
    project: nextProject,
    pointIndex: pointIndex === -1 ? 0 : pointIndex,
  };
}

export function removeLastCheckAtCell(
  project: RhythmProject,
  position: CellPosition,
): EditResult {
  const nextProject = updateCell(project, position, (cell) => {
    let removableIndex = -1;

    for (let index = cell.checks.length - 1; index >= 0; index -= 1) {
      if (!cell.checks[index].keyUp) {
        removableIndex = index;
        break;
      }
    }

    const index =
      removableIndex === -1 ? cell.checks.length - 1 : removableIndex;

    if (index < 0) {
      return cell;
    }

    return {
      ...cell,
      checks: cell.checks.filter((_, checkIndex) => checkIndex !== index),
    };
  });

  return {
    project: nextProject,
    pointIndex: clampPointIndex(nextProject, findFirstUntimedPointIndex(nextProject)),
  };
}

export function clearChecksAtCell(
  project: RhythmProject,
  position: CellPosition,
): EditResult {
  const nextProject = updateCell(project, position, (cell) => ({
    ...cell,
    checks: [],
  }));

  return {
    project: nextProject,
    pointIndex: clampPointIndex(nextProject, findFirstUntimedPointIndex(nextProject)),
  };
}

function updateCheckAtPoint(
  project: RhythmProject,
  pointIndex: number,
  updater: (check: CheckPoint) => CheckPoint,
): RhythmProject {
  const refs = getCheckRefs(project);
  const ref = refs[pointIndex];

  if (!ref) {
    return project;
  }

  return updateCell(project, ref, (cell) => ({
    ...cell,
    checks: cell.checks.map((check, checkIndex) =>
      checkIndex === ref.checkIndex ? updater(check) : check,
    ),
  }));
}

export function setTimeAtPoint(
  project: RhythmProject,
  pointIndex: number,
  timeMs: number,
  keyUp?: boolean,
): EditResult {
  const nextProject = updateCheckAtPoint(project, pointIndex, (check) => ({
    ...check,
    timeMs: Math.max(0, Math.round(timeMs)),
    keyUp: keyUp ?? check.keyUp,
  }));

  return {
    project: nextProject,
    pointIndex: clampPointIndex(nextProject, pointIndex + 1),
  };
}

export function clearTimeAtPoint(
  project: RhythmProject,
  pointIndex: number,
): EditResult {
  const nextProject = updateCheckAtPoint(project, pointIndex, (check) => ({
    ...check,
    timeMs: null,
  }));

  return {
    project: nextProject,
    pointIndex: clampPointIndex(nextProject, pointIndex),
  };
}

export function setKeyUpAtPoint(
  project: RhythmProject,
  pointIndex: number,
  keyUp: boolean,
): EditResult {
  const nextProject = updateCheckAtPoint(project, pointIndex, (check) => ({
    ...check,
    keyUp,
  }));

  return {
    project: nextProject,
    pointIndex: clampPointIndex(nextProject, pointIndex),
  };
}

export function removePreviousTime(
  project: RhythmProject,
  pointIndex: number,
): EditResult & { seekMs: number } {
  const refs = getCheckRefs(project);
  const startIndex = Math.min(pointIndex, refs.length - 1);
  let targetIndex = -1;

  for (let index = startIndex; index >= 0; index -= 1) {
    if (refs[index].check.timeMs !== null) {
      targetIndex = index;
      break;
    }
  }

  if (targetIndex === -1) {
    return { project, pointIndex: clampPointIndex(project, pointIndex), seekMs: 0 };
  }

  const removedTime = refs[targetIndex].check.timeMs ?? 0;
  const result = clearTimeAtPoint(project, targetIndex);

  return {
    ...result,
    pointIndex: targetIndex,
    seekMs: Math.max(0, removedTime - project.settings.rewindOnDeleteMs),
  };
}

export function validateProject(project: RhythmProject): ValidationIssue[] {
  const refs = getCheckRefs(project);
  const issues: ValidationIssue[] = [];
  let previousTime: number | null = null;

  refs.forEach((ref) => {
    const location = `line ${ref.lineIndex + 1}, cell ${ref.cellIndex + 1}`;

    if (ref.check.timeMs === null) {
      issues.push({
        severity: "warning",
        message: `Missing time at ${location}.`,
        ref,
      });
      return;
    }

    if (previousTime !== null) {
      if (ref.check.timeMs < previousTime) {
        issues.push({
          severity: "error",
          message: `Time moves backward at ${location}.`,
          ref,
        });
      } else if (ref.check.timeMs - previousTime < project.settings.minGapMs) {
        issues.push({
          severity: "warning",
          message: `Time gap is under ${project.settings.minGapMs}ms at ${location}.`,
          ref,
        });
      }
    }

    previousTime = ref.check.timeMs;
  });

  return issues;
}

export function updateAudioMetadata(
  project: RhythmProject,
  audio: { path?: string; name: string },
): RhythmProject {
  return touchProject({
    ...project,
    metadata: {
      ...project.metadata,
      audio,
    },
  });
}

export function serializeProject(project: RhythmProject): string {
  return `${JSON.stringify(touchProject(project), null, 2)}\n`;
}

export function deserializeProject(contents: string): RhythmProject {
  const parsed = JSON.parse(contents) as RhythmProject;

  if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.lines)) {
    throw new Error("Unsupported RhythmKaraoke project file.");
  }

  return {
    ...parsed,
    settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
    lines: parsed.lines.map((line) => ({
      ...line,
      cells: line.cells.map((cell) =>
        normalizeCell({
          ...cell,
          checks: cell.checks ?? [],
          timeMs: cell.timeMs ?? null,
          keyUp: cell.keyUp ?? false,
        }),
      ),
    })),
  };
}

export function formatTime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) {
    return "--:--.---";
  }

  const safeMs = Math.max(0, Math.round(ms));
  const minutes = Math.floor(safeMs / 60000);
  const seconds = Math.floor((safeMs % 60000) / 1000);
  const millis = safeMs % 1000;

  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}.${millis.toString().padStart(3, "0")}`;
}
