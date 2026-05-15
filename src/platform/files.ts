import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

export interface AudioSelection {
  name: string;
  path?: string;
  url: string;
}

export interface TextSelection {
  name: string;
  path?: string;
  contents: string;
  encoding?: string;
}

interface TauriTextPayload {
  path: string;
  name: string;
  contents: string;
  encoding: string;
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);
}

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() || "untitled";
}

function normalizeDialogPath(selection: unknown): string | null {
  if (typeof selection === "string") {
    return selection;
  }

  if (Array.isArray(selection) && typeof selection[0] === "string") {
    return selection[0];
  }

  return null;
}

function pickBrowserFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

function readBrowserTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsText(file);
  });
}

export async function openAudioFile(): Promise<AudioSelection | null> {
  if (isTauriRuntime()) {
    const selection = await open({
      multiple: false,
      directory: false,
      filters: [
        {
          name: "Audio",
          extensions: ["mp3", "wav", "ogg", "m4a", "aac", "flac", "wma"],
        },
      ],
    });
    const path = normalizeDialogPath(selection);

    if (!path) {
      return null;
    }

    return {
      name: fileNameFromPath(path),
      path,
      url: convertFileSrc(path),
    };
  }

  const file = await pickBrowserFile("audio/*");

  if (!file) {
    return null;
  }

  return {
    name: file.name,
    url: URL.createObjectURL(file),
  };
}

export function audioUrlFromPath(path: string): string {
  return isTauriRuntime() ? convertFileSrc(path) : path;
}

export async function openLyricsFile(): Promise<TextSelection | null> {
  if (isTauriRuntime()) {
    const selection = await open({
      multiple: false,
      directory: false,
      filters: [
        {
          name: "Lyrics",
          extensions: ["txt", "lrc", "kra", "json"],
        },
      ],
    });
    const path = normalizeDialogPath(selection);

    if (!path) {
      return null;
    }

    const payload = await invoke<TauriTextPayload>("read_text_file", { path });
    return payload;
  }

  const file = await pickBrowserFile(".txt,.lrc,.kra,.json,text/*");

  if (!file) {
    return null;
  }

  return {
    name: file.name,
    contents: await readBrowserTextFile(file),
    encoding: "browser",
  };
}

export async function openProjectFile(): Promise<TextSelection | null> {
  if (isTauriRuntime()) {
    const selection = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "RhythmKaraoke JSON", extensions: ["json"] }],
    });
    const path = normalizeDialogPath(selection);

    if (!path) {
      return null;
    }

    const payload = await invoke<TauriTextPayload>("read_text_file", { path });
    return payload;
  }

  const file = await pickBrowserFile(".json,application/json");

  if (!file) {
    return null;
  }

  return {
    name: file.name,
    contents: await readBrowserTextFile(file),
    encoding: "browser",
  };
}

export async function saveJsonFile(options: {
  contents: string;
  defaultName: string;
  path?: string;
  forceDialog?: boolean;
}): Promise<string | null> {
  if (isTauriRuntime()) {
    const path =
      !options.forceDialog && options.path
        ? options.path
        : normalizeDialogPath(
            await save({
              defaultPath: options.defaultName,
              filters: [{ name: "RhythmKaraoke JSON", extensions: ["json"] }],
            }),
          );

    if (!path) {
      return null;
    }

    await invoke("write_text_file", { path, contents: options.contents });
    return path;
  }

  const blob = new Blob([options.contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = options.defaultName;
  anchor.click();
  URL.revokeObjectURL(url);
  return null;
}
