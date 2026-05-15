import { describe, expect, it } from "vitest";
import {
  addCheckAtCell,
  createProjectFromLyrics,
  deserializeProject,
  findFirstUntimedPointIndex,
  getCheckRefs,
  removeLastCheckAtCell,
  removePreviousTime,
  serializeProject,
  setTimeAtPoint,
  shouldAutoCheck,
  splitGraphemes,
  validateProject,
} from "./rhythmProject";

describe("rhythm project model", () => {
  it("splits text into grapheme-like editing cells", () => {
    expect(splitGraphemes("A\u0301中")).toEqual(["A\u0301", "中"]);
  });

  it("uses conservative automatic checks", () => {
    expect(shouldAutoCheck("答", null)).toBe(true);
    expect(shouldAutoCheck("ア", null)).toBe(true);
    expect(shouldAutoCheck("a", null)).toBe(true);
    expect(shouldAutoCheck("l", "a")).toBe(false);
    expect(shouldAutoCheck("!", "a")).toBe(false);
    expect(shouldAutoCheck(" ", "a")).toBe(false);
  });

  it("creates checks for CJK characters and English word starts", () => {
    const project = createProjectFromLyrics("答えはいつも\nYou'll be right");
    const refs = getCheckRefs(project);

    expect(project.lines).toHaveLength(2);
    expect(refs.map((ref) => ref.cell.text)).toEqual([
      "答",
      "え",
      "は",
      "い",
      "つ",
      "も",
      "も",
      "Y",
      "l",
      "b",
      "e",
      "r",
      "t",
    ]);
    expect(refs.filter((ref) => ref.check.keyUp).map((ref) => ref.cell.text)).toEqual([
      "も",
      "l",
      "e",
      "t",
    ]);
  });

  it("adds release checks before half-width spaces, full-width spaces, and line breaks", () => {
    const project = createProjectFromLyrics("霞える唇から 漏れ出す　吐息もまた。");
    const releaseCells = getCheckRefs(project)
      .filter((ref) => ref.check.keyUp)
      .map((ref) => ref.cell.text);

    expect(releaseCells).toEqual(["ら", "す", "た"]);
  });

  it("keeps added beat markers before the release marker", () => {
    const project = createProjectFromLyrics("た ");
    const added = addCheckAtCell(project, { lineIndex: 0, cellIndex: 0 });
    const refs = getCheckRefs(added.project);

    expect(refs.map((ref) => ref.check.keyUp)).toEqual([false, false, true]);
  });

  it("removes added beat markers before removing release markers", () => {
    const project = createProjectFromLyrics("た ");
    const added = addCheckAtCell(project, { lineIndex: 0, cellIndex: 0 });
    const removed = removeLastCheckAtCell(added.project, {
      lineIndex: 0,
      cellIndex: 0,
    });
    const refs = getCheckRefs(removed.project);

    expect(refs.map((ref) => ref.check.keyUp)).toEqual([false, true]);
  });

  it("adds manual checks and round-trips JSON", () => {
    const project = createProjectFromLyrics("abc");
    const result = addCheckAtCell(project, { lineIndex: 0, cellIndex: 1 });
    const serialized = serializeProject(result.project);
    const parsed = deserializeProject(serialized);

    expect(getCheckRefs(parsed)).toHaveLength(3);
    expect(getCheckRefs(parsed)[result.pointIndex].cell.text).toBe("b");
  });

  it("sets timing in sequence and leaves the release point empty", () => {
    const project = createProjectFromLyrics("春日");
    const first = setTimeAtPoint(project, 0, 1000);
    const second = setTimeAtPoint(first.project, first.pointIndex, 1800);

    expect(findFirstUntimedPointIndex(second.project)).toBe(2);
    expect(validateProject(second.project)).toHaveLength(1);
  });

  it("detects backward timing", () => {
    const project = createProjectFromLyrics("春日");
    const first = setTimeAtPoint(project, 0, 1200);
    const second = setTimeAtPoint(first.project, first.pointIndex, 800);
    const issues = validateProject(second.project);

    expect(issues.some((issue) => issue.severity === "error")).toBe(true);
  });

  it("removes the previous timestamp and reports a rewind target", () => {
    const project = createProjectFromLyrics("春日");
    const first = setTimeAtPoint(project, 0, 4500);
    const second = setTimeAtPoint(first.project, first.pointIndex, 5400);
    const removed = removePreviousTime(second.project, second.pointIndex);

    expect(removed.pointIndex).toBe(1);
    expect(removed.seekMs).toBe(2400);
    expect(getCheckRefs(removed.project)[1].check.timeMs).toBeNull();
  });
});
