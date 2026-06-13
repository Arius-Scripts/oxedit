import { describe, it, expect } from 'vitest';
import { DEMO_FILES } from './demo';
import { modelFromSource } from '@/engine/editModel';

describe('demo dataset parses and models cleanly', () => {
  for (const f of DEMO_FILES) {
    it(`${f.name}.lua builds a model`, () => {
      const { model } = modelFromSource(f.source);
      expect(model.entries.length).toBeGreaterThan(0);
    });
  }
});
