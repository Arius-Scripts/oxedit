# oxEdit

A free, in-browser editor for [ox_inventory](https://github.com/overextended/ox_inventory) data files.

**Live app:** https://oxedit.vercel.app/

I got tired of hand-editing `items.lua`, `weapons.lua` and friends every time I wanted to add or tweak
something, so I built oxEdit. You point it at your `ox_inventory` folder, edit your items, weapons,
shops, crafting and stashes (plus the `web/images` icons), and then either export a zip or write the
changes straight back to disk.

Everything happens locally in your browser. Nothing gets uploaded anywhere.

## What it does

You edit entries through a schema-driven form with a live Monaco preview, so you can see the Lua it's
going to produce as you type. Shops and crafting also have a visual editor for the blip, inventory,
locations and targets, with an "Add property" picker for every field that's supported, so you don't
have to remember the syntax.

A few things that make it less painful than editing by hand:

- Multi-select a bunch of entries to set a field on all of them, or delete them, in one go.
- Duplicate an entry with one click, or copy its Lua to the clipboard.
- It flags duplicate keys (Lua silently keeps only the last one, which is an easy way to lose data).
- Start new items, weapons or shops from a template or preset instead of an empty block.
- GitHub-style diffs, both per-edit and for the whole file (original vs current).
- An undo stack per file, with snapshots kept in IndexedDB so a refresh doesn't wipe your work.
- An image optimizer that resizes and re-encodes PNGs, and points out images that are oversized or
  duplicated (it compares them by content hash).

When you're done you can download a zip of `data/` and `web/images/`, or save directly back into the
folder you opened.

## Saving

Edits are non-destructive: only the lines you actually change get rewritten, so the rest of your file
stays byte-for-byte the same. Direct write-back uses the browser's File System Access API, so it needs
a Chromium-based browser. Everywhere else, export the zip instead.
