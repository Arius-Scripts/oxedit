export const itemsSchema = {
  fileType: 'keyed-map' as const,
  fields: [
    { key: 'label', type: 'string' as const, required: true },
    { key: 'weight', type: 'number' as const },
    { key: 'degrade', type: 'number' as const },
    { key: 'decay', type: 'boolean' as const },
    { key: 'stack', type: 'boolean' as const },
    { key: 'close', type: 'boolean' as const },
    { key: 'consume', type: 'number' as const },
    { key: 'description', type: 'string' as const },
    { key: 'allowArmed', type: 'boolean' as const },
  ],
  nestedFields: {
    'client': [
      { key: 'image', type: 'string' as const },
      { key: 'usetime', type: 'number' as const },
      { key: 'anim', type: 'raw' as const },
      { key: 'prop', type: 'raw' as const },
      { key: 'export', type: 'string' as const },
      { key: 'event', type: 'string' as const },
      { key: 'notification', type: 'string' as const },
      { key: 'cancel', type: 'boolean' as const },
      { key: 'status', type: 'table' as const },
      { key: 'disable', type: 'table' as const },
    ],
    'server': [
      { key: 'export', type: 'string' as const },
    ],
  },
  template: `['NEW_ITEM'] = {
\t\tlabel = 'New Item',
\t\tweight = 100,
\t}`,
};
