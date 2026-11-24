import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MODULE8_PARAMS,
  assembleModule8Results,
  buildModule8Tasks,
  runModule8Task,
} from './model';

describe('Module 8: TDMA vs OFDMA Multiuser Resource Allocation', () => {
  it('verifies TDMA & K=1 against exact Rayleigh ergodic Shannon capacity and shows OFDMA multiuser diversity gain', () => {
    const params = { ...DEFAULT_MODULE8_PARAMS, realizations: 1200 };
    const { tasks } = buildModule8Tasks(params, 'quick');
    const outputs = tasks.map((t) => runModule8Task(t));
    const bundle = assembleModule8Results(params, outputs, 25, false);

    expect(bundle.figures.length).toBe(5);
    expect(bundle.verification?.passed).toBe(true);
    expect(bundle.verification!.maxRelError).toBeLessThan(0.05);

    const summary = bundle.rawSummary as {
      tdmaMbps: number;
      pfMbps: number;
      maxRateMbps: number;
      pfJain: number;
      maxRateJain: number;
    };
    expect(summary.maxRateMbps).toBeGreaterThan(summary.pfMbps);
    expect(summary.pfMbps).toBeGreaterThan(summary.tdmaMbps);
    expect(summary.pfJain).toBeGreaterThan(summary.maxRateJain);
  });
});
