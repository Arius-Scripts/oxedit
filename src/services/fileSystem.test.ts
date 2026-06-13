import { describe, it, expect, beforeAll } from 'vitest';
import { readUpload } from './fileSystem';

// Minimal File-like stub (avoids needing jsdom for URL/Blob plumbing).
function fakeFile(relPath: string, content = '', size = content.length) {
  const name = relPath.split('/').pop()!;
  return {
    name,
    size,
    webkitRelativePath: relPath,
    text: async () => content,
  } as any;
}

beforeAll(() => {
  // readUpload calls URL.createObjectURL for images.
  (globalThis as any).URL.createObjectURL = () => 'blob:stub';
});

describe('folder-upload fallback', () => {
  it('finds data files and images under <root>/data and <root>/web/images', async () => {
    const picked = [
      fakeFile('ox_inventory/data/items.lua', 'return { }'),
      fakeFile('ox_inventory/data/weapons.lua', 'return { Weapons = {}, Ammo = {} }'),
      fakeFile('ox_inventory/fxmanifest.lua', 'x'),
      fakeFile('ox_inventory/web/images/water.png', 'png', 1234),
      fakeFile('ox_inventory/web/images/burger.png', 'png', 999),
      fakeFile('ox_inventory/readme.md', 'x'),
    ];
    const { files, images } = await readUpload(picked);
    expect(files.map((f) => f.name).sort()).toEqual(['items', 'weapons']);
    expect(files.find((f) => f.name === 'items')!.source).toBe('return { }');
    expect(images.map((i) => i.name)).toEqual(['burger.png', 'water.png']);
    expect(images[0].size).toBe(999);
  });

  it('works when the data folder itself is selected', async () => {
    const picked = [fakeFile('data/items.lua', 'return { }'), fakeFile('data/shops.lua', 'return { }')];
    const { files } = await readUpload(picked);
    expect(files.map((f) => f.name).sort()).toEqual(['items', 'shops']);
  });

  it('throws a helpful error when no data files are present', async () => {
    await expect(readUpload([fakeFile('random/foo.txt', 'x')])).rejects.toThrow(/ox_inventory/);
  });
});
