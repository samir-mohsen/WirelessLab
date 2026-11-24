import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MODULE5_PARAMS,
  assembleModule5Results,
  buildModule5Tasks,
  runModule5Task,
} from './model';

describe('Module 5: CDMA Near-Far Problem & Power Control', () => {
  it('verifies K=1 AWGN and multiuser Ideal PC against Standard Gaussian Approximation', () => {
    const params = { ...DEFAULT_MODULE5_PARAMS, bitsPerPoint: 14000 };
    const { tasks } = buildModule5Tasks(params, 'quick');
    const outputs = tasks.map((t) => runModule5Task(t));
    const bundle = assembleModule5Results(params, outputs, 20, false);

    expect(bundle.figures.length).toBe(6);
    expect(bundle.verification?.passed).toBe(true);
    expect(bundle.verification!.maxRelError).toBeLessThan(0.15);
  });

  it('shows Ideal Power Control beats uncontrolled Near-Far interference', () => {
    const noPc = runModule5Task({
      group: 'nfr_sweep',
      pcMode: 'none',
      receiver: 'mf',
      sf: 31,
      kUsers: 8,
      nearFarDb: 12,
      ebN0Db: 8,
      pcErrorSigmaDb: 0,
      codeType: 'gold',
      bits: 8000,
      seed: 101,
    });
    const idealPc = runModule5Task({
      group: 'nfr_sweep',
      pcMode: 'ideal',
      receiver: 'mf',
      sf: 31,
      kUsers: 8,
      nearFarDb: 12,
      ebN0Db: 8,
      pcErrorSigmaDb: 0,
      codeType: 'gold',
      bits: 8000,
      seed: 102,
    });
    expect(idealPc.ber).toBeLessThan(noPc.ber * 0.25);
  });
});
