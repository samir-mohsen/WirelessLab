import { dbToLin, linToDb, qFunc } from './special';

export interface LinkBudgetInput {
  txPowerDbm: number;
  txGainDbi: number;
  rxGainDbi: number;
  cableLossDb: number;
  freqMHz: number;
  distanceM: number;
  d0M: number;
  pathLossExp: number;
  bandwidthMHz: number;
  noiseFigureDb: number;
  rxSensitivityDbm: number;
}

export interface LinkBudgetOutput {
  wavelengthM: number;
  fsplAtD0Db: number;
  fsplAtDDb: number;
  logDistancePlDb: number;
  eirpDbm: number;
  rxPowerDbm: number;
  thermalNoiseDbm: number;
  snrDb: number;
  fadeMarginDb: number;
  shannonCapacityMbps: number;
}

export function computeLinkBudget(inp: LinkBudgetInput): LinkBudgetOutput {
  const c = 299_792_458;
  const fHz = Math.max(inp.freqMHz, 1) * 1e6;
  const wavelengthM = c / fHz;
  const d0 = Math.max(inp.d0M, 1);
  const d = Math.max(inp.distanceM, 1);

  const fsplAtD0Db = 32.44 + 20 * Math.log10(d0 / 1000) + 20 * Math.log10(Math.max(inp.freqMHz, 1));
  const fsplAtDDb = 32.44 + 20 * Math.log10(d / 1000) + 20 * Math.log10(Math.max(inp.freqMHz, 1));
  const logDistancePlDb = fsplAtD0Db + 10 * inp.pathLossExp * Math.log10(d / d0);

  const eirpDbm = inp.txPowerDbm + inp.txGainDbi - inp.cableLossDb;
  const rxPowerDbm = eirpDbm + inp.rxGainDbi - logDistancePlDb;
  // Thermal noise floor kTB = -174 dBm/Hz + 10 log10(B_Hz) + NF
  const bwHz = Math.max(inp.bandwidthMHz, 0.001) * 1e6;
  const thermalNoiseDbm = -174 + 10 * Math.log10(bwHz) + inp.noiseFigureDb;
  const snrDb = rxPowerDbm - thermalNoiseDbm;
  const fadeMarginDb = rxPowerDbm - inp.rxSensitivityDbm;
  const shannonCapacityMbps = inp.bandwidthMHz * Math.log2(1 + dbToLin(snrDb));

  return {
    wavelengthM,
    fsplAtD0Db,
    fsplAtDDb,
    logDistancePlDb,
    eirpDbm,
    rxPowerDbm,
    thermalNoiseDbm,
    snrDb,
    fadeMarginDb,
    shannonCapacityMbps,
  };
}

export interface OfdmDesignInput {
  bandwidthMHz: number;
  nFft: number;
  maxDelaySpreadUs: number;
  rmsDelaySpreadUs: number;
  carrierFreqGHz: number;
  mobileSpeedKmh: number;
  bitsPerSymbol: number; // 1=BPSK, 2=QPSK, 4=16QAM, 6=64QAM
}

export interface OfdmDesignOutput {
  subcarrierSpacingKHz: number;
  usefulSymbolUs: number;
  minCpSamples: number;
  recommendedCpSamples: number;
  cpDurationUs: number;
  totalSymbolUs: number;
  cpEfficiencyPct: number;
  coherenceBandwidth50KHz: number;
  coherenceBandwidth90KHz: number;
  maxDopplerHz: number;
  coherenceTimeMs: number;
  isFlatPerSubcarrier: boolean;
  isSlowFadingSymbol: boolean;
  rawBitRateMbps: number;
}

export function computeOfdmDesign(inp: OfdmDesignInput): OfdmDesignOutput {
  const bwHz = Math.max(inp.bandwidthMHz, 0.1) * 1e6;
  const nFft = Math.max(16, inp.nFft);
  const deltaFHz = bwHz / nFft;
  const usefulSymbolUs = (nFft / bwHz) * 1e6;
  const samplePeriodUs = (1 / bwHz) * 1e6;

  const minCpSamples = Math.max(1, Math.ceil(inp.maxDelaySpreadUs / samplePeriodUs));
  // Standard CP sizes (next clean multiple of 4 or N/8)
  const recommendedCpSamples = Math.max(minCpSamples, Math.ceil(minCpSamples / 4) * 4);
  const cpDurationUs = recommendedCpSamples * samplePeriodUs;
  const totalSymbolUs = usefulSymbolUs + cpDurationUs;
  const cpEfficiencyPct = (usefulSymbolUs / totalSymbolUs) * 100;

  const rmsS = Math.max(inp.rmsDelaySpreadUs, 0.001) * 1e-6;
  const coherenceBandwidth50KHz = 1 / (5 * rmsS) / 1e3;
  const coherenceBandwidth90KHz = 1 / (50 * rmsS) / 1e3;

  const c = 299_792_458;
  const vMs = Math.max(inp.mobileSpeedKmh, 0) / 3.6;
  const fHz = Math.max(inp.carrierFreqGHz, 0.1) * 1e9;
  const maxDopplerHz = (vMs * fHz) / c;
  // Geometric mean coherence time T_c = 0.423 / f_D (Rappaport)
  const coherenceTimeMs = maxDopplerHz > 1e-6 ? (0.423 / maxDopplerHz) * 1e3 : Number.POSITIVE_INFINITY;

  const isFlatPerSubcarrier = deltaFHz / 1e3 < coherenceBandwidth50KHz;
  const isSlowFadingSymbol = totalSymbolUs * 1e-3 < coherenceTimeMs * 0.1;
  const rawBitRateMbps = ((nFft * inp.bitsPerSymbol) / totalSymbolUs);

  return {
    subcarrierSpacingKHz: deltaFHz / 1e3,
    usefulSymbolUs,
    minCpSamples,
    recommendedCpSamples,
    cpDurationUs,
    totalSymbolUs,
    cpEfficiencyPct,
    coherenceBandwidth50KHz,
    coherenceBandwidth90KHz,
    maxDopplerHz,
    coherenceTimeMs,
    isFlatPerSubcarrier,
    isSlowFadingSymbol,
    rawBitRateMbps,
  };
}

/**
 * Exact recursive Erlang-B blocking probability B(C, A) — numerically stable for large C.
 */
export function erlangB(channelsC: number, offeredErlangsA: number): number {
  const C = Math.max(1, Math.floor(channelsC));
  const A = Math.max(0, offeredErlangsA);
  if (A === 0) return 0;
  let invB = 1.0;
  for (let k = 1; k <= C; k++) {
    invB = 1.0 + (k / A) * invB;
  }
  return 1.0 / invB;
}

/**
 * Invert Erlang-B via bisection to find max offered traffic A (Erlangs)
 * supported by C channels at Grade of Service (blocking probability) targetPb.
 */
export function maxErlangsForBlocking(channelsC: number, targetPb: number): number {
  const C = Math.max(1, Math.floor(channelsC));
  const pb = Math.min(0.5, Math.max(1e-6, targetPb));
  let lo = 0;
  let hi = Math.max(C * 2, 10);
  while (erlangB(C, hi) < pb && hi < 1e6) {
    hi *= 2;
  }
  for (let i = 0; i < 60; i++) {
    const mid = 0.5 * (lo + hi);
    if (erlangB(C, mid) < pb) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

export interface CellularPlanInput {
  clusterSizeN: number;
  pathLossExp: number;
  totalChannelsS: number;
  blockingProbPb: number;
  trafficPerUserErlang: number;
  numCells: number;
  sectorization: 1 | 3 | 6; // 1=Omni (6 interferers), 3=120° (2 interferers), 6=60° (1 interferer)
}

export interface CellularPlanOutput {
  coChannelFactorQ: number;
  interferersFirstTier: number;
  worstCaseSirDb: number;
  channelsPerCell: number;
  channelsPerSector: number;
  maxErlangsPerSector: number;
  maxErlangsPerCell: number;
  subscribersPerCell: number;
  totalSystemSubscribers: number;
  trunkingEfficiencyPct: number;
}

export function computeCellularPlan(inp: CellularPlanInput): CellularPlanOutput {
  const N = Math.max(1, inp.clusterSizeN);
  const Q = Math.sqrt(3 * N);
  const i0 = inp.sectorization === 1 ? 6 : inp.sectorization === 3 ? 2 : 1;
  // Classical first-tier cell-edge SIR = Q^n / i0
  const worstCaseSirDb = linToDb(Math.pow(Q, inp.pathLossExp) / i0);

  const channelsPerCell = Math.max(1, Math.floor(inp.totalChannelsS / N));
  const channelsPerSector = Math.max(1, Math.floor(channelsPerCell / inp.sectorization));
  const maxErlangsPerSector = maxErlangsForBlocking(channelsPerSector, inp.blockingProbPb);
  const maxErlangsPerCell = maxErlangsPerSector * inp.sectorization;
  const au = Math.max(inp.trafficPerUserErlang, 1e-4);
  const subscribersPerCell = Math.floor(maxErlangsPerCell / au);
  const totalSystemSubscribers = subscribersPerCell * Math.max(1, Math.floor(inp.numCells));
  const trunkingEfficiencyPct = (maxErlangsPerSector / channelsPerSector) * 100;

  return {
    coChannelFactorQ: Q,
    interferersFirstTier: i0,
    worstCaseSirDb,
    channelsPerCell,
    channelsPerSector,
    maxErlangsPerSector,
    maxErlangsPerCell,
    subscribersPerCell,
    totalSystemSubscribers,
    trunkingEfficiencyPct,
  };
}

export interface QuickRfMetrics {
  ebN0Lin: number;
  powerWattsFromDbm: number;
  powerMwFromDbm: number;
  shannonSeBpsHz: number;
  bpskAwgnBer: number;
  bpskRayleighBer: number;
  qam16AwgnBer: number;
}

export function computeQuickRfMetrics(ebN0Db: number, powerDbm: number): QuickRfMetrics {
  const ebN0Lin = dbToLin(ebN0Db);
  const powerMwFromDbm = dbToLin(powerDbm);
  const powerWattsFromDbm = powerMwFromDbm / 1000;
  const shannonSeBpsHz = Math.log2(1 + ebN0Lin);
  const bpskAwgnBer = qFunc(Math.sqrt(2 * ebN0Lin));
  const bpskRayleighBer = 0.5 * (1 - Math.sqrt(ebN0Lin / (1 + ebN0Lin)));
  const qam16AwgnBer = 0.75 * qFunc(Math.sqrt(0.8 * ebN0Lin));

  return {
    ebN0Lin,
    powerWattsFromDbm,
    powerMwFromDbm,
    shannonSeBpsHz,
    bpskAwgnBer,
    bpskRayleighBer,
    qam16AwgnBer,
  };
}
