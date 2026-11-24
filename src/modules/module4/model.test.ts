import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MODULE4_PARAMS,
  assembleModule4Results,
  buildModule4Tasks,
  generateGoldCode,
  generateMSequence,
  runModule4Task,
} from './model';

describe('Module 4: DSSS Performance under Interference', () => {
  it('generates balanced LFSR m-sequences with exact two-level autocorrelation', () => {
    const seq = generateMSequence(31);
    expect(seq.length).toBe(31);
    let sum = 0;
    for (let i = 0; i < seq.length; i++) sum += seq[i];
    expect(Math.abs(sum)).toBe(1);
    // Cyclic shift autocorrelation must equal -1 for any nonzero shift
    let corrShift = 0;
    for (let i = 0; i < 31; i++) corrShift += seq[i] * seq[(i + 5) % 31];
    expect(corrShift).toBe(-1);

    const gold = generateGoldCode(31, 3);
    expect(gold.length).toBe(31);
  });

  it('verifies no-jammer DSSS against exact AWGN Q(sqrt(2*Eb/N0)) and beats BPSK under jamming', () => {
    const params = { ...DEFAULT_MODULE4_PARAMS, bitsPerPoint: 15000 };
    const { tasks } = buildModule4Tasks(params, 'quick');
    const outputs = tasks.map((t) => runModule4Task(t));
    const bundle = assembleModule4Results(params, outputs, 25, false);

    expect(bundle.figures.length).toBe(6);
    expect(bundle.verification?.passed).toBe(true);
    expect(bundle.verification!.maxRelError).toBeLessThan(0.15);
    const summary = bundle.rawSummary as { berDsssAtMaxEb: number; berBpskAtMaxEb: number };
    expect(summary.berDsssAtMaxEb).toBeLessThan(summary.berBpskAtMaxEb);
  });
});
