import { describe, expect, it } from 'vitest';
import { dbToLin } from '../../engine/special';
import { relativeError } from '../../engine/stats';
import { simulateMimoPoint, theorySisoRayleighCapacity } from './model';

describe('Module 7: SISO vs MIMO Rayleigh Capacity', () => {
  it('SISO simulated ergodic capacity matches e^(1/rho)*E1(1/rho)/ln(2) within <= 5%', () => {
    for (const snrDb of [0, 10, 20]) {
      const res = simulateMimoPoint({
        nt: 1,
        nr: 1,
        snrDb,
        rTx: 0,
        rRx: 0,
        numRealizations: 8000,
        baseSeed: 44107,
        experimentId: 1,
        pointIndex: snrDb,
      });
      const theory = theorySisoRayleighCapacity(dbToLin(snrDb));
      expect(relativeError(res.ergodicCapacity, theory)).toBeLessThanOrEqual(0.05);
    }
  });

  it('4x4 MIMO exhibits ~4 bits/s/Hz per 3 dB high-SNR slope and degrades under r=0.95 correlation', () => {
    const c20 = simulateMimoPoint({
      nt: 4, nr: 4, snrDb: 20, rTx: 0, rRx: 0, numRealizations: 3000, baseSeed: 44107, experimentId: 2, pointIndex: 0,
    });
    const c30 = simulateMimoPoint({
      nt: 4, nr: 4, snrDb: 30, rTx: 0, rRx: 0, numRealizations: 3000, baseSeed: 44107, experimentId: 2, pointIndex: 1,
    });
    const slopePer3Db = ((c30.ergodicCapacity - c20.ergodicCapacity) / 10) * 3.0103;
    expect(relativeError(slopePer3Db, 4.0)).toBeLessThanOrEqual(0.1);

    const cCorr = simulateMimoPoint({
      nt: 4, nr: 4, snrDb: 20, rTx: 0.95, rRx: 0.95, numRealizations: 3000, baseSeed: 44107, experimentId: 3, pointIndex: 0,
    });
    expect(cCorr.ergodicCapacity).toBeLessThan(c20.ergodicCapacity * 0.7);
  });
});
