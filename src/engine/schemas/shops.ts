export const shopsSchema = {
  fileType: 'keyed-map' as const,
  fields: [
    { key: 'name', type: 'string' as const, required: true },
    { key: 'groups', type: 'raw' as const },
  ],
  nestedFields: {
    'blip': [
      { key: 'id', type: 'number' as const },
      { key: 'colour', type: 'number' as const },
      { key: 'scale', type: 'number' as const },
    ],
    'inventory': [
      { key: 'name', type: 'string' as const },
      { key: 'price', type: 'number' as const },
      { key: 'count', type: 'number' as const },
      { key: 'currency', type: 'string' as const },
      { key: 'license', type: 'string' as const },
      { key: 'grade', type: 'number' as const },
    ],
  },
  template: `NewShop = {
\t\tname = 'New Shop',
\t\tblip = {
\t\t\tid = 59, colour = 69, scale = 0.8
\t\t}, inventory = {
\t\t\t{ name = 'water', price = 10 },
\t\t}, locations = {
\t\t\tvec3(0.0, 0.0, 0.0),
\t\t}, targets = {
\t\t}
\t}`,
};
