import type { DataFileName } from '@/services/fileSystem';

export interface Preset {
  /** stable id for the card */
  id: string;
  label: string;
  /** short description shown on the card */
  hint: string;
  /** the entry key (used to de-duplicate and rename on insert) */
  key: string;
  /** Lua snippet for the entry body, ready to append into the file's table */
  lua: string;
}

/**
 * Curated default entries users can add with one click. These are sensible
 * starting points based on common ox_inventory setups — edit after adding.
 */
export const PRESETS: Partial<Record<DataFileName, Preset[]>> = {
  items: [
    {
      id: 'water',
      label: 'Water',
      hint: 'Drink · restores thirst',
      key: 'water',
      lua: `['water'] = {
\t\tlabel = 'Water',
\t\tweight = 500,
\t\tstack = true,
\t\tclose = false,
\t\tclient = {
\t\t\tstatus = { thirst = 200000 },
\t\t\tusetime = 1500,
\t\t}
\t}`,
    },
    {
      id: 'bread',
      label: 'Bread',
      hint: 'Food · restores hunger',
      key: 'bread',
      lua: `['bread'] = {
\t\tlabel = 'Bread',
\t\tweight = 100,
\t\tstack = true,
\t\tclose = false,
\t\tclient = {
\t\t\tstatus = { hunger = 200000 },
\t\t\tusetime = 2000,
\t\t}
\t}`,
    },
    {
      id: 'burger',
      label: 'Burger',
      hint: 'Food · hunger + anim',
      key: 'burger',
      lua: `['burger'] = {
\t\tlabel = 'Burger',
\t\tweight = 220,
\t\tstack = true,
\t\tclose = true,
\t\tclient = {
\t\t\tstatus = { hunger = 200000 },
\t\t\tanim = { dict = 'mp_player_inteat@burger', clip = 'mp_player_int_eat_burger_fp' },
\t\t\tusetime = 2500,
\t\t}
\t}`,
    },
    {
      id: 'phone',
      label: 'Phone',
      hint: 'Usable · triggers an event',
      key: 'phone',
      lua: `['phone'] = {
\t\tlabel = 'Phone',
\t\tweight = 190,
\t\tstack = false,
\t\tclose = true,
\t\tclient = {
\t\t\tadd = function(total)
\t\t\t\tif total > 0 then
\t\t\t\t\tprint('received phone')
\t\t\t\tend
\t\t\tend
\t\t}
\t}`,
    },
    {
      id: 'lockpick',
      label: 'Lockpick',
      hint: 'Tool · degrades on use',
      key: 'lockpick',
      lua: `['lockpick'] = {
\t\tlabel = 'Lockpick',
\t\tweight = 100,
\t\tstack = true,
\t\tdegrade = 60,
\t\tclient = {
\t\t\tusetime = 5000,
\t\t}
\t}`,
    },
    {
      id: 'bandage',
      label: 'Bandage',
      hint: 'Medical · heals',
      key: 'bandage',
      lua: `['bandage'] = {
\t\tlabel = 'Bandage',
\t\tweight = 115,
\t\tstack = true,
\t\tclient = {
\t\t\tstatus = { health = 50000 },
\t\t\tusetime = 2500,
\t\t}
\t}`,
    },
    {
      id: 'money',
      label: 'Cash',
      hint: 'Currency',
      key: 'money',
      lua: `['money'] = {
\t\tlabel = 'Cash',
\t\tstack = true,
\t\tclose = false,
\t}`,
    },
    {
      id: 'blank',
      label: 'Blank item',
      hint: 'Minimal starting point',
      key: 'new_item',
      lua: `['new_item'] = {
\t\tlabel = 'New Item',
\t\tweight = 100,
\t\tstack = true,
\t}`,
    },
  ],
  weapons: [
    {
      id: 'pistol',
      label: 'Pistol',
      hint: 'Sidearm',
      key: 'WEAPON_PISTOL',
      lua: `['WEAPON_PISTOL'] = {
\t\t\tlabel = 'Pistol',
\t\t\tweight = 1000,
\t\t\tdurability = 0.1,
\t\t\tammoname = 'ammo-9',
\t\t}`,
    },
    {
      id: 'knife',
      label: 'Knife',
      hint: 'Melee',
      key: 'WEAPON_KNIFE',
      lua: `['WEAPON_KNIFE'] = {
\t\t\tlabel = 'Knife',
\t\t\tweight = 1000,
\t\t}`,
    },
  ],
  shops: [
    {
      id: 'general',
      label: 'General store',
      hint: 'Basic shop with a few items',
      key: 'NewStore',
      lua: `NewStore = {
\t\tname = 'General Store',
\t\tblip = { id = 59, colour = 69, scale = 0.8 },
\t\tinventory = {
\t\t\t{ name = 'water', price = 10 },
\t\t\t{ name = 'bread', price = 10 },
\t\t},
\t\tlocations = {
\t\t\tvec3(25.7, -1347.3, 29.49),
\t\t},
\t}`,
    },
  ],
  crafting: [
    {
      id: 'bench',
      label: 'Crafting bench',
      hint: 'One recipe to start',
      key: 'new_bench',
      lua: `{
\t\tname = 'new_bench',
\t\titems = {
\t\t\t{
\t\t\t\tname = 'lockpick',
\t\t\t\tingredients = { scrapmetal = 5 },
\t\t\t\tduration = 5000,
\t\t\t\tcount = 1,
\t\t\t},
\t\t},
\t\tpoints = {
\t\t\tvec3(-1147.08, -2002.66, 13.18),
\t\t},
\t}`,
    },
  ],
  stashes: [
    {
      id: 'locker',
      label: 'Personal locker',
      hint: '50 slots, owner-bound',
      key: 'personal_locker',
      lua: `{
\t\tname = 'personal_locker',
\t\tlabel = 'Personal Locker',
\t\towner = true,
\t\tslots = 50,
\t\tweight = 50000,
\t\tcoords = vec3(452.3, -991.4, 30.7),
\t}`,
    },
  ],
};
