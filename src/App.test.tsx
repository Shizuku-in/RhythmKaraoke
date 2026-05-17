/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
      contents: "あい",
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

    await user.type(input, "koi");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(document.activeElement).toHaveClass("editor-pane");
    expect(
      screen.getByText((_, element) =>
        Boolean(
          element?.classList.contains("cell-ruby") && element.textContent === "koi",
        ),
      ),
    ).toBeInTheDocument();
  });

  it("closes with Esc without committing and restores editor focus", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /lyrics/i }));
    await user.keyboard("{F2}");
    await user.type(await screen.findByRole("textbox", { name: "Ruby" }), "koi");
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(document.activeElement).toHaveClass("editor-pane");
    expect(screen.queryByText("koi")).not.toBeInTheDocument();
  });

  it("closes when clicking away", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /lyrics/i }));
    await user.keyboard("{F2}");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByText("RhythmKaraoke"));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(document.activeElement).toHaveClass("editor-pane");
  });

  it("keeps the popper open after connecting cells and refreshes the selected cell", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    await user.click(screen.getByRole("button", { name: /lyrics/i }));
    await user.keyboard("{F2}");
    const dialog = await screen.findByRole("dialog");
    const connectButton = dialog.querySelector(".ruby-connect-button");
    expect(connectButton).toBeInstanceOf(HTMLElement);
    await user.click(connectButton as HTMLElement);

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(container.querySelectorAll(".lyric-cell")).toHaveLength(1);
    expect(document.activeElement).toHaveClass("editor-pane");
  });

  it("adds a release marker from the cell context menu", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    await user.click(screen.getByRole("button", { name: /lyrics/i }));

    const firstCell = container.querySelector(".lyric-cell");
    expect(firstCell).toBeInstanceOf(HTMLElement);
    expect(firstCell?.querySelector(".check-mark.release")).toBeNull();

    fireEvent.contextMenu(firstCell as HTMLElement, {
      clientX: 120,
      clientY: 160,
    });
    await user.click(await screen.findByRole("menuitem", { name: "Add release marker" }));

    expect(firstCell?.querySelector(".check-mark.release")).toBeInTheDocument();
  });

  it("removes a release marker from the cell context menu", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    await user.click(screen.getByRole("button", { name: /lyrics/i }));

    const cells = container.querySelectorAll(".lyric-cell");
    const lastCell = cells[cells.length - 1];
    expect(lastCell).toBeInstanceOf(HTMLElement);
    expect(lastCell?.querySelector(".check-mark.release")).toBeInTheDocument();

    fireEvent.contextMenu(lastCell as HTMLElement, {
      clientX: 120,
      clientY: 160,
    });
    await user.click(await screen.findByRole("menuitem", { name: "Remove release marker" }));

    expect(lastCell?.querySelector(".check-mark.release")).toBeNull();
  });

  it("connects cells from the cell context menu", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    await user.click(screen.getByRole("button", { name: /lyrics/i }));

    const firstCell = container.querySelector(".lyric-cell");
    expect(firstCell).toBeInstanceOf(HTMLElement);

    fireEvent.contextMenu(firstCell as HTMLElement, {
      clientX: 120,
      clientY: 160,
    });
    await user.click(await screen.findByRole("menuitem", { name: "Connect" }));

    expect(container.querySelectorAll(".lyric-cell")).toHaveLength(1);
  });

  it("splits cells from the cell context menu", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    await user.click(screen.getByRole("button", { name: /lyrics/i }));

    const firstCell = container.querySelector(".lyric-cell");
    expect(firstCell).toBeInstanceOf(HTMLElement);

    fireEvent.contextMenu(firstCell as HTMLElement, {
      clientX: 120,
      clientY: 160,
    });
    await user.click(await screen.findByRole("menuitem", { name: "Connect" }));
    expect(container.querySelectorAll(".lyric-cell")).toHaveLength(1);

    const mergedCell = container.querySelector(".lyric-cell");
    expect(mergedCell).toBeInstanceOf(HTMLElement);

    fireEvent.contextMenu(mergedCell as HTMLElement, {
      clientX: 120,
      clientY: 160,
    });
    await user.click(await screen.findByRole("menuitem", { name: "Split" }));

    expect(container.querySelectorAll(".lyric-cell")).toHaveLength(2);
  });
});
