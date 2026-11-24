import { dbToLin, linToDb } from '../engine/special';
import {
  analyticalCoverageRadiusM,
  fsplDb,
  meanRxPowerDbm,
  theoryCoverageProb,
  type Module1Params,
} from '../modules/module1/model';
import { theoryBerMrc, theoryBerNoDiv, theoryBerSc, theoryOutageMrc } from '../modules/module2/model';
import { theoryAwgnBer, theoryRayleighBer, type ModulationType } from '../modules/module3/model';
import { theoryBerDsssGaussian } from '../modules/module4/model';
import { theoryCdmaBerSga } from '../modules/module5/model';
import {
  classicalApproxSirDb,
  exactWorstCaseCellEdgeSirDb,
  reuseDistanceM,
  type ClusterSize,
} from '../modules/module6/model';
import { simulateMimoPoint, theorySisoRayleighCapacity } from '../modules/module7/model';
import {
  getUserSnrOffsetsDb,
  theoryRayleighErgodicSe,
} from '../modules/module8/model';
import type { ModuleId } from '../types/simulation';

export interface ExpectedReferenceMetric {
  key: string;
  value: number;
  unit: string;
  description: string;
}

/**
 * T1.5: Compute exact deterministic reference values directly from the WirelessLab JS engine
 * for the active module parameters so exported Python/MATLAB scripts include verifiable checkpoints.
 */
export function computeExpectedReferenceValues(
  moduleId: ModuleId,
  params: Record<string, unknown>,
): ExpectedReferenceMetric[] {
  switch (moduleId) {
    case 'module1': {
      const p = params as unknown as Module1Params;
      const fLow = Number(p.freqLowMHz ?? 900);
      const fHigh = Number(p.freqHighMHz ?? 3500);
      const n = Number(p.pathLossExp ?? 3.2);
      const sigma = Number(p.shadowSigmaDb ?? 8.0);
      const sens = Number(p.rxSensitivityDbm ?? -100);
      const gapDb = fsplDb(1000, fHigh) - fsplDb(1000, fLow);
      const prLow1km = meanRxPowerDbm(1000, p, fLow, n);
      const covLow1km = theoryCoverageProb(prLow1km, sens, sigma) * 100;
      const r90Low = analyticalCoverageRadiusM(0.9, p, fLow, n, sigma);
      return [
        { key: 'FSPL_GAP_DB', value: Number(gapDb.toFixed(4)), unit: 'dB', description: `FSPL(${fHigh} MHz) - FSPL(${fLow} MHz)` },
        { key: 'PR_LOW_1KM_DBM', value: Number(prLow1km.toFixed(4)), unit: 'dBm', description: `Mean received power at d=1000 m (${fLow} MHz)` },
        { key: 'COV_LOW_1KM_PCT', value: Number(covLow1km.toFixed(4)), unit: '%', description: `Analytical Q-function coverage at d=1000 m` },
        { key: 'R90_LOW_M', value: Number(r90Low.toFixed(2)), unit: 'm', description: `90% cell-edge coverage radius (${fLow} MHz)` },
      ];
    }

    case 'module2': {
      const L = Number(params.diversityOrder ?? params.branchesL ?? 4);
      const thDb = Number(params.outageThresholdDb ?? 5);
      const g6 = dbToLin(6);
      const g10 = dbToLin(10);
      return [
        { key: 'BER_NODIV_10DB', value: Number(theoryBerNoDiv(g10).toPrecision(6)), unit: '', description: 'Analytical BPSK No-Diversity BER at 10 dB' },
        { key: 'BER_SC_6DB', value: Number(theoryBerSc(g6, L).toPrecision(6)), unit: '', description: `Analytical SC (L=${L}) BER at 6 dB` },
        { key: 'BER_MRC_6DB', value: Number(theoryBerMrc(g6, L).toPrecision(6)), unit: '', description: `Analytical MRC (L=${L}) BER at 6 dB` },
        { key: 'OUTAGE_MRC_10DB', value: Number(theoryOutageMrc(g10, dbToLin(thDb), L).toPrecision(6)), unit: '', description: `Analytical MRC (L=${L}) outage at 10 dB (th=${thDb} dB)` },
      ];
    }

    case 'module3': {
      const mod = (String(params.modulation ?? 'QPSK') as ModulationType);
      const N = Number(params.nSubcarriers ?? 64);
      const nCp = Number(params.cpSufficient ?? params.cpLength ?? 8);
      const eff = N / (N + nCp);
      return [
        { key: 'BER_AWGN_6DB', value: Number(theoryAwgnBer(mod, 6).toPrecision(6)), unit: '', description: `Exact ${mod} AWGN BER at Eb/N0=6 dB` },
        { key: 'BER_RAYLEIGH_12DB', value: Number(theoryRayleighBer(mod, 12).toPrecision(6)), unit: '', description: `Exact ${mod} flat Rayleigh BER at Eb/N0=12 dB` },
        { key: 'CP_SPECTRAL_EFF', value: Number(eff.toFixed(6)), unit: '', description: `CP efficiency N/(N+N_cp) for N=${N}, N_cp=${nCp}` },
      ];
    }

    case 'module4': {
      const sf = Number(params.sf ?? 31);
      const eb = Number(params.fixedEbN0Db ?? 8);
      const js = Number(params.jammerJsDb ?? 10);
      const gpDb = 10 * Math.log10(sf);
      const sinrLin = 1 / (1 / dbToLin(eb) + dbToLin(js) / sf);
      return [
        { key: 'PROC_GAIN_DB', value: Number(gpDb.toFixed(4)), unit: 'dB', description: `Theoretical processing gain 10*log10(SF=${sf})` },
        { key: 'EFF_SINR_DB', value: Number(linToDb(sinrLin).toFixed(4)), unit: 'dB', description: `Post-despread SINR at Eb/N0=${eb} dB, J/S=${js} dB` },
        { key: 'BER_SGA_JAM', value: Number(theoryBerDsssGaussian(eb, js, sf).toPrecision(6)), unit: '', description: `Gaussian-approx DSSS BER under J/S=${js} dB` },
      ];
    }

    case 'module5': {
      const sf = Number(params.sf ?? 31);
      const K = Number(params.numUsersK ?? 8);
      const eb = Number(params.ebN0Db ?? 8);
      const nfr = Number(params.nearFarDb ?? 10);
      const berIdeal = theoryCdmaBerSga(eb, sf, K - 1);
      const berNoPc = theoryCdmaBerSga(eb, sf, (K - 1) * dbToLin(nfr));
      const sirIdealDb = linToDb(sf / Math.max(K - 1, 1));
      return [
        { key: 'SIR_IDEAL_PC_DB', value: Number(sirIdealDb.toFixed(4)), unit: 'dB', description: `Ideal PC SIR = SF/(K-1) for K=${K}, SF=${sf}` },
        { key: 'BER_IDEAL_PC_SGA', value: Number(berIdeal.toPrecision(6)), unit: '', description: `SGA BER with Ideal Power Control (Eb/N0=${eb} dB)` },
        { key: 'BER_NOPC_SGA', value: Number(berNoPc.toPrecision(6)), unit: '', description: `SGA BER without PC at Near-Far Ratio=${nfr} dB` },
      ];
    }

    case 'module6': {
      const R = Number(params.cellRadiusM ?? 1000);
      const n = Number(params.pathLossExp ?? 3.5);
      const N = Number(params.selectedClusterN ?? 7) as ClusterSize;
      const secondTier = Boolean(params.includeSecondTier);
      const D = reuseDistanceM(R, N);
      const approxSir = classicalApproxSirDb(N, n);
      const exactSir = exactWorstCaseCellEdgeSirDb(R, N, n, secondTier);
      return [
        { key: 'REUSE_DIST_M', value: Number(D.toFixed(2)), unit: 'm', description: `Co-channel reuse distance D = R*sqrt(3N) for N=${N}` },
        { key: 'SIR_APPROX_DB', value: Number(approxSir.toFixed(4)), unit: 'dB', description: `Classical cell-edge SIR approx (sqrt(3N))^n / 6` },
        { key: 'SIR_EXACT_EDGE_DB', value: Number(exactSir.toFixed(4)), unit: 'dB', description: `Exact deterministic cell-edge SIR (N=${N}, n=${n})` },
      ];
    }

    case 'module7': {
      const snrDb = Number(params.fixedSnrDb ?? 15);
      const seed = Number(params.seed ?? 44107);
      const sisoTheory = theorySisoRayleighCapacity(dbToLin(snrDb));
      const mimo4 = simulateMimoPoint({
        nt: 4,
        nr: 4,
        snrDb,
        rTx: 0,
        rRx: 0,
        numRealizations: 1500,
        baseSeed: seed,
        experimentId: 799,
        pointIndex: 0,
      });
      return [
        { key: 'SISO_THEORY_BPS_HZ', value: Number(sisoTheory.toFixed(4)), unit: 'bps/Hz', description: `Exact SISO Rayleigh ergodic capacity at ${snrDb} dB` },
        { key: 'MIMO_4X4_ERGODIC_BPS_HZ', value: Number(mimo4.ergodicCapacity.toFixed(4)), unit: 'bps/Hz', description: `4x4 i.i.d. Rayleigh ergodic capacity at ${snrDb} dB` },
        { key: 'MIMO_4X4_OUTAGE10_BPS_HZ', value: Number(mimo4.outage10Capacity.toFixed(4)), unit: 'bps/Hz', description: `4x4 10% outage capacity at ${snrDb} dB` },
      ];
    }

    case 'module8': {
      const K = Number(params.numUsersK ?? 4);
      const B = Number(params.bandwidthMHz ?? 20);
      const meanSnr = Number(params.operatingSnrDb ?? 14);
      const spread = Number(params.snrSpreadDb ?? 22);
      const offsets = getUserSnrOffsetsDb(K, spread);
      const tdmaSe =
        offsets.reduce((acc, off) => acc + theoryRayleighErgodicSe(dbToLin(meanSnr + off)), 0) /
        Math.max(offsets.length, 1);
      const tdmaMbps = tdmaSe * B;
      return [
        { key: 'TDMA_ERGODIC_MBPS', value: Number(tdmaMbps.toFixed(4)), unit: 'Mbps', description: `Exact analytical TDMA ergodic throughput at ${meanSnr} dB` },
        { key: 'TDMA_SE_BPS_HZ', value: Number(tdmaSe.toFixed(4)), unit: 'bps/Hz', description: `TDMA spectral efficiency (B=${B} MHz)` },
        { key: 'USER_SNR_SPREAD_DB', value: Number(spread.toFixed(2)), unit: 'dB', description: `Multiuser SNR disparity across K=${K} users` },
      ];
    }
  }
}

function formatExpectedHeaderBlock(
  commentPrefix: '#' | '%',
  metrics: ExpectedReferenceMetric[],
): string {
  const lines = [
    `${commentPrefix} =====================================================================`,
    `${commentPrefix} EXPECTED REFERENCE VALUES (WirelessLab ECE441 JS Engine Cross-Check)`,
    `${commentPrefix} Verify your local Python/MATLAB run reproduces these numbers:`,
    ...metrics.map(
      (m) =>
        `${commentPrefix} @EXPECTED ${m.key}=${m.value}${m.unit ? ` (${m.unit})` : ''} — ${m.description}`,
    ),
    `${commentPrefix} =====================================================================`,
  ];
  return lines.join('\n');
}

/**
 * Parse embedded `@EXPECTED KEY=VALUE` reference lines from an exported Python or MATLAB script.
 */
export function parseExpectedReferenceValues(scriptContent: string): Record<string, number> {
  const result: Record<string, number> = {};
  const regex = /^[#%]\s*@EXPECTED\s+([A-Z0-9_]+)=([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/gm;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(scriptContent)) !== null) {
    result[match[1]] = Number(match[2]);
  }
  return result;
}

/**
 * E6 + T1.5: Generate standalone, commented Python (NumPy/SciPy/Matplotlib) reproduction scripts
 * with embedded JS-engine expected reference values for cross-checking.
 */
export function generatePythonScript(
  moduleId: ModuleId,
  params: Record<string, unknown>,
): { filename: string; content: string } {
  const seed = Number(params.seed ?? 44100);
  const expectedBlock = formatExpectedHeaderBlock(
    '#',
    computeExpectedReferenceValues(moduleId, params),
  );
  const header = `#!/usr/bin/env python3
"""
WirelessLab ECE441 — Reproducible Python Simulation Script (${moduleId.toUpperCase()})
Course: ECE 441 - Wireless and Mobile Communications (Delta University)
Parameters Snapshot: ${JSON.stringify(params)}
Dependencies: numpy, scipy, matplotlib
"""
${expectedBlock}

import math
import numpy as np
from scipy.special import erfc, exp1
import matplotlib.pyplot as plt

SEED = ${seed}
rng = np.random.default_rng(SEED)
Q = lambda x: 0.5 * erfc(x / np.sqrt(2.0))
`;

  switch (moduleId) {
    case 'module1':
      return {
        filename: 'ece441_module1_propagation.py',
        content: `${header}
f_low, f_high = ${params.freqLowMHz ?? 900}, ${params.freqHighMHz ?? 3500}  # MHz
Pt, Gt, Gr, sens = ${params.txPowerDbm ?? 43}, ${params.gtDbi ?? 15}, ${params.grDbi ?? 0}, ${params.rxSensitivityDbm ?? -100}
n, sigma, d0 = ${params.pathLossExp ?? 3.2}, ${params.shadowSigmaDb ?? 8.0}, ${params.d0M ?? 100}
samples = ${params.mcSamples ?? 4000}
dists = np.geomspace(${params.dMinM ?? 100}, ${params.dMaxM ?? 5000}, ${params.dPoints ?? 26})

def fspl(d_m, f_mhz):
    return 32.44 + 20 * np.log10(d_m / 1000.0) + 20 * np.log10(f_mhz)

print(f"FSPL gap ({f_high} vs {f_low} MHz): {fspl(1000, f_high) - fspl(1000, f_low):.4f} dB")
for f_mhz in [f_low, f_high]:
    pl_mean = fspl(d0, f_mhz) + 10 * n * np.log10(dists / d0)
    pr_mean = Pt + Gt + Gr - pl_mean
    cov_sim = [np.mean((pm - rng.normal(0, sigma, samples)) >= sens) * 100 for pm in pr_mean]
    cov_th = Q((sens - pr_mean) / sigma) * 100
    plt.semilogx(dists, cov_sim, 'o', label=f'{f_mhz} MHz Sim')
    plt.semilogx(dists, cov_th, '--', label=f'{f_mhz} MHz Q-Theory')

plt.xlabel('Distance d (m)'); plt.ylabel('Coverage Probability (%)')
plt.title(f'Module 1: Coverage Probability (n={n}, sigma={sigma} dB)')
plt.grid(True, which='both'); plt.legend(); plt.tight_layout(); plt.show()
`,
      };

    case 'module2':
      return {
        filename: 'ece441_module2_diversity.py',
        content: `${header}
L = ${params.diversityOrder ?? params.branchesL ?? 4}
snr_db = np.arange(${params.snrMinDb ?? 0}, ${params.snrMaxDb ?? 24} + 1e-9, ${params.snrStepDb ?? 3})
bits = ${params.numBitsPerPoint ?? params.bitsPerPoint ?? 80000}

ber_nodiv, ber_sc, ber_egc, ber_mrc, th_mrc = [], [], [], [], []
for db in snr_db:
    g = 10 ** (db / 10.0)
    h = (rng.normal(size=(bits, L)) + 1j * rng.normal(size=(bits, L))) / np.sqrt(2.0)
    n0 = (rng.normal(size=(bits, L)) + 1j * rng.normal(size=(bits, L))) * np.sqrt(1.0 / (2.0 * g))
    b = rng.choice([-1.0, 1.0], size=(bits, 1))
    y = h * b + n0

    ber_nodiv.append(np.mean(np.real(np.conj(h[:, 0]) * y[:, 0]) * b[:, 0] < 0))
    idx = np.argmax(np.abs(h) ** 2, axis=1)
    rows = np.arange(bits)
    ber_sc.append(np.mean(np.real(np.conj(h[rows, idx]) * y[rows, idx]) * b[:, 0] < 0))
    ber_egc.append(np.mean(np.real(np.sum(np.exp(-1j * np.angle(h)) * y, axis=1)) * b[:, 0] < 0))
    ber_mrc.append(np.mean(np.real(np.sum(np.conj(h) * y, axis=1)) * b[:, 0] < 0))
    mu = np.sqrt(g / (1.0 + g))
    p = 0.5 * (1.0 - mu)
    th_mrc.append((p ** L) * sum(math.comb(L - 1 + k, k) * ((1 - p) ** k) for k in range(L)))

plt.semilogy(snr_db, ber_nodiv, 'o-', label='No Diversity')
plt.semilogy(snr_db, ber_sc, 's-', label=f'SC (L={L})')
plt.semilogy(snr_db, ber_egc, 'd-', label=f'EGC (L={L})')
plt.semilogy(snr_db, ber_mrc, '^-', label=f'MRC (L={L})')
plt.semilogy(snr_db, th_mrc, 'k--', label=f'MRC Theory (L={L})')
plt.xlabel('Average SNR per Branch (dB)'); plt.ylabel('BER'); plt.ylim(1e-5, 1)
plt.title('Module 2: Diversity Combining over Rayleigh Fading')
plt.grid(True, which='both'); plt.legend(); plt.tight_layout(); plt.show()
`,
      };

    case 'module3':
      return {
        filename: 'ece441_module3_ofdm_cp.py',
        content: `${header}
N = ${params.nSubcarriers ?? 64}
Ncp = ${params.cpSufficient ?? params.cpLength ?? 8}
L = ${params.channelTaps ?? 9}
snr_db = np.arange(${params.snrMinDb ?? 0}, ${params.snrMaxDb ?? 24} + 1e-9, ${params.snrStepDb ?? 3})
n_syms = max(200, int(${params.numTrials ?? 320} * ${params.symbolsPerChannel ?? 4}))

pdp = np.exp(-${params.pdpDecay ?? 3.0} * np.arange(L) / max(1, L - 1))
pdp /= np.sum(pdp)

ber_cp, ber_nocp = [], []
for db in snr_db:
    ebn0 = 10 ** (db / 10.0)
    n0 = 1.0 / (2.0 * ebn0)
    for use_cp, store in [(Ncp, ber_cp), (0, ber_nocp)]:
        errs = 0
        prev_tail = np.zeros(L - 1, dtype=complex)
        for _ in range(n_syms):
            bits = rng.integers(0, 2, size=(N, 2))
            syms = ((1 - 2 * bits[:, 0]) + 1j * (1 - 2 * bits[:, 1])) / np.sqrt(2.0)
            x_t = np.fft.ifft(syms) * np.sqrt(N)
            tx = np.concatenate([x_t[N - use_cp:], x_t]) if use_cp > 0 else x_t
            h = (rng.normal(size=L) + 1j * rng.normal(size=L)) * np.sqrt(pdp / 2.0)
            y_conv = np.convolve(tx, h)
            y_conv[:L - 1] += prev_tail
            prev_tail = y_conv[len(tx):len(tx) + L - 1].copy()
            y_rx = y_conv[use_cp:use_cp + N] + (rng.normal(size=N) + 1j * rng.normal(size=N)) * np.sqrt(n0 / 2.0)
            Y = np.fft.fft(y_rx) / np.sqrt(N)
            H = np.fft.fft(h, N)
            X_hat = Y / H
            b_hat = np.column_stack([(np.real(X_hat) < 0).astype(int), (np.imag(X_hat) < 0).astype(int)])
            errs += np.sum(b_hat != bits)
        store.append(errs / (n_syms * 2 * N))

plt.semilogy(snr_db, ber_nocp, 's-', label='No CP (Ncp=0)')
plt.semilogy(snr_db, ber_cp, 'o-', label=f'With CP (Ncp={Ncp}, L={L})')
plt.semilogy(snr_db, 0.5 * (1 - np.sqrt(10**(snr_db/10) / (1 + 10**(snr_db/10)))), 'k--', label='Rayleigh QPSK Theory')
plt.xlabel('Eb/N0 (dB)'); plt.ylabel('BER'); plt.ylim(1e-4, 1)
plt.title('Module 3: OFDM Performance with Linear-Convolution ISI')
plt.grid(True, which='both'); plt.legend(); plt.tight_layout(); plt.show()
`,
      };

    case 'module4':
      return {
        filename: 'ece441_module4_dsss.py',
        content: `${header}
SF = ${params.sf ?? 31}
ebn0_db = ${params.fixedEbN0Db ?? 8}
js_grid = np.arange(${params.jsMinDb ?? -5}, ${params.jsMaxDb ?? 20} + 1e-9, ${params.jsStepDb ?? 2.5})
fj = ${params.jammerFreqNorm ?? 0.13}
bits = ${params.bitsPerPoint ?? 15000}
noise_std = np.sqrt(1.0 / (2.0 * 10 ** (ebn0_db / 10.0)))

ber_sim, ber_th = [], []
for js_db in js_grid:
    js = 10 ** (js_db / 10.0)
    amp = np.sqrt(js / SF)
    b = rng.choice([-1.0, 1.0], size=(bits, 1))
    pn = rng.choice([-1.0, 1.0], size=(bits, SF))
    phi = rng.uniform(0, 2 * np.pi, size=(bits, 1))
    n = np.arange(SF)[None, :]
    rx = b * pn / np.sqrt(SF) + rng.normal(0, noise_std, size=(bits, SF)) + amp * np.cos(2 * np.pi * fj * n + phi)
    corr = np.sum(rx * pn, axis=1) / np.sqrt(SF)
    ber_sim.append(np.mean((corr >= 0) != (b[:, 0] > 0)))
    sinr = 1.0 / (1.0 / (10 ** (ebn0_db / 10.0)) + js / SF)
    ber_th.append(Q(np.sqrt(2.0 * sinr)))

plt.semilogy(js_grid, ber_sim, 'o', label=f'DSSS SF={SF} Sim')
plt.semilogy(js_grid, ber_th, '--', label='Gaussian Approx Theory')
plt.xlabel('Jammer-to-Signal J/S (dB)'); plt.ylabel('BER'); plt.ylim(1e-5, 1)
plt.title(f'Module 4: DSSS Jamming Immunity (SF={SF}, Gp={10*np.log10(SF):.1f} dB)')
plt.grid(True, which='both'); plt.legend(); plt.tight_layout(); plt.show()
`,
      };

    case 'module5':
      return {
        filename: 'ece441_module5_cdma_pc.py',
        content: `${header}
SF = ${params.sf ?? 31}
K = ${params.numUsersK ?? 8}
ebn0_db = ${params.ebN0Db ?? 8}
nfr_grid = np.array([-5, 0, 3, 6, 9, 12, 15, 18, 20])
bits = ${params.bitsPerPoint ?? 12000}
noise_std = np.sqrt(1.0 / (2.0 * 10 ** (ebn0_db / 10.0)))

ber_nopc, ber_ideal, ber_sga = [], [], []
for nfr in nfr_grid:
    p_ratio = 10 ** (nfr / 10.0)
    for pc_on, store in [(False, ber_nopc), (True, ber_ideal)]:
        errs = 0
        for _ in range(bits):
            codes = rng.choice([-1.0, 1.0], size=(K, SF)) / np.sqrt(SF)
            b = rng.choice([-1.0, 1.0], size=K)
            amps = np.ones(K) if pc_on else np.array([1.0] + [np.sqrt(p_ratio)] * (K - 1))
            phases = np.array([1.0] + list(np.cos(rng.uniform(0, 2 * np.pi, K - 1))))
            rx = np.sum((b * amps * phases)[:, None] * codes, axis=0) + rng.normal(0, noise_std, SF)
            if (np.dot(rx, codes[0]) >= 0) != (b[0] > 0):
                errs += 1
        store.append(errs / bits)
    sinr = 1.0 / (1.0 / (10 ** (ebn0_db / 10.0)) + (K - 1) * p_ratio / SF)
    ber_sga.append(Q(np.sqrt(2.0 * sinr)))

plt.semilogy(nfr_grid, ber_nopc, 's-', label='No Power Control')
plt.semilogy(nfr_grid, ber_ideal, 'o-', label='Ideal Power Control')
plt.semilogy(nfr_grid, ber_sga, 'k--', label='No PC SGA Theory')
plt.xlabel('Near-Far Ratio (dB)'); plt.ylabel('Desired User BER'); plt.ylim(1e-5, 1)
plt.title(f'Module 5: CDMA Near-Far Problem (K={K}, SF={SF})')
plt.grid(True, which='both'); plt.legend(); plt.tight_layout(); plt.show()
`,
      };

    case 'module6':
      return {
        filename: 'ece441_module6_reuse_cci.py',
        content: `${header}
R = ${params.cellRadiusM ?? 1000}
n = ${params.pathLossExp ?? 3.5}
sigma = ${params.shadowingEnabled ? params.shadowSigmaDb ?? 6.0 : 0}
users = ${params.mcUsers ?? 5000}
clusters = [(1, 1, 0), (3, 1, 1), (4, 2, 0), (7, 2, 1), (9, 3, 0), (12, 2, 2)]

mean_sir, approx_sir = [], []
for N, i_idx, j_idx in clusters:
    e1 = np.array([np.sqrt(3) * R, 0.0])
    e2 = np.array([0.5 * np.sqrt(3) * R, 1.5 * R])
    v0 = i_idx * e1 + j_idx * e2
    centers = [np.array([v0[0]*np.cos(k*np.pi/3) - v0[1]*np.sin(k*np.pi/3),
                         v0[0]*np.sin(k*np.pi/3) + v0[1]*np.cos(k*np.pi/3)]) for k in range(6)]
    pts = []
    while len(pts) < users:
        x, y = rng.uniform(-R, R, 2)
        if abs(x) <= np.sqrt(3)/2 * R and abs(y) + abs(x)/np.sqrt(3) <= R:
            pts.append((x, y))
    pts = np.array(pts)
    d0 = np.maximum(0.05 * R, np.hypot(pts[:, 0], pts[:, 1]))
    sig = (d0 ** -n) * (10 ** (rng.normal(0, sigma, users) / 10.0) if sigma > 0 else 1.0)
    interf = sum((np.maximum(0.05 * R, np.hypot(pts[:, 0] - c[0], pts[:, 1] - c[1])) ** -n) *
                 (10 ** (rng.normal(0, sigma, users) / 10.0) if sigma > 0 else 1.0) for c in centers)
    mean_sir.append(np.mean(10 * np.log10(sig / interf)))
    approx_sir.append(10 * np.log10((np.sqrt(3 * N) ** n) / 6.0))

ns = [c[0] for c in clusters]
plt.plot(ns, mean_sir, 'o-', label='MC Mean SIR (dB)')
plt.plot(ns, approx_sir, 'k--', label='Classical Approx (sqrt(3N))^n / 6')
plt.xlabel('Cluster Size N'); plt.ylabel('SIR (dB)')
plt.title(f'Module 6: Cellular Frequency Reuse & CCI (n={n}, sigma={sigma} dB)')
plt.grid(True); plt.legend(); plt.tight_layout(); plt.show()
`,
      };

    case 'module7':
      return {
        filename: 'ece441_module7_mimo_capacity.py',
        content: `${header}
snr_db = np.arange(${params.snrMinDb ?? 0}, ${params.snrMaxDb ?? 30} + 1e-9, ${params.snrStepDb ?? 5})
trials = ${params.numRealizations ?? 10000}

for (nt, nr) in [(1, 1), (2, 2), (4, 4)]:
    caps = []
    for db in snr_db:
        rho = 10 ** (db / 10.0)
        H = (rng.normal(size=(trials, nr, nt)) + 1j * rng.normal(size=(trials, nr, nt))) / np.sqrt(2.0)
        HH = H @ np.conj(np.swapaxes(H, 1, 2))
        M = np.eye(nr)[None, :, :] + (rho / nt) * HH
        _, logdet = np.linalg.slogdet(M)
        caps.append(np.mean(np.real(logdet) / np.log(2.0)))
    plt.plot(snr_db, caps, 'o-', label=f'{nt}x{nr} MIMO')

rho_v = 10 ** (snr_db / 10.0)
siso_th = np.exp(1.0 / rho_v) * exp1(1.0 / rho_v) / np.log(2.0)
plt.plot(snr_db, siso_th, 'k--', label='SISO Analytical Theory')
plt.xlabel('SNR (dB)'); plt.ylabel('Ergodic Capacity (bits/s/Hz)')
plt.title('Module 7: SISO vs MIMO Rayleigh Capacity')
plt.grid(True); plt.legend(); plt.tight_layout(); plt.show()
`,
      };

    case 'module8':
      return {
        filename: 'ece441_module8_tdma_ofdma.py',
        content: `${header}
K = ${params.numUsersK ?? 4}
B = ${params.bandwidthMHz ?? 20}  # MHz
Nsc = ${params.nSubcarriers ?? 64}
Bsc = B / Nsc
frames = ${params.realizations ?? 2000}
offsets = np.array([11, 4, -4, -11]) if K == 4 else np.linspace(${params.snrSpreadDb ?? 22}/2, -${params.snrSpreadDb ?? 22}/2, K)
snrs = np.array([0, 4, 8, 12, 14, 18, 22, 26])

tdma_r, max_r, pf_r = [], [], []
for mean_db in snrs:
    g_avg = 10 ** ((mean_db + offsets) / 10.0)
    H = (rng.normal(size=(frames, K, Nsc)) + 1j * rng.normal(size=(frames, K, Nsc))) / np.sqrt(2.0)
    rates = Bsc * np.log2(1.0 + g_avg[None, :, None] * (np.abs(H) ** 2))
    tdma_r.append(np.mean(np.sum(rates, axis=2)))
    max_r.append(np.mean(np.sum(np.max(rates, axis=1), axis=1)))
    avg_pf = np.ones(K)
    pf_acc = np.zeros(K)
    for t in range(frames):
        metric = rates[t] / (avg_pf[:, None] + 1e-6)
        winners = np.argmax(metric, axis=0)
        fr = np.bincount(winners, weights=rates[t, winners, np.arange(Nsc)], minlength=K)
        pf_acc += fr
        avg_pf = 0.95 * avg_pf + 0.05 * fr
    pf_r.append(np.sum(pf_acc / frames))

plt.plot(snrs, tdma_r, 's-', label='TDMA (Equal Time)')
plt.plot(snrs, pf_r, 'o-', label='OFDMA Proportional Fair')
plt.plot(snrs, max_r, '^-', label='OFDMA Max-Sum-Rate')
plt.xlabel('Mean SNR (dB)'); plt.ylabel('Total Throughput (Mbps)')
plt.title(f'Module 8: TDMA vs OFDMA Multiuser Performance (K={K}, B={B} MHz)')
plt.grid(True); plt.legend(); plt.tight_layout(); plt.show()
`,
      };
  }
}

/**
 * E6 + T1.5: Generate standalone, commented MATLAB (.m) reproduction scripts
 * with embedded JS-engine expected reference values for cross-checking.
 */
export function generateMatlabScript(
  moduleId: ModuleId,
  params: Record<string, unknown>,
): { filename: string; content: string } {
  const seed = Number(params.seed ?? 44100);
  const expectedBlock = formatExpectedHeaderBlock(
    '%',
    computeExpectedReferenceValues(moduleId, params),
  );
  const header = `% WirelessLab ECE441 — Reproducible MATLAB Script (${moduleId.toUpperCase()})
% Course: ECE 441 - Wireless and Mobile Communications (Delta University)
% Parameters: ${JSON.stringify(params)}
${expectedBlock}

clear; clc; close all;
rng(${seed});
Qfunc = @(x) 0.5 * erfc(x / sqrt(2));
`;

  switch (moduleId) {
    case 'module1':
      return {
        filename: 'ece441_module1_propagation.m',
        content: `${header}
f_bands = [${params.freqLowMHz ?? 900}, ${params.freqHighMHz ?? 3500}]; % MHz
Pt = ${params.txPowerDbm ?? 43}; Gt = ${params.gtDbi ?? 15}; Gr = ${params.grDbi ?? 0};
sens = ${params.rxSensitivityDbm ?? -100}; n = ${params.pathLossExp ?? 3.2};
sigma = ${params.shadowSigmaDb ?? 8.0}; d0 = ${params.d0M ?? 100};
dists = logspace(log10(${params.dMinM ?? 100}), log10(${params.dMaxM ?? 5000}), ${params.dPoints ?? 26});
fspl = @(d, f) 32.44 + 20*log10(d/1000) + 20*log10(f);

figure; hold on; grid on;
for f = f_bands
    pr_mean = Pt + Gt + Gr - (fspl(d0, f) + 10*n*log10(dists/d0));
    cov_sim = arrayfun(@(pm) mean((pm - sigma*randn(${params.mcSamples ?? 4000},1)) >= sens)*100, pr_mean);
    cov_th = Qfunc((sens - pr_mean)/sigma)*100;
    semilogx(dists, cov_sim, 'o', 'DisplayName', sprintf('%g MHz Sim', f));
    semilogx(dists, cov_th, '--', 'DisplayName', sprintf('%g MHz Theory', f));
end
set(gca, 'XScale', 'log'); xlabel('Distance d (m)'); ylabel('Coverage Probability (%)');
title('Module 1: Propagation & Shadowing Coverage'); legend('show');
`,
      };

    case 'module2':
      return {
        filename: 'ece441_module2_diversity.m',
        content: `${header}
L = ${params.diversityOrder ?? params.branchesL ?? 4};
snr_db = ${params.snrMinDb ?? 0}:${params.snrStepDb ?? 3}:${params.snrMaxDb ?? 24};
bits = ${params.numBitsPerPoint ?? params.bitsPerPoint ?? 80000};
ber_nodiv = zeros(size(snr_db)); ber_sc = ber_nodiv; ber_mrc = ber_nodiv;

for idx = 1:length(snr_db)
    g = 10^(snr_db(idx)/10);
    h = (randn(bits, L) + 1j*randn(bits, L))/sqrt(2);
    w = (randn(bits, L) + 1j*randn(bits, L))*sqrt(1/(2*g));
    b = 2*randi([0 1], bits, 1) - 1;
    y = h .* b + w;
    ber_nodiv(idx) = mean(real(conj(h(:,1)).*y(:,1)).*b < 0);
    [~, best] = max(abs(h).^2, [], 2);
    lin = sub2ind([bits L], (1:bits)', best);
    ber_sc(idx) = mean(real(conj(h(lin)).*y(lin)).*b < 0);
    ber_mrc(idx) = mean(real(sum(conj(h).*y, 2)).*b < 0);
end
figure; semilogy(snr_db, ber_nodiv, 'o-', snr_db, ber_sc, 's-', snr_db, ber_mrc, '^-');
grid on; xlabel('Average SNR/Branch (dB)'); ylabel('BER');
legend('No Diversity', sprintf('SC (L=%d)', L), sprintf('MRC (L=%d)', L));
title('Module 2: Rayleigh Diversity Combining');
`,
      };

    case 'module3':
      return {
        filename: 'ece441_module3_ofdm_cp.m',
        content: `${header}
N = ${params.nSubcarriers ?? 64}; Ncp = ${params.cpSufficient ?? params.cpLength ?? 8}; L = ${params.channelTaps ?? 9};
snr_db = ${params.snrMinDb ?? 0}:${params.snrStepDb ?? 3}:${params.snrMaxDb ?? 24};
pdp = exp(-${params.pdpDecay ?? 3.0}*(0:L-1)/max(1,L-1)); pdp = pdp / sum(pdp);
nSyms = max(200, floor(${params.numTrials ?? 320} * ${params.symbolsPerChannel ?? 4}));
ber_cp = zeros(size(snr_db)); ber_nocp = zeros(size(snr_db));

for idx = 1:length(snr_db)
    n0 = 1 / (2 * 10^(snr_db(idx)/10));
    for mode = 1:2
        cp = (mode == 1) * Ncp;
        errs = 0; prev_tail = zeros(L-1, 1);
        for s = 1:nSyms
            bits = randi([0 1], N, 2);
            X = ((1 - 2*bits(:,1)) + 1j*(1 - 2*bits(:,2)))/sqrt(2);
            xt = ifft(X)*sqrt(N);
            tx = [xt(end-cp+1:end); xt];
            h = (randn(L,1)+1j*randn(L,1)).*sqrt(pdp(:)/2);
            yc = conv(tx, h); yc(1:L-1) = yc(1:L-1) + prev_tail;
            prev_tail = yc(length(tx)+1:end);
            yr = yc(cp+1:cp+N) + (randn(N,1)+1j*randn(N,1))*sqrt(n0/2);
            Xh = (fft(yr)/sqrt(N)) ./ fft(h, N);
            bhat = [real(Xh)<0, imag(Xh)<0];
            errs = errs + sum(bhat(:) ~= bits(:));
        end
        if mode == 1, ber_cp(idx) = errs/(nSyms*2*N); else, ber_nocp(idx) = errs/(nSyms*2*N); end
    end
end
figure; semilogy(snr_db, ber_nocp, 's-', snr_db, ber_cp, 'o-'); grid on;
xlabel('Eb/N0 (dB)'); ylabel('BER'); legend('No CP', sprintf('CP=%d (L=%d)', Ncp, L));
title('Module 3: OFDM Multipath & Cyclic Prefix Study');
`,
      };

    case 'module4':
      return {
        filename: 'ece441_module4_dsss.m',
        content: `${header}
SF = ${params.sf ?? 31}; ebn0_db = ${params.fixedEbN0Db ?? 8};
js_grid = ${params.jsMinDb ?? -5}:${params.jsStepDb ?? 2.5}:${params.jsMaxDb ?? 20};
fj = ${params.jammerFreqNorm ?? 0.13}; bits = ${params.bitsPerPoint ?? 15000};
noise_std = sqrt(1/(2*10^(ebn0_db/10)));
ber_sim = zeros(size(js_grid)); ber_th = ber_sim;

for idx = 1:length(js_grid)
    js = 10^(js_grid(idx)/10); amp = sqrt(js/SF);
    b = 2*randi([0 1], bits, 1) - 1;
    pn = 2*randi([0 1], bits, SF) - 1;
    phi = 2*pi*rand(bits, 1);
    n = 0:SF-1;
    rx = (b.*pn)/sqrt(SF) + noise_std*randn(bits, SF) + amp*cos(2*pi*fj*n + phi);
    corr = sum(rx.*pn, 2)/sqrt(SF);
    ber_sim(idx) = mean((corr >= 0) ~= (b > 0));
    sinr = 1 / (1/10^(ebn0_db/10) + js/SF);
    ber_th(idx) = Qfunc(sqrt(2*sinr));
end
figure; semilogy(js_grid, ber_sim, 'o', js_grid, ber_th, '--'); grid on;
xlabel('J/S (dB)'); ylabel('BER'); legend(sprintf('DSSS SF=%d Sim', SF), 'Gaussian Approx');
title('Module 4: DSSS under Narrowband Interference');
`,
      };

    case 'module5':
      return {
        filename: 'ece441_module5_cdma_pc.m',
        content: `${header}
SF = ${params.sf ?? 31}; K = ${params.numUsersK ?? 8}; ebn0_db = ${params.ebN0Db ?? 8};
nfr_grid = [-5 0 3 6 9 12 15 18 20]; bits = ${params.bitsPerPoint ?? 10000};
noise_std = sqrt(1/(2*10^(ebn0_db/10)));
ber_nopc = zeros(size(nfr_grid)); ber_pc = ber_nopc;

for idx = 1:length(nfr_grid)
    pr = 10^(nfr_grid(idx)/10);
    for m = 1:2
        errs = 0;
        for b_i = 1:bits
            C = (2*randi([0 1], K, SF) - 1)/sqrt(SF);
            b = 2*randi([0 1], K, 1) - 1;
            amps = ones(K,1); if m == 1, amps(2:end) = sqrt(pr); end
            ph = [1; cos(2*pi*rand(K-1,1))];
            rx = sum((b.*amps.*ph).*C, 1) + noise_std*randn(1, SF);
            errs = errs + ((rx*C(1,:)' >= 0) ~= (b(1) > 0));
        end
        if m == 1, ber_nopc(idx) = errs/bits; else, ber_pc(idx) = errs/bits; end
    end
end
figure; semilogy(nfr_grid, ber_nopc, 's-', nfr_grid, ber_pc, 'o-'); grid on;
xlabel('Near-Far Ratio (dB)'); ylabel('BER'); legend('No PC', 'Ideal PC');
title(sprintf('Module 5: CDMA Near-Far & Power Control (K=%d, SF=%d)', K, SF));
`,
      };

    case 'module6':
      return {
        filename: 'ece441_module6_reuse_cci.m',
        content: `${header}
R = ${params.cellRadiusM ?? 1000}; n = ${params.pathLossExp ?? 3.5};
N_list = [1 3 4 7 9 12];
q = sqrt(3*N_list);
sir_approx_db = 10*log10((q.^n)/6);
figure; plot(N_list, sir_approx_db, 'o-'); grid on;
xlabel('Cluster Size N'); ylabel('Approx Cell-Edge SIR (dB)');
title(sprintf('Module 6: Cellular Frequency Reuse SIR (n=%.1f)', n));
`,
      };

    case 'module7':
      return {
        filename: 'ece441_module7_mimo_capacity.m',
        content: `${header}
snr_db = ${params.snrMinDb ?? 0}:${params.snrStepDb ?? 5}:${params.snrMaxDb ?? 30};
trials = ${params.numRealizations ?? 10000};
configs = [1 1; 2 2; 4 4];
figure; hold on; grid on;
for c = 1:size(configs, 1)
    nt = configs(c,1); nr = configs(c,2);
    cap = zeros(size(snr_db));
    for idx = 1:length(snr_db)
        rho = 10^(snr_db(idx)/10);
        acc = 0;
        for t = 1:trials
            H = (randn(nr,nt)+1j*randn(nr,nt))/sqrt(2);
            acc = acc + real(log2(det(eye(nr) + (rho/nt)*(H*H'))));
        end
        cap(idx) = acc / trials;
    end
    plot(snr_db, cap, 'o-', 'DisplayName', sprintf('%dx%d MIMO', nt, nr));
end
xlabel('SNR (dB)'); ylabel('Ergodic Capacity (bits/s/Hz)');
title('Module 7: SISO vs MIMO Rayleigh Capacity'); legend('show');
`,
      };

    case 'module8':
      return {
        filename: 'ece441_module8_tdma_ofdma.m',
        content: `${header}
K = ${params.numUsersK ?? 4}; B = ${params.bandwidthMHz ?? 20}; Nsc = ${params.nSubcarriers ?? 64};
Bsc = B / Nsc; frames = ${params.realizations ?? 2000};
offsets = [11 4 -4 -11]; if K ~= 4, offsets = linspace(11, -11, K); end
snrs = [0 4 8 12 14 18 22 26];
tdma_r = zeros(size(snrs)); max_r = tdma_r;

for idx = 1:length(snrs)
    g = 10.^((snrs(idx) + offsets)/10);
    t_acc = 0; m_acc = 0;
    for f = 1:frames
        H = (randn(K, Nsc) + 1j*randn(K, Nsc))/sqrt(2);
        rates = Bsc * log2(1 + g(:).*abs(H).^2);
        t_acc = t_acc + mean(sum(rates, 2));
        m_acc = m_acc + sum(max(rates, [], 1));
    end
    tdma_r(idx) = t_acc/frames; max_r(idx) = m_acc/frames;
end
figure; plot(snrs, tdma_r, 's-', snrs, max_r, '^-'); grid on;
xlabel('Mean SNR (dB)'); ylabel('Total Throughput (Mbps)');
legend('TDMA', 'OFDMA Max-Sum-Rate'); title('Module 8: TDMA vs OFDMA');
`,
      };
  }
}
