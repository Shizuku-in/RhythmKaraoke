# RhythmKaraoke

RhythmKaraoke is a Tauri 2 desktop app for timing karaoke lyrics with a
RhythmicaLyrics-inspired workflow:

1. Import audio.
2. Import lyrics.
3. Adjust check points.
4. Play the track and tag checks with timestamps.
5. Save or export a `.json` project file.

## Stack

- TypeScript + React + Vite
- Material UI
- Rust + Tauri 2
- Vitest for core timing/model tests

## Development

```powershell
pnpm install
pnpm dev
pnpm tauri dev
```

## Verification

```powershell
pnpm test
pnpm build
cd src-tauri
cargo check
```

## MVP Notes

- Project files use a versioned JSON editing-state schema.
- Audio playback runs in the frontend via the WebView media element.
- Rust commands provide text decoding and JSON file writing.
- ASS/LRC/KRA export, ruby editing, databases, and Lua-style extension output are
  intentionally deferred.
