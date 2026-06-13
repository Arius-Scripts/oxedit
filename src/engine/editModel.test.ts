import { describe, it, expect } from 'vitest';
import {
  applyEdits,
  applyFormEdits,
  modelFromSource,
  addEntry,
  deleteEntry,
  readField,
  buildEntryForm,
  type FieldEdit,
} from './editModel';

const SOURCE = `return {
	-- a refreshing drink
	['water'] = {
		label = 'Water',
		weight = 500,
		stack = true,
		client = {
			image = 'water.png',
		}
	},

	['bandage'] = {
		label = 'Bandage',
		weight = 115,
	},
}
`;

describe('surgical editing', () => {
  it('changes only the edited bytes when editing a number', () => {
    const next = applyEdits(SOURCE, new Map([['water.weight', 750]]));
    expect(next).toBe(SOURCE.replace('weight = 500', 'weight = 750'));
    // Every other line is byte-identical.
    const a = SOURCE.split('\n');
    const b = next.split('\n');
    const diffLines = a.filter((line, i) => line !== b[i]);
    expect(diffLines).toEqual(['\t\tweight = 500,']);
  });

  it('preserves comments and blank lines', () => {
    const next = applyEdits(SOURCE, new Map([['water.label', 'Bottled Water']]));
    expect(next).toContain('-- a refreshing drink');
    expect(next).toContain("label = 'Bottled Water'");
    expect(next).toContain("['bandage']");
    expect(next.match(/\n\n/g)?.length).toBe(SOURCE.match(/\n\n/g)?.length);
  });

  it('edits a nested field by path', () => {
    const next = applyEdits(SOURCE, new Map([['water.client.image', 'aqua.png']]));
    expect(next).toContain("image = 'aqua.png'");
    expect(next).toContain('weight = 500');
  });

  it('adds an entry without disturbing existing ones', () => {
    const lua = `['cola'] = {\n\t\tlabel = 'Cola',\n\t\tweight = 350,\n\t}`;
    const { model } = modelFromSource(SOURCE);
    const next = addEntry(SOURCE, model, lua);
    const re = modelFromSource(next);
    expect(readField(re.model, 'cola', 'label')).toBe('Cola');
    expect(readField(re.model, 'water', 'weight')).toBe(500);
    expect(readField(re.model, 'bandage', 'label')).toBe('Bandage');
  });

  it('removes an entry surgically', () => {
    const { model } = modelFromSource(SOURCE);
    const next = deleteEntry(SOURCE, model, 'water');
    const re = modelFromSource(next);
    expect(readField(re.model, 'water', 'label')).toBeUndefined();
    expect(readField(re.model, 'bandage', 'label')).toBe('Bandage');
  });

  const edit = (path: string, value: any, type: any, present: boolean): FieldEdit => ({ path, value, type, present });

  it('inserts an absent top-level field, leaving other entries untouched', () => {
    const { model } = modelFromSource(SOURCE);
    const next = applyFormEdits(SOURCE, model, 'bandage', [edit('bandage.degrade', 30, 'number', false)]);
    const re = modelFromSource(next);
    expect(readField(re.model, 'bandage', 'degrade')).toBe(30);
    expect(readField(re.model, 'bandage', 'weight')).toBe(115);
    expect(readField(re.model, 'water', 'weight')).toBe(500);
    expect(next).toContain('-- a refreshing drink'); // comment preserved
  });

  it('inserts an absent nested field into an existing sub-table', () => {
    const { model } = modelFromSource(SOURCE);
    const next = applyFormEdits(SOURCE, model, 'water', [edit('water.client.usetime', 2500, 'number', false)]);
    const re = modelFromSource(next);
    expect(readField(re.model, 'water.client', 'usetime')).toBe(2500);
    expect(readField(re.model, 'water.client', 'image')).toBe('water.png');
  });

  it('creates a missing parent table when inserting a nested field', () => {
    const { model } = modelFromSource(SOURCE);
    const next = applyFormEdits(SOURCE, model, 'bandage', [
      edit('bandage.client.image', 'bandage.png', 'string', false),
    ]);
    const re = modelFromSource(next);
    expect(readField(re.model, 'bandage.client', 'image')).toBe('bandage.png');
  });

  it('combines a replacement and an insertion in one apply', () => {
    const { model } = modelFromSource(SOURCE);
    const next = applyFormEdits(SOURCE, model, 'water', [
      edit('water.weight', 600, 'number', true),
      edit('water.degrade', 45, 'number', false),
    ]);
    const re = modelFromSource(next);
    expect(readField(re.model, 'water', 'weight')).toBe(600);
    expect(readField(re.model, 'water', 'degrade')).toBe(45);
    expect(readField(re.model, 'bandage', 'weight')).toBe(115);
  });

  it('builds form fields with present/absent flags', () => {
    const { model } = modelFromSource(SOURCE);
    const fields = buildEntryForm(
      model,
      'water',
      [
        { key: 'label', type: 'string', required: true },
        { key: 'weight', type: 'number' },
        { key: 'degrade', type: 'number' },
      ],
      { client: [{ key: 'image', type: 'string' }] }
    );
    const byKey = Object.fromEntries(fields.map((f) => [f.key, f]));
    expect(byKey['label'].value).toBe('Water');
    expect(byKey['label'].present).toBe(true);
    expect(byKey['degrade'].present).toBe(false);
    expect(byKey['client.image'].value).toBe('water.png');
  });
});
