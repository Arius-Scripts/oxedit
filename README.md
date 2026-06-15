# oxEdit — ox_inventory item, weapon & shop editor

**Live:** https://oxedit.vercel.app/

oxEdit is a free, standalone web app for editing
[ox_inventory](https://github.com/overextended/ox_inventory) data files
(`items.lua`, `weapons.lua`, `shops.lua`, `crafting.lua`, `stashes.lua`) and `web/images` —
entirely in your browser. Pick your `ox_inventory` folder, edit items / weapons / shops /
crafting / stashes and item images, then export a zip (or write changes straight back to disk).
Nothing is uploaded — everything runs client-side.

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

