import { describe, expect, it } from "vitest";
import {
  addCheckAtCell,
  applyAutoRuby,
  countJapaneseMora,
  createProjectFromLyrics,
  createRubyCellsForLine,
  deserializeProject,
  findFirstUntimedPointIndex,
  getCheckRefs,
  getRequiredKeyDownCount,
  mergeCellWithNext,
  removeLastCheckAtCell,
  removePreviousTime,
  serializeProject,
  setCellRuby,
  setTimeAtPoint,
  shouldAutoCheck,
  splitGraphemes,
  splitJapaneseMora,
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

  it("counts Japanese mora for kana combinations, small tsu, and long vowels", () => {
    expect(countJapaneseMora("とど")).toBe(2);
    expect(countJapaneseMora("こい")).toBe(2);
    expect(countJapaneseMora("いっ")).toBe(2);
    expect(countJapaneseMora("ぽ")).toBe(1);
    expect(countJapaneseMora("こいごころ")).toBe(5);
    expect(countJapaneseMora("きゃ")).toBe(1);
    expect(countJapaneseMora("っ")).toBe(1);
    expect(countJapaneseMora("ー")).toBe(1);
    expect(splitJapaneseMora("はる")).toEqual(["は", "る"]);
    expect(splitJapaneseMora("きゃっほー")).toEqual(["きゃ", "っ", "ほ", "ー"]);
  });

  it("builds ruby-aware cells and check counts from kuromoji-style tokens", () => {
    const cells = createRubyCellsForLine(
      "届かない恋、いっぽ恋心",
      [
        { surface_form: "届か", reading: "トドカ" },
        { surface_form: "ない", reading: "ナイ" },
        { surface_form: "恋", reading: "コイ" },
        { surface_form: "、", reading: "、" },
        { surface_form: "い", reading: "イ" },
        { surface_form: "っぽ", reading: "ッポ" },
        { surface_form: "恋心", reading: "コイゴコロ" },
      ],
    );

    expect(cells.map((cell) => [cell.text, cell.ruby])).toEqual([
      ["届", "とど"],
      ["か", undefined],
      ["な", undefined],
      ["い", undefined],
      ["恋", "こい"],
      ["、", undefined],
      ["いっ", undefined],
      ["ぽ", undefined],
      ["恋心", "こいごころ"],
    ]);
    expect(cells.map(getRequiredKeyDownCount)).toEqual([2, 1, 1, 1, 2, 0, 2, 1, 5]);
  });

  it("resizes checks when setting ruby manually", () => {
    const project = createProjectFromLyrics("恋");
    const timed = setTimeAtPoint(project, 0, 1200);
    const edited = setCellRuby(timed.project, { lineIndex: 0, cellIndex: 0 }, "こいごころ");
    const refs = getCheckRefs(edited.project);

    expect(refs.filter((ref) => !ref.check.keyUp)).toHaveLength(5);
    expect(refs.filter((ref) => ref.check.keyUp)).toHaveLength(1);
    expect(refs[0].check.timeMs).toBe(1200);
    expect(refs.slice(1, 5).map((ref) => ref.check.timeMs)).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  it("merges a cell with the next cell and redistributes complete timing intervals", () => {
    const project = createProjectFromLyrics("恋心");
    const first = setTimeAtPoint(project, 0, 1000);
    const second = setTimeAtPoint(first.project, first.pointIndex, 2000);
    const merged = mergeCellWithNext(second.project, { lineIndex: 0, cellIndex: 0 });

    expect(merged.project.lines[0].cells.map((cell) => cell.text)).toEqual(["恋心"]);
    expect(getCheckRefs(merged.project).map((ref) => ref.check.timeMs)).toEqual([
      1000,
      2000,
      null,
    ]);
    expect(getCheckRefs(merged.project).map((ref) => ref.check.keyUp)).toEqual([
      false,
      false,
      true,
    ]);
  });

  it("applies auto ruby to the whole project", () => {
    const project = createProjectFromLyrics("届かない恋、いっぽ恋心");
    const result = applyAutoRuby(project, [
      [
        { surface_form: "届か", reading: "トドカ" },
        { surface_form: "ない", reading: "ナイ" },
        { surface_form: "恋", reading: "コイ" },
        { surface_form: "、", reading: "、" },
        { surface_form: "い", reading: "イ" },
        { surface_form: "っぽ", reading: "ッポ" },
        { surface_form: "恋心", reading: "コイゴコロ" },
      ],
    ]);

    expect(result.project.lines[0].cells.map((cell) => cell.text)).toEqual([
      "届",
      "か",
      "な",
      "い",
      "恋",
      "、",
      "いっ",
      "ぽ",
      "恋心",
    ]);
    expect(result.project.lines[0].cells.map(getRequiredKeyDownCount)).toEqual([
      2,
      1,
      1,
      1,
      2,
      0,
      2,
      1,
      5,
    ]);
  });
});
