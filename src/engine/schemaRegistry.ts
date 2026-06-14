import type { SchemaField, FormField } from './editModel';
import { buildEntryForm, readField } from './editModel';
import type { FileModel } from './fieldMap';
import type { ValKind } from './luaObject';
import type { DataFileName } from '@/services/fileSystem';
import { itemsSchema, craftingSchema, shopsSchema, stashesSchema, weaponsSchema } from './schemas';

export interface NormalizedSchema {
  type: 'keyed-map' | 'indexed-array' | 'multi-section';
  fields: SchemaField[];
  nested?: Record<string, SchemaField[]>;
  template?: string;
  /** multi-section support */
  sections?: string[];
  sectionFields?: Record<string, SchemaField[]>;
  templates?: Record<string, string>;
  /** field key used as the entry title in lists */
  labelKey: string;
  /** field key used as the entry subtitle in lists (falls back to the entry key) */
  subtitleKey?: string;
  /** optional path to an image filename field for preview (e.g. "client.image") */
  imageKey?: string;
  /** whether entries have an icon resolved from web/images (items, weapons) */
  images?: boolean;
  /** whether the form UI is supported, or only the raw editor */
  formSupported: boolean;
  /**
   * Which editor to use:
   * - 'fields'     surgical per-field form (items, weapons, stashes)
   * - 'structured' category tree editor that regenerates the whole entry (shops, crafting)
   */
  editor: 'fields' | 'structured';
}

export const SCHEMAS: Record<DataFileName, NormalizedSchema> = {
  items: {
    type: 'keyed-map',
    fields: itemsSchema.fields,
    nested: itemsSchema.nestedFields,
    template: itemsSchema.template,
    labelKey: 'label',
    imageKey: 'client.image',
    images: true,
    formSupported: true,
    editor: 'fields',
  },
  weapons: {
    type: 'multi-section',
    fields: [],
    sections: weaponsSchema.sections,
    sectionFields: weaponsSchema.fields,
    templates: weaponsSchema.templates,
    labelKey: 'label',
    images: true,
    formSupported: true,
    editor: 'fields',
  },
  shops: {
    type: 'keyed-map',
    fields: shopsSchema.fields,
    nested: shopsSchema.nestedFields,
    template: shopsSchema.template,
    labelKey: 'name',
    formSupported: true,
    editor: 'structured',
  },
  crafting: {
    type: 'indexed-array',
    fields: craftingSchema.fields,
    nested: craftingSchema.nestedFields,
    template: craftingSchema.template,
    labelKey: 'name',
    formSupported: true,
    editor: 'structured',
  },
  stashes: {
    type: 'indexed-array',
    fields: stashesSchema.fields,
    nested: stashesSchema.nestedFields,
    template: stashesSchema.template,
    labelKey: 'label',
    subtitleKey: 'name',
    formSupported: true,
    editor: 'fields',
  },
};

/**
 * Resolve the icon filename for an entry the same way ox_inventory does:
 * use `client.image` if set, otherwise fall back to `<itemName>.png`.
 * For multi-section files (weapons) the basename is the last key segment.
 */
export function resolveImage(
  file: DataFileName,
  model: FileModel,
  entryKey: string
): string | undefined {
  const schema = SCHEMAS[file];
  if (!schema.images) return undefined;
  if (schema.imageKey) {
    const explicit = readField(model, entryKey, schema.imageKey);
    if (typeof explicit === 'string' && explicit) return explicit;
  }
  const base = entryKey.split('.').pop();
  return base ? `${base}.png` : undefined;
}

/**
 * Optional fields the user can add in the structured (shops/crafting) editor.
 * Keyed by file, then by the map's parent key ('' = the entry root).
 * `kind` decides the blank value created when the field is added.
 */
export interface AddableField {
  key: string;
  kind: ValKind;
  label?: string;
}

export const ADDABLE_FIELDS: Partial<Record<DataFileName, Record<string, AddableField[]>>> = {
  shops: {
    '': [
      { key: 'name', kind: 'str' },
      { key: 'groups', kind: 'raw' },
      { key: 'blip', kind: 'map' },
      { key: 'inventory', kind: 'arr' },
      { key: 'locations', kind: 'arr' },
      { key: 'targets', kind: 'arr' },
      { key: 'model', kind: 'arr' },
    ],
    blip: [
      { key: 'id', kind: 'num' },
      { key: 'colour', kind: 'num' },
      { key: 'scale', kind: 'num' },
    ],
    // a shop inventory item
    inventory: [
      { key: 'name', kind: 'str' },
      { key: 'price', kind: 'num' },
      { key: 'count', kind: 'num' },
      { key: 'currency', kind: 'str' },
      { key: 'license', kind: 'str' },
      { key: 'grade', kind: 'num' },
      { key: 'metadata', kind: 'map' },
    ],
    // a shop target zone
    targets: [
      { key: 'loc', kind: 'vec3' },
      { key: 'length', kind: 'num' },
      { key: 'width', kind: 'num' },
      { key: 'heading', kind: 'num' },
      { key: 'minZ', kind: 'num' },
      { key: 'maxZ', kind: 'num' },
      { key: 'distance', kind: 'num' },
      { key: 'ped', kind: 'num' },
      { key: 'scenario', kind: 'str' },
    ],
  },
  crafting: {
    '': [
      { key: 'name', kind: 'str' },
      { key: 'label', kind: 'str' },
      { key: 'blip', kind: 'map' },
      { key: 'items', kind: 'arr' },
      { key: 'locations', kind: 'arr' },
      { key: 'points', kind: 'arr' },
      { key: 'groups', kind: 'raw' },
      { key: 'radius', kind: 'num' },
    ],
    items: [
      { key: 'name', kind: 'str' },
      { key: 'price', kind: 'num' },
      { key: 'count', kind: 'num' },
      { key: 'metadata', kind: 'map' },
    ],
  },
};

/** Template fields used when adding a new item to an array (by the array's key). */
export const ARRAY_ITEM_FIELDS: Partial<Record<DataFileName, Record<string, AddableField[]>>> = {
  shops: {
    inventory: [
      { key: 'name', kind: 'str' },
      { key: 'price', kind: 'num' },
    ],
    targets: [
      { key: 'loc', kind: 'vec3' },
      { key: 'length', kind: 'num' },
      { key: 'width', kind: 'num' },
      { key: 'heading', kind: 'num' },
      { key: 'minZ', kind: 'num' },
      { key: 'maxZ', kind: 'num' },
      { key: 'distance', kind: 'num' },
    ],
  },
  crafting: {
    items: [
      { key: 'name', kind: 'str' },
      { key: 'count', kind: 'num' },
    ],
  },
};

/** Array keys whose items are bare scalars (not maps): vec3 locations, model ids. */
export const SCALAR_ARRAY_KINDS: Record<string, ValKind> = {
  locations: 'vec3',
  points: 'vec3',
  model: 'num',
};

/**
 * Short, plain-English explanations for fields — surfaced as tooltips in the UI.
 * Sourced from the official ox_inventory documentation.
 */
export const FIELD_DOCS: Record<string, string> = {
  // items
  label: 'Display name shown to players.',
  weight: 'Item weight (grams). Affects how much fits in an inventory.',
  degrade: 'Minutes until the item degrades / expires.',
  decay: 'When on, the item is deleted once its durability hits zero.',
  stack: 'Whether multiple of this item stack into one slot.',
  close: 'Close the inventory UI when the item is used.',
  consume: 'Amount removed per use (1 = whole item; 0–1 = durability fraction).',
  description: 'Tooltip text shown on the item in-game.',
  allowArmed: 'Allow using this item while holding a weapon.',
  'client.image': 'Icon filename in web/images. Defaults to <itemName>.png if empty.',
  'client.usetime': 'How long the use progress bar lasts (milliseconds).',
  'client.anim': 'Animation played during use: { dict, clip }.',
  'client.prop': 'Prop model attached during use: { model, pos, rot }.',
  'client.export': 'Export called after the item is used (resource.fnName).',
  'client.event': 'Client event triggered after the item is used.',
  'client.notification': 'Notification text shown after use.',
  'client.cancel': 'Allow the player to cancel the use progress.',
  'client.status': 'esx_status values changed on use, e.g. { hunger = 200000 }.',
  'client.disable': 'Actions disabled during use: { move, car, combat, sprint }.',
  'server.export': 'Server export called when the item is used.',
  // shops
  name: 'The label shown when the shop is open.',
  groups: 'Job access as raw Lua, e.g. shared.police or { police = 0 } (job = min grade).',
  inventory: 'Items available to buy. Each row is one item.',
  locations: 'World coordinates (vec3) where a marker-based shop appears.',
  targets: 'Ped / box-zone interaction points (ox_target). One row per zone.',
  model: 'Vending-machine model id(s) this shop attaches to.',
  blip: 'Map marker for the shop.',
  'blip.id': 'Blip sprite id shown on the map.',
  'blip.colour': 'Blip colour id (0–85).',
  'blip.scale': 'Blip size on the map, e.g. 0.8.',
  'inventory.name': 'Item id sold at this shop.',
  'inventory.price': 'Cost in currency units.',
  'inventory.count': 'Stock available (omit for unlimited).',
  'inventory.currency': 'Item used as currency instead of cash.',
  'inventory.license': 'License required to buy the item.',
  'inventory.grade': 'Minimum job grade required to buy (number or list).',
  'inventory.metadata': 'Extra item data, e.g. { registered = true }.',
  // shop targets
  'targets.loc': 'Interaction location (vec3).',
  'targets.length': 'Box-zone length.',
  'targets.width': 'Box-zone width.',
  'targets.heading': 'Facing direction (degrees).',
  'targets.minZ': 'Box-zone floor height.',
  'targets.maxZ': 'Box-zone ceiling height.',
  'targets.distance': 'How close the player must be to interact.',
  'targets.ped': 'NPC model hash to spawn for a ped-based shop.',
  'targets.scenario': 'Idle animation scenario for the ped.',
  // crafting
  'items.name': 'Item produced by this recipe.',
  'items.count': 'How many are produced per craft.',
  'items.duration': 'Crafting time in milliseconds.',
  // stashes
  owner: 'true = personal per-player; or a specific owner identifier.',
  slots: 'Number of inventory slots.',
  'target.label': 'Text shown on the ox_target interaction.',
};

/** Example placeholders shown in empty inputs to guide the user. */
export const FIELD_PLACEHOLDERS: Record<string, string> = {
  label: 'e.g. Water Bottle',
  weight: 'e.g. 100',
  degrade: 'minutes, e.g. 60',
  consume: 'e.g. 1',
  description: 'Shown as a tooltip in-game',
  name: 'e.g. water',
  price: 'e.g. 10',
  count: 'leave empty for unlimited',
  currency: 'e.g. black_money',
  license: 'e.g. weapon',
  grade: 'e.g. 2',
  'client.image': 'e.g. water.png',
  'client.usetime': 'milliseconds, e.g. 2500',
  'client.export': 'resource.exportName',
  'client.event': 'eventName',
  'client.notification': 'e.g. You drank some water',
  'server.export': 'resource.exportName',
  ammoname: 'e.g. ammo-9',
  durability: 'e.g. 0.1',
  // shops / blip / targets
  id: 'blip sprite, e.g. 59',
  colour: '0–85, e.g. 69',
  scale: 'e.g. 0.8',
  heading: 'degrees, e.g. 180',
  length: 'e.g. 0.6',
  width: 'e.g. 0.5',
  minZ: 'e.g. 29.5',
  maxZ: 'e.g. 29.9',
  distance: 'e.g. 1.5',
  ped: 'model hash',
  scenario: 'e.g. WORLD_HUMAN_STAND_IMPATIENT',
  groups: "e.g. shared.police or { police = 0 }",
  loc: 'vec3(x, y, z)',
  locations: 'vec3(x, y, z)',
  points: 'vec3(x, y, z)',
  coords: 'vec3(x, y, z)',
};

/** Pretty section/group title for a parent key (e.g. "client" -> "Client / use"). */
export const GROUP_TITLES: Record<string, string> = {
  '': 'General',
  client: 'Client / use behaviour',
  server: 'Server',
  blip: 'Map blip',
  target: 'Target zone',
  targets: 'Target zones',
  inventory: 'Inventory',
  locations: 'Locations',
  points: 'Points',
  model: 'Models',
  metadata: 'Metadata',
  groups: 'Groups',
  items: 'Items',
};

/** Build the form fields for a single entry, respecting multi-section files. */
export function formFieldsFor(file: DataFileName, model: FileModel, entryKey: string): FormField[] {
  const schema = SCHEMAS[file];
  if (schema.type === 'multi-section') {
    const section = entryKey.split('.')[0];
    const sf = schema.sectionFields?.[section] ?? [];
    return buildEntryForm(model, entryKey, sf);
  }
  return buildEntryForm(model, entryKey, schema.fields, schema.nested);
}

export const FILE_LABELS: Record<DataFileName, string> = {
  items: 'Items',
  weapons: 'Weapons',
  shops: 'Shops',
  crafting: 'Crafting',
  stashes: 'Stashes',
};
