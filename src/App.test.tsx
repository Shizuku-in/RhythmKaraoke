/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const { openLyricsFile } = vi.hoisted(() => ({
  openLyricsFile: vi.fn(),
}));

vi.mock("./platform/files", () => ({
  audioUrlFromPath: (path: string) => path,
  openAudioFile: vi.fn(),
  openLyricsFile,
  openProjectFile: vi.fn(),
  saveJsonFile: vi.fn(),
}));

vi.mock("./platform/autoRuby", () => ({
  tokenizeRubyLines: vi.fn(async () => [[]]),
}));

describe("ruby editor", () => {
  beforeEach(() => {
    openLyricsFile.mockResolvedValue({
      contents: "恋心",
      name: "sample.txt",
    });
  });

  afterEach(() => {
    cleanup();
    openLyricsFile.mockClear();
  });

  it("opens with F2, autofocuses, commits with Enter, and restores editor focus", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /lyrics/i }));
    await user.keyboard("{F2}");

    const input = await screen.findByRole("textbox", { name: "Ruby" });
    expect(input).toHaveFocus();

    await user.type(input, "こい");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(document.activeElement).toHaveClass("editor-pane");
    expect(screen.getByText("こい")).toBeInTheDocument();
  });

  it("closes with Esc without committing and restores editor focus", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /lyrics/i }));
    await user.keyboard("{F2}");
    await user.type(await screen.findByRole("textbox", { name: "Ruby" }), "こい");
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(document.activeElement).toHaveClass("editor-pane");
    expect(screen.queryByText("こい")).not.toBeInTheDocument();
  });

  it("keeps the popper open after connecting cells and refreshes the selected cell", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /lyrics/i }));
    await user.keyboard("{F2}");
    await user.click(await screen.findByRole("button", { name: /连接/ }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /恋心/ })).toBeInTheDocument();
    expect(document.activeElement).toHaveClass("editor-pane");
  });
});
