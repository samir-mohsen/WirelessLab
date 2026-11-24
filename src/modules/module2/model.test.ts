import { describe, expect, it } from 'vitest';
import { dbToLin } from '../../engine/special';
import { relativeError } from '../../engine/stats';
import {
  simulateDiversityPoint,
  theoryBerMrc,
  theoryBerNoDiv,
  theoryBerSc,
  theoryOutageMrc,
  theoryOutageSc,
} from './model';

describe('Module 2: Diversity Combining over Rayleigh Fading', () => {
  it('Simulated No-Div, SC, and MRC BER match exact closed forms within <= 15%', () => {
    const snrDb = 6;
    const g = dbToLin(snrDb);
    const base = {
      mode: 'ber' as const,
      snrDb,
      numTrials: 80000,
      earlyStop: false,
      earlyStopErrors: 1000,
      baseSeed: 44102,
      pointIndex: 0,
    };

    const none = simulateDiversityPoint({ ...base, technique: 'NONE', L: 1, experimentId: 1 });
    const sc = simulateDiversityPoint({ ...base, technique: 'SC', L: 4, experimentId: 2 });
    const mrc = simulateDiversityPoint({ ...base, technique: 'MRC', L: 4, experimentId: 3 });

    expect(relativeError(none.rate, theoryBerNoDiv(g))).toBeLessThanOrEqual(0.15);
    expect(relativeError(sc.rate, theoryBerSc(g, 4))).toBeLessThanOrEqual(0.15);
    expect(relativeError(mrc.rate, theoryBerMrc(g, 4))).toBeLessThanOrEqual(0.15);
    expect(mrc.rate).toBeLessThan(sc.rate);
    expect(sc.rate).toBeLessThan(none.rate);
  });

  it('Simulated SC and MRC Outage Probability match exact closed forms within <= 15%', () => {
    const snrDb = 5;
    const thDb = 5;
    const g = dbToLin(snrDb);
    const th = dbToLin(thDb);
    const base = {
      mode: 'outage' as const,
      snrDb,
      outageThresholdDb: thDb,
      L: 4,
      numTrials: 60000,
      earlyStop: false,
      earlyStopErrors: 1000,
      baseSeed: 44102,
      pointIndex: 0,
    };

    const scOut = simulateDiversityPoint({ ...base, technique: 'SC', experimentId: 10 });
    const mrcOut = simulateDiversityPoint({ ...base, technique: 'MRC', experimentId: 11 });

    expect(relativeError(scOut.rate, theoryOutageSc(g, th, 4))).toBeLessThanOrEqual(0.15);
    expect(relativeError(mrcOut.rate, theoryOutageMrc(g, th, 4))).toBeLessThanOrEqual(0.15);
  });
});
