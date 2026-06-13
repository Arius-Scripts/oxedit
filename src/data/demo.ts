import type { LoadedDataFile, LoadedImage } from '@/services/fileSystem';

/**
 * A small but realistic ox_inventory dataset used by the "Try with sample data"
 * button so first-time visitors can explore the editor without a folder. The
 * sources mirror real ox_inventory file shapes (keyed items, multi-section
 * weapons, keyed shops, indexed crafting/stashes) so every editor mode is shown.
 */

const items = `return {
	['water'] = {
		label = 'Water',
		weight = 500,
		stack = true,
		close = false,
		client = {
			status = { thirst = 200000 },
			usetime = 1500,
		}
	},

	['bread'] = {
		label = 'Bread',
		weight = 100,
		stack = true,
		close = false,
		client = {
			status = { hunger = 200000 },
			usetime = 2000,
		}
	},

	['burger'] = {
		label = 'Burger',
		weight = 220,
		stack = true,
		close = true,
		client = {
			status = { hunger = 200000 },
			anim = { dict = 'mp_player_inteat@burger', clip = 'mp_player_int_eat_burger_fp' },
			usetime = 2500,
		}
	},

	['phone'] = {
		label = 'Phone',
		weight = 190,
		stack = false,
		close = true,
	},

	['lockpick'] = {
		label = 'Lockpick',
		weight = 100,
		stack = true,
		degrade = 60,
		client = {
			usetime = 5000,
		}
	},

	['bandage'] = {
		label = 'Bandage',
		weight = 115,
		stack = true,
		client = {
			status = { health = 50000 },
			usetime = 2500,
		}
	},
}
`;

const weapons = `return {
	Weapons = {
		['WEAPON_PISTOL'] = {
			label = 'Pistol',
			weight = 1000,
			durability = 0.1,
			ammoname = 'ammo-9',
		},

		['WEAPON_KNIFE'] = {
			label = 'Knife',
			weight = 1000,
		},
	},

	Ammo = {
		['ammo-9'] = {
			label = '9mm Ammo',
			weight = 5,
			stack = true,
		},
	},

	Components = {
		['at_flashlight'] = {
			label = 'Flashlight',
			weight = 120,
			stack = true,
		},
	},
}
`;

const shops = `return {
	General = {
		name = 'General Store',
		blip = { id = 59, colour = 69, scale = 0.8 },
		inventory = {
			{ name = 'water', price = 10 },
			{ name = 'bread', price = 10 },
			{ name = 'burger', price = 15 },
		},
		locations = {
			vec3(25.7, -1347.3, 29.49),
			vec3(-3038.71, 585.9, 7.9),
		},
	},

	LiquorStore = {
		name = 'Liquor Store',
		blip = { id = 93, colour = 1, scale = 0.7 },
		inventory = {
			{ name = 'water', price = 12 },
			{ name = 'bandage', price = 25 },
		},
		locations = {
			vec3(-1222.91, -906.98, 12.33),
		},
	},
}
`;

const crafting = `return {
	{
		name = 'Workbench',
		points = {
			vec3(-1147.08, -2002.66, 13.18),
		},
		items = {
			{
				name = 'lockpick',
				ingredients = { scrapmetal = 5 },
				duration = 5000,
				count = 1,
			},
			{
				name = 'bandage',
				ingredients = { cloth = 3 },
				duration = 4000,
				count = 1,
			},
		},
	},
}
`;

const stashes = `return {
	{
		name = 'personal_locker',
		label = 'Personal Locker',
		owner = true,
		slots = 50,
		weight = 50000,
		coords = vec3(452.3, -991.4, 30.7),
	},
	{
		name = 'society_safe',
		label = 'Society Safe',
		slots = 100,
		weight = 500000,
		coords = vec3(441.7, -981.4, 30.7),
	},
}
`;

export const DEMO_FILES: LoadedDataFile[] = [
  { name: 'items', source: items },
  { name: 'weapons', source: weapons },
  { name: 'shops', source: shops },
  { name: 'crafting', source: crafting },
  { name: 'stashes', source: stashes },
];

// Item names that get a generated placeholder icon so thumbnails appear and the
// Images tab / optimizer are demonstrable.
const DEMO_ICONS: { name: string; colour: string }[] = [
  { name: 'water', colour: '#3aa0ff' },
  { name: 'bread', colour: '#c98a3a' },
  { name: 'burger', colour: '#d9633b' },
  { name: 'phone', colour: '#5b6b78' },
  { name: 'lockpick', colour: '#8a8f98' },
  { name: 'bandage', colour: '#e0556a' },
];

function iconBlob(label: string, colour: string): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = 100;
  c.height = 100;
  const ctx = c.getContext('2d')!;
  const r = 18;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(100, 0, 100, 100, r);
  ctx.arcTo(100, 100, 0, 100, r);
  ctx.arcTo(0, 100, 0, 0, r);
  ctx.arcTo(0, 0, 100, 0, r);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = '600 46px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label.charAt(0).toUpperCase(), 50, 54);
  return new Promise((resolve) => c.toBlob((b) => resolve(b!), 'image/png'));
}

export async function buildDemoImages(): Promise<LoadedImage[]> {
  const out: LoadedImage[] = [];
  for (const { name, colour } of DEMO_ICONS) {
    const blob = await iconBlob(name, colour);
    out.push({ name: `${name}.png`, blob, url: URL.createObjectURL(blob), size: blob.size });
  }
  return out;
}
