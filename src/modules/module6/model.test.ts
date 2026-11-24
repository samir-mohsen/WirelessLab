import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MODULE6_PARAMS,
  assembleModule6Results,
  buildModule6Tasks,
  getCoChannelCenters,
  reuseDistanceM,
  runModule6Task,
} from './model';

describe('Module 6: Cellular Frequency Reuse & CCI', () => {
  it('places all 6 first-tier co-channel base stations at exact distance R*sqrt(3N)', () => {
    for (const nC of [1, 3, 4, 7, 9, 12] as const) {
      const centers = getCoChannelCenters(1000, nC, false);
      expect(centers.length).toBe(6);
      const expectedD = reuseDistanceM(1000, nC);
      for (const c of centers) {
        expect(Math.hypot(c.x, c.y)).toBeCloseTo(expectedD, 6);
      }
    }
  });

  it('verifies MC ring cell-edge SIR against exact 6-interferer distance formula', () => {
    const params = { ...DEFAULT_MODULE6_PARAMS, mcUsers: 2000 };
    const { tasks } = buildModule6Tasks(params, 'quick');
    const outputs = tasks.map((t) => runModule6Task(t, params.targetSirDb));
    const bundle = assembleModule6Results(params, outputs, 15, false);

    expect(bundle.figures.length).toBe(6);
    expect(bundle.verification?.passed).toBe(true);
    expect(bundle.verification!.maxRelError).toBeLessThan(0.05);
  });
});
