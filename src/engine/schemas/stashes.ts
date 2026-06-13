export const stashesSchema = {
  fileType: 'indexed-array' as const,
  fields: [
    { key: 'name', type: 'string' as const, required: true },
    { key: 'label', type: 'string' as const },
    { key: 'owner', type: 'boolean' as const },
    { key: 'slots', type: 'number' as const },
    { key: 'weight', type: 'number' as const },
    { key: 'groups', type: 'raw' as const },
  ],
  nestedFields: {
    'target': [
      { key: 'loc', type: 'call' as const },
      { key: 'length', type: 'number' as const },
      { key: 'width', type: 'number' as const },
      { key: 'heading', type: 'number' as const },
      { key: 'minZ', type: 'number' as const },
      { key: 'maxZ', type: 'number' as const },
      { key: 'label', type: 'string' as const },
    ],
  },
  template: `{
\t\tcoords = vec3(0.0, 0.0, 0.0),
\t\ttarget = {
\t\t\tloc = vec3(0.0, 0.0, 0.0),
\t\t\tlength = 1.0,
\t\t\twidth = 1.0,
\t\t\theading = 0,
\t\t\tminZ = 0.0,
\t\t\tmaxZ = 2.0,
\t\t\tlabel = 'Open stash'
\t\t},
\t\tname = 'newstash',
\t\tlabel = 'New Stash',
\t\towner = true,
\t\tslots = 50,
\t\tweight = 50000,
\t}`,
};
