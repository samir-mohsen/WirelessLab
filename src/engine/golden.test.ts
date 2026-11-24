import { describe, expect, it } from 'vitest';
import {
  ALL_MODULE_IDS,
  runAllGoldenRegressions,
  runModuleGoldenRegression,
} from './golden';

describe('T1.4 Golden-Results Regression Suite', () => {
  for (const moduleId of ALL_MODULE_IDS) {
    it(`${moduleId} matches golden deterministic baseline within tolerance`, () => {
      const report = runModuleGoldenRegression(moduleId);
      expect(report.verificationPassed).toBe(true);
      expect(report.rows.length).toBeGreaterThanOrEqual(4);
      for (const row of report.rows) {
        expect(
          row.passed,
          `${moduleId}:${row.key} drifted: golden=${row.golden}, actual=${row.actual}, relDrift=${(row.relDrift * 100).toFixed(4)}%`,
        ).toBe(true);
      }
      expect(report.passed).toBe(true);
    });
  }

  it('full 8-module suite regression summary passes with 40/40 golden metrics', () => {
    const suite = runAllGoldenRegressions();
    expect(suite.totalModules).toBe(8);
    expect(suite.passedModules).toBe(8);
    expect(suite.passedMetrics).toBe(suite.totalMetrics);
    expect(suite.allPassed).toBe(true);
    expect(suite.maxRelDrift).toBeLessThan(0.001);
  });
});
