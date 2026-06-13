import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { parseLuaValue, serializeLuaValue, mapGet, type LuaVal } from './luaObject';

const OX =
  'C:/Users/aliar/Desktop/FiveM/Servers/[Developing]/ESX/server-data/resources/[ox]/ox_inventory/data';

describe('lua value codec', () => {
  const shop = `{
\tname = 'Test shop',
\tblip = { id = 59, colour = 69, scale = 0.8 },
\tinventory = {
\t\t{ name = 'water', price = 10 },
\t\t{ name = 'cola', price = 10, license = 'weapon' },
\t},
\tlocations = { vec3(1.0, 2.0, -3.5) },
\tgroups = shared.police,
}`;

  it('parses scalars, vec3, arrays, nested maps and raw expressions', () => {
    const v = parseLuaValue(shop);
    expect(v.t).toBe('map');
    expect(mapGet(v, 'name')).toEqual({ t: 'str', v: 'Test shop' });
    expect(mapGet(mapGet(v, 'blip')!, 'id')).toEqual({ t: 'num', v: 59 });
    const inv = mapGet(v, 'inventory') as LuaVal;
    expect(inv.t).toBe('arr');
    expect((inv as any).v.length).toBe(2);
    const loc = mapGet(v, 'locations') as any;
    expect(loc.v[0]).toEqual({ t: 'vec3', v: [1, 2, -3.5] });
    expect(mapGet(v, 'groups')).toEqual({ t: 'raw', v: 'shared.police' });
  });

  it('round-trips: serialize then re-parse yields the same tree', () => {
    const v = parseLuaValue(shop);
    const s = serializeLuaValue(v);
    const v2 = parseLuaValue(s);
    expect(v2).toEqual(v);
  });

  const has = existsSync(`${OX}/shops.lua`);
  (has ? it : it.skip)('round-trips real shops.lua and crafting.lua', () => {
    for (const name of ['shops', 'crafting']) {
      const raw = readFileSync(`${OX}/${name}.lua`, 'utf8').replace(/^\s*return\s*/, '');
      const v = parseLuaValue(raw);
      const s = serializeLuaValue(v);
      const v2 = parseLuaValue(s); // must not throw and must be stable
      expect(serializeLuaValue(v2)).toBe(s);
    }
  });
});
