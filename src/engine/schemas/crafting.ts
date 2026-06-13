export const craftingSchema = {
  fileType: 'indexed-array' as const,
  fields: [
    { key: 'name', type: 'string' as const, required: true },
  ],
  nestedFields: {
    'items': [
      { key: 'name', type: 'string' as const },
      { key: 'count', type: 'number' as const },
      { key: 'duration', type: 'number' as const },
    ],
    'blip': [
      { key: 'id', type: 'number' as const },
      { key: 'colour', type: 'number' as const },
      { key: 'scale', type: 'number' as const },
    ],
  },
  template: `{
\t\tname = 'new_crafting',
\t\titems = {
\t\t\t{
\t\t\t\tname = 'lockpick',
\t\t\t\tingredients = {
\t\t\t\t\tscrapmetal = 5,
\t\t\t\t},
\t\t\t\tduration = 5000,
\t\t\t\tcount = 1,
\t\t\t},
\t\t},
\t\tpoints = {},
\t\tzones = {},
\t}`,
};
