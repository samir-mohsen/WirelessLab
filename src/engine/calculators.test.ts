import { describe, expect, it } from 'vitest';
import {
  computeCellularPlan,
  computeLinkBudget,
  computeOfdmDesign,
  computeQuickRfMetrics,
  erlangB,
  maxErlangsForBlocking,
} from './calculators';

describe('T2.4 ECE 441 Wireless Design Calculators', () => {
  it('computes exact FSPL and kTB thermal noise floor in Link Budget', () => {
    const res = computeLinkBudget({
      txPowerDbm: 43,
      txGainDbi: 15,
      rxGainDbi: 0,
      cableLossDb: 2,
      freqMHz: 900,
      distanceM: 1000,
      d0M: 100,
      pathLossExp: 2.0,
      bandwidthMHz: 10,
      noiseFigureDb: 7,
      rxSensitivityDbm: -100,
    });
    // FSPL(1km, 900 MHz) = 32.44 + 20*log10(900) = 91.52485 dB
    expect(res.fsplAtDDb).toBeCloseTo(91.52485, 3);
    // Thermal noise floor: -174 + 10*log10(10e6) + 7 = -174 + 70 + 7 = -97 dBm
    expect(res.thermalNoiseDbm).toBeCloseTo(-97.0, 5);
    expect(res.eirpDbm).toBeCloseTo(56.0, 5);
    expect(res.shannonCapacityMbps).toBeGreaterThan(0);
  });

  it('computes exact OFDM subcarrier spacing, Doppler shift, and coherence bandwidth', () => {
    const res = computeOfdmDesign({
      bandwidthMHz: 20,
      nFft: 64,
      maxDelaySpreadUs: 0.8,
      rmsDelaySpreadUs: 0.2,
      carrierFreqGHz: 2.4,
      mobileSpeedKmh: 108, // 30 m/s
      bitsPerSymbol: 2,
    });
    // Delta f = 20 MHz / 64 = 312.5 kHz
    expect(res.subcarrierSpacingKHz).toBeCloseTo(312.5, 4);
    expect(res.usefulSymbolUs).toBeCloseTo(3.2, 4);
    // f_D = 30 * 2.4e9 / 299792458 ≈ 240.166 Hz
    expect(res.maxDopplerHz).toBeCloseTo(240.166, 1);
    // B_c50 = 1 / (5 * 0.2e-6) = 1000 kHz
    expect(res.coherenceBandwidth50KHz).toBeCloseTo(1000, 3);
    expect(res.isFlatPerSubcarrier).toBe(true);
  });

  it('computes exact recursive Erlang-B blocking probability and inverse traffic capacity', () => {
    // Classic textbook check: C=1 channel, A=1 Erlang -> B(1,1) = 1/(1+1) = 0.5
    expect(erlangB(1, 1)).toBeCloseTo(0.5, 8);
    // C=2 channels, A=2 Erlangs -> (2^2/2) / (1 + 2 + 2) = 2/5 = 0.4
    expect(erlangB(2, 2)).toBeCloseTo(0.4, 8);

    // Inversion check: maxErlangsForBlocking(20, 0.02) ≈ 13.18 Erlangs
    const maxA = maxErlangsForBlocking(20, 0.02);
    expect(erlangB(20, maxA)).toBeCloseTo(0.02, 5);
    expect(maxA).toBeGreaterThan(13.0);
    expect(maxA).toBeLessThan(13.4);

    const plan = computeCellularPlan({
      clusterSizeN: 7,
      pathLossExp: 4,
      totalChannelsS: 395,
      blockingProbPb: 0.02,
      trafficPerUserErlang: 0.025,
      numCells: 21,
      sectorization: 1,
    });
    expect(plan.coChannelFactorQ).toBeCloseTo(Math.sqrt(21), 6);
    expect(plan.worstCaseSirDb).toBeCloseTo(10 * Math.log10((21 * 21) / 6), 4);
    expect(plan.subscribersPerCell).toBeGreaterThan(1500);
  });

  it('computes exact quick RF dBm/W and BER conversions', () => {
    const q = computeQuickRfMetrics(10, 30);
    expect(q.powerWattsFromDbm).toBeCloseTo(1.0, 6);
    expect(q.ebN0Lin).toBeCloseTo(10.0, 6);
    expect(q.bpskAwgnBer).toBeLessThan(1e-5);
    expect(q.bpskRayleighBer).toBeCloseTo(0.02327, 4);
  });
});
