import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { applyEdits, modelFromSource, entryKeys, readField } from './editModel';

const OX =
  'C:/Users/aliar/Desktop/FiveM/Servers/[Developing]/ESX/server-data/resources/[ox]/ox_inventory/data';

const has = existsSync(`${OX}/items.lua`);
const maybe = has ? describe : describe.skip;

maybe('real ox_inventory data', () => {
  it('parses items.lua and surgically edits one field', () => {
    const src = readFileSync(`${OX}/items.lua`, 'utf8');
    const { model } = modelFromSource(src);
    const keys = entryKeys(model);
    expect(keys.length).toBeGreaterThan(10);

    // Pick the first item that has a numeric weight to edit.
    const target = keys.find((k) => typeof readField(model, k, 'weight') === 'number');
    expect(target).toBeTruthy();
    const oldWeight = readField(model, target!, 'weight') as number;

    const next = applyEdits(src, new Map([[`${target}.weight`, oldWeight + 1]]));

    // Re-parses cleanly and the new value is present.
    const re = modelFromSource(next);
    expect(readField(re.model, target!, 'weight')).toBe(oldWeight + 1);

    // Exactly one line differs from the original.
    const a = src.split('\n');
    const b = next.split('\n');
    const changed = a.map((l, i) => [l, b[i]]).filter(([x, y]) => x !== y);
    expect(changed.length).toBe(1);
    expect(b.length).toBe(a.length); // no lines added/removed
  });

  it('parses every shipped data file without error', () => {
    for (const name of ['items', 'weapons', 'shops', 'crafting', 'stashes', 'vehicles', 'animations', 'licenses', 'evidence']) {
      const p = `${OX}/${name}.lua`;
      if (!existsSync(p)) continue;
      const src = readFileSync(p, 'utf8');
      expect(() => modelFromSource(src)).not.toThrow();
    }
  });
});
