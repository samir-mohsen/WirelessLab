import { describe, expect, it } from 'vitest';
import { ALL_MODULE_IDS } from './goldenRunner';
import {
  generateSignalLabSnapshot,
  getDefaultSignalLabControl,
  hermitianEigenvalues,
  solveWaterFilling,
} from './signalLab';
import { buildAllDefaultParams } from '../modules/adapter';

describe('T2.1 Live Signal Lab Engine (All 8 Modules)', () => {
  const defaults = buildAllDefaultParams();

  it('hermitianEigenvalues recovers exact eigenvalues of known 2x2 Hermitian matrix', () => {
    // A = [[3, 1-i], [1+i, 3]] -> eigenvalues are 3 + sqrt(2) and 3 - sqrt(2)
    const re = new Float64Array([3, 1, 1, 3]);
    const im = new Float64Array([0, -1, 1, 0]);
    const eigs = hermitianEigenvalues(re, im, 2);
    expect(eigs[0]).toBeCloseTo(3 + Math.SQRT2, 5);
    expect(eigs[1]).toBeCloseTo(3 - Math.SQRT2, 5);
  });

  it('solveWaterFilling satisfies exact total power constraint and beats or equals equal-power', () => {
    const eigs = [8.0, 3.0, 0.5, 0.02];
    const totalP = 10.0;
    const wf = solveWaterFilling(eigs, totalP);
    const sumP = wf.powers.reduce((a, b) => a + b, 0);
    expect(sumP).toBeCloseTo(totalP, 6);
    expect(wf.powers[0]).toBeGreaterThan(wf.powers[2]);
    expect(wf.powers[3]).toBe(0); // weakest subchannel poured 0 power
    expect(wf.capacityWf).toBeGreaterThan(wf.capacityEq);
  });

  for (const moduleId of ALL_MODULE_IDS) {
    it(`generates valid deterministic Signal Lab snapshot for ${moduleId}`, () => {
      const p = defaults[moduleId];
      const ctrl = getDefaultSignalLabControl(moduleId, p);
      const snap = generateSignalLabSnapshot(moduleId, p, 1, ctrl);
      expect(snap.panels.length).toBeGreaterThanOrEqual(1);
      expect(snap.metrics.length).toBeGreaterThanOrEqual(3);
      for (const panel of snap.panels) {
        expect(panel.traces.length).toBeGreaterThanOrEqual(1);
      }

      // Deterministic check: identical seed & realization produces identical telemetry
      const snap2 = generateSignalLabSnapshot(moduleId, p, 1, ctrl);
      expect(snap2.metrics).toEqual(snap.metrics);
    });
  }

  it('Module 3 Signal Lab shows strictly lower EVM with sufficient CP than No CP', () => {
    const snap = generateSignalLabSnapshot('module3', defaults.module3, 2, 18);
    const evmCp = Number(snap.metrics[0].value);
    const evmNoCp = Number(snap.metrics[1].value);
    expect(Number.isFinite(evmCp)).toBe(true);
    expect(Number.isFinite(evmNoCp)).toBe(true);
    expect(evmCp).toBeLessThan(evmNoCp);
  });
});
