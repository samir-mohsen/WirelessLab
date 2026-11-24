import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MODULE1_PARAMS,
  assembleModule1Results,
  buildModule1Tasks,
  fsplDb,
  runModule1Task,
} from './model';

describe('Module 1: Wireless Propagation & Coverage', () => {
  it('computes exact 11.80 dB gap between 900 MHz and 3500 MHz FSPL', () => {
    const gap = fsplDb(1000, 3500) - fsplDb(1000, 900);
    expect(gap).toBeCloseTo(20 * Math.log10(3500 / 900), 6);
    expect(gap).toBeCloseTo(11.7965, 3);
  });

  it('verifies Monte-Carlo coverage probability against closed-form Q-function (<= 15%)', () => {
    const params = { ...DEFAULT_MODULE1_PARAMS, mcSamples: 3000, dPoints: 14 };
    const { tasks } = buildModule1Tasks(params, 'quick');
    const outputs = tasks.map((t) => runModule1Task(t));
    const bundle = assembleModule1Results(params, outputs, 10, false);

    expect(bundle.figures.length).toBe(6);
    expect(bundle.verification?.passed).toBe(true);
    expect(bundle.verification!.maxRelError).toBeLessThan(0.12);
  });
});
