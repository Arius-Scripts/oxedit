export const animationsSchema = {
  fileType: 'keyed-map' as const,
  sections: ['anim', 'prop'],
};

export const licensesSchema = {
  fileType: 'indexed-array' as const,
  fields: [
    { key: 'name', type: 'string' as const, required: true },
    { key: 'coords', type: 'call' as const },
    { key: 'price', type: 'number' as const },
  ],
};

export const evidenceSchema = {
  fileType: 'indexed-array' as const,
  fields: [
    { key: 'coords', type: 'call' as const },
  ],
  nestedFields: {
    'target': [
      { key: 'name', type: 'string' as const },
      { key: 'loc', type: 'call' as const },
      { key: 'length', type: 'number' as const },
      { key: 'width', type: 'number' as const },
      { key: 'heading', type: 'number' as const },
      { key: 'minZ', type: 'number' as const },
      { key: 'maxZ', type: 'number' as const },
    ],
  },
};
