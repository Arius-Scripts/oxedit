export const vehiclesSchema = {
  fileType: 'multi-section' as const,
  sections: ['Storage', 'glovebox', 'trunk'],
  fields: {
    Storage: [
      { key: 'value', type: 'number' as const },
    ],
    glovebox: [
      { key: 'slots', type: 'number' as const },
      { key: 'weight', type: 'number' as const },
    ],
    trunk: [
      { key: 'slots', type: 'number' as const },
      { key: 'weight', type: 'number' as const },
    ],
  },
};
