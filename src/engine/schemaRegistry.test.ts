import { describe, it, expect } from 'vitest';
import { modelFromSource } from './editModel';
import { resolveImage } from './schemaRegistry';

describe('resolveImage (icon resolution like ox_inventory)', () => {
  it('uses client.image when present, else falls back to <itemName>.png', () => {
    const src = `return {
\t['water'] = { label = 'Water', client = { image = 'aqua.png' } },
\t['bandage'] = { label = 'Bandage' },
}`;
    const { model } = modelFromSource(src);
    expect(resolveImage('items', model, 'water')).toBe('aqua.png');
    // bandage has no client.image -> name-based default (the bug that hid thumbnails)
    expect(resolveImage('items', model, 'bandage')).toBe('bandage.png');
  });

  it('resolves weapon icons from the key, stripping the section prefix', () => {
    const src = `return {
\tWeapons = { ['WEAPON_PISTOL'] = { label = 'Pistol' } },
\tAmmo = { ['ammo-9'] = { label = '9mm' } },
}`;
    const { model } = modelFromSource(src);
    expect(resolveImage('weapons', model, 'Weapons.WEAPON_PISTOL')).toBe('WEAPON_PISTOL.png');
  });

  it('returns nothing for files without icons (shops)', () => {
    const src = `return { General = { name = 'Shop' } }`;
    const { model } = modelFromSource(src);
    expect(resolveImage('shops', model, 'General')).toBeUndefined();
  });
});
