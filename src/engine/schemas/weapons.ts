export const weaponsSchema = {
  fileType: 'multi-section' as const,
  sections: ['Weapons', 'Components', 'Ammo'],
  fields: {
    Weapons: [
      { key: 'label', type: 'string' as const, required: true },
      { key: 'weight', type: 'number' as const },
      { key: 'durability', type: 'number' as const },
      { key: 'ammoname', type: 'string' as const },
      { key: 'throwable', type: 'boolean' as const },
    ],
    Components: [
      { key: 'label', type: 'string' as const, required: true },
      { key: 'weight', type: 'number' as const },
      { key: 'type', type: 'string' as const },
    ],
    Ammo: [
      { key: 'label', type: 'string' as const, required: true },
      { key: 'weight', type: 'number' as const },
    ],
  },
  templates: {
    Weapons: `['WEAPON_NEW'] = {
\t\t\tlabel = 'New Weapon',
\t\t\tweight = 1000,
\t\t\tdurability = 0.1,
\t\t}`,
    Components: `['new_component'] = {
\t\t\tlabel = 'New Component',
\t\t\tweight = 100,
\t\t\ttype = 'barrel',
\t\t\tclient = {
\t\t\t\tcomponent = {},
\t\t\t\tusetime = 2500
\t\t\t}
\t\t}`,
    Ammo: `['ammo-new'] = {
\t\t\tlabel = 'New Ammo',
\t\t\tweight = 10,
\t\t}`,
  },
};
