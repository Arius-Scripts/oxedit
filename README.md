# ox Item Manager

A standalone web app for editing [ox_inventory](https://github.com/overextended/ox_inventory)
data files (`items.lua`, `weapons.lua`, `shops.lua`, …) and `web/images` — entirely in your
browser. Pick your `ox_inventory` folder, edit items/weapons/shops/crafting/stashes and more,
then export a zip (or write changes straight back to disk).

**Non-destructive by design:** edits are applied as byte-range splices on the original file.
If you change one item's weight, only that line changes — every comment, blank line, `vec3()`,
backtick and function body stays byte-for-byte identical. A re-parse validates every change,
and a GitHub-style diff shows exactly what moved before you commit.

## Features

- **Data editor** — add, remove, modify entries with a schema-driven form + live Monaco preview.
- **Visual shops / crafting editor** — edit blip, inventory, locations and targets without touching Lua, with an "Add property" picker for every supported field.
- **Bulk actions** — multi-select to set a field across many entries or delete them at once.
- **Duplicate & copy** — clone an entry with one click, or copy its Lua to the clipboard.
- **Duplicate detection** — flags keys that appear twice (Lua keeps only the last).
- **1-click templates & presets** — add a new item/weapon/shop from a starter snippet.
- **GitHub-style diff** — per-edit and whole-file (`original → current`) diffs.
- **Revert** — undo stack per file (snapshots kept in IndexedDB).
- **Image optimizer** — resize and re-encode PNGs, detect large images and duplicates (content hash).
- **Export** — downloadable zip of `data/` + `web/images/`, or direct write-back to the folder.

## Loading your folder

- **Drag the `ox_inventory` folder** onto the start screen — works in every browser and reads only `data/` and `web/images/`, so the rest of the resource is never loaded.
- **Open folder** (Chrome / Edge / Opera) uses the File System Access API and additionally lets you save edits straight back to disk.
- **Upload folder** is the fallback for browsers without that API (changes export as a zip).

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # engine + real-file surgical-edit tests
npm run build    # static build -> dist/
```

## Deploy (Vercel)

Framework preset: **Vite**. Build command `npm run build`, output `dist/`. `vercel.json`
rewrites all routes to `/` for the SPA. No environment variables or backend required —
everything runs client-side.

## Architecture

- `src/engine/` — Lua parse → field-map (byte ranges) → splice → re-parse validation, plus per-file schemas. Framework-agnostic; covered by tests.
- `src/services/` — `fileSystem` (folder access + write-back), `zipExport`, `imageOptimizer`, `db` (IndexedDB: folder handle, logs, snapshots).
- `src/stores/appStore.ts` — zustand store tying it together.
- `src/components/`, `src/pages/` — shadcn/ui + Tailwind UI.
