import { describe, expect, it } from 'vitest';
import { DEFAULT_MODULE1_PARAMS } from '../modules/module1/model';
import { DEFAULT_MODULE2_PARAMS } from '../modules/module2/model';
import { DEFAULT_MODULE3_PARAMS } from '../modules/module3/model';
import { DEFAULT_MODULE4_PARAMS } from '../modules/module4/model';
import { DEFAULT_MODULE5_PARAMS } from '../modules/module5/model';
import { DEFAULT_MODULE6_PARAMS } from '../modules/module6/model';
import { DEFAULT_MODULE7_PARAMS } from '../modules/module7/model';
import { DEFAULT_MODULE8_PARAMS } from '../modules/module8/model';
import type { ModuleId } from '../types/simulation';
import {
  computeExpectedReferenceValues,
  generateMatlabScript,
  generatePythonScript,
  parseExpectedReferenceValues,
} from './codeExporter';

const DEFAULT_PARAMS_MAP: Record<ModuleId, Record<string, unknown>> = {
  module1: { ...DEFAULT_MODULE1_PARAMS },
  module2: { ...DEFAULT_MODULE2_PARAMS },
  module3: { ...DEFAULT_MODULE3_PARAMS },
  module4: { ...DEFAULT_MODULE4_PARAMS },
  module5: { ...DEFAULT_MODULE5_PARAMS },
  module6: { ...DEFAULT_MODULE6_PARAMS },
  module7: { ...DEFAULT_MODULE7_PARAMS },
  module8: { ...DEFAULT_MODULE8_PARAMS },
};

describe('T1.5 Cross-Check of Exported Python & MATLAB Scripts', () => {
  const moduleIds = Object.keys(DEFAULT_PARAMS_MAP) as ModuleId[];

  for (const modId of moduleIds) {
    it(`embeds matching JS-engine expected reference values and seed in ${modId} Python & MATLAB scripts`, () => {
      const params = DEFAULT_PARAMS_MAP[modId];
      const expectedMetrics = computeExpectedReferenceValues(modId, params);
      expect(expectedMetrics.length).toBeGreaterThanOrEqual(3);

      const py = generatePythonScript(modId, params);
      const mat = generateMatlabScript(modId, params);

      expect(py.filename.endsWith('.py')).toBe(true);
      expect(mat.filename.endsWith('.m')).toBe(true);

      // Verify exact RNG seed matches in both scripts
      const seed = Number(params.seed);
      expect(py.content).toContain(`SEED = ${seed}`);
      expect(mat.content).toContain(`rng(${seed})`);

      // Parse @EXPECTED headers from both scripts and cross-check every metric against JS engine
      const pyParsed = parseExpectedReferenceValues(py.content);
      const matParsed = parseExpectedReferenceValues(mat.content);

      for (const m of expectedMetrics) {
        expect(pyParsed[m.key]).toBeDefined();
        expect(matParsed[m.key]).toBeDefined();
        const relPy = Math.abs(pyParsed[m.key] - m.value) / Math.max(Math.abs(m.value), 1e-12);
        const relMat = Math.abs(matParsed[m.key] - m.value) / Math.max(Math.abs(m.value), 1e-12);
        expect(relPy).toBeLessThan(1e-4);
        expect(relMat).toBeLessThan(1e-4);
      }
    });
  }
});
