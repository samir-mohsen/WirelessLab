import { describe, expect, it } from 'vitest';
import {
  estimateDiversityOrder,
  estimateMultiplexingGain,
  extractFigureDiagnostics,
  solveXForTargetY,
} from './analytics';
import type { FigureSpec } from '../types/simulation';

describe('T2.2 Automated Curve-Fitting & Engineering Analytics', () => {
  it('solveXForTargetY solves exact log-linear BER crossings', () => {
    // BER = 10^(-SNR_dB / 10): crosses 1e-3 at exactly 30 dB
    const snrs = [0, 10, 20, 30, 40];
    const bers = snrs.map((s) => Math.pow(10, -s / 10));
    const solved = solveXForTargetY(snrs, bers, 1e-3, true);
    expect(solved).not.toBeNull();
    expect(solved!).toBeCloseTo(30, 6);

    const mid = solveXForTargetY(snrs, bers, Math.pow(10, -2.5), true);
    expect(mid).not.toBeNull();
    expect(mid!).toBeCloseTo(25, 6);
  });

  it('estimateDiversityOrder recovers exact asymptotic slope d = 1 and d = 4', () => {
    const snrs = [6, 9, 12, 15, 18, 21];
    const ber1 = snrs.map((s) => 0.25 * Math.pow(10, -s / 10));
    const ber4 = snrs.map((s) => 0.5 * Math.pow(10, (-4 * s) / 10));

    const d1 = estimateDiversityOrder(snrs, ber1);
    const d4 = estimateDiversityOrder(snrs, ber4);
    expect(d1).not.toBeNull();
    expect(d4).not.toBeNull();
    expect(d1!).toBeCloseTo(1.0, 2);
    expect(d4!).toBeCloseTo(4.0, 2);
  });

  it('estimateMultiplexingGain recovers exact 4 bps/Hz per 3 dB slope', () => {
    const snrs = [0, 5, 10, 15, 20, 25, 30];
    const cap4 = snrs.map((s) => 4 * Math.log2(1 + Math.pow(10, s / 10)));
    const r = estimateMultiplexingGain(snrs, cap4);
    expect(r).not.toBeNull();
    expect(r!).toBeGreaterThan(3.85);
    expect(r!).toBeLessThan(4.05);
  });

  it('extractFigureDiagnostics extracts SNR gain vs baseline for BER figures', () => {
    const fig: FigureSpec = {
      id: 'ber_test',
      title: 'BER vs SNR',
      shortTitle: 'BER',
      isLogY: true,
      traces: [
        {
          type: 'scatter',
          name: 'No Diversity',
          x: [0, 10, 20, 30],
          y: [0.15, 0.02, 0.002, 0.0002],
        },
        {
          type: 'scatter',
          name: 'MRC (L=4)',
          x: [0, 5, 10, 15],
          y: [0.05, 0.003, 0.0001, 0.000005],
        },
      ],
      layout: {
        xaxis: { title: { text: 'SNR (dB)' } },
        yaxis: { title: { text: 'Bit Error Rate (BER)' }, type: 'log' },
      },
      keyFindings: [],
      table: { headers: [], rows: [] },
    };

    const diag = extractFigureDiagnostics(fig);
    expect(diag).not.toBeNull();
    expect(diag!.kind).toBe('ber');
    expect(diag!.items.length).toBe(2);
    expect(diag!.items[1].deltaVsBaseline).toContain('dB gain');
  });
});
