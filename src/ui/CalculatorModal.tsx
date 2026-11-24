import React, { useMemo, useState } from 'react';
import { Calculator, Radio, Waves, Network, Gauge, X } from 'lucide-react';
import {
  computeCellularPlan,
  computeLinkBudget,
  computeOfdmDesign,
  computeQuickRfMetrics,
} from '../engine/calculators';

interface CalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type CalcTab = 'link' | 'ofdm' | 'cellular' | 'rf';

export const CalculatorModal: React.FC<CalculatorModalProps> = ({ isOpen, onClose }) => {
  const [tab, setTab] = useState<CalcTab>('link');

  // Tab 1: RF Link Budget state
  const [txPowerDbm, setTxPowerDbm] = useState(43);
  const [txGainDbi, setTxGainDbi] = useState(15);
  const [rxGainDbi, setRxGainDbi] = useState(0);
  const [cableLossDb, setCableLossDb] = useState(2);
  const [freqMHz, setFreqMHz] = useState(2600);
  const [distanceM, setDistanceM] = useState(1200);
  const [pathLossExp, setPathLossExp] = useState(3.2);
  const [bandwidthMHz, setBandwidthMHz] = useState(20);
  const [noiseFigureDb, setNoiseFigureDb] = useState(7);
  const [rxSensitivityDbm, setRxSensitivityDbm] = useState(-100);

  // Tab 2: OFDM & Delay Spread state
  const [ofdmBwMHz, setOfdmBwMHz] = useState(20);
  const [nFft, setNFft] = useState(64);
  const [maxDelayUs, setMaxDelayUs] = useState(0.8);
  const [rmsDelayUs, setRmsDelayUs] = useState(0.25);
  const [carrierGHz, setCarrierGHz] = useState(3.5);
  const [speedKmh, setSpeedKmh] = useState(90);
  const [bitsPerSym, setBitsPerSym] = useState(4);

  // Tab 3: Cellular Erlang-B & Reuse state
  const [clusterN, setClusterN] = useState(7);
  const [cellNExp, setCellNExp] = useState(3.5);
  const [totalChannels, setTotalChannels] = useState(395);
  const [blockingPb, setBlockingPb] = useState(0.02);
  const [userErlang, setUserErlang] = useState(0.025);
  const [numCells, setNumCells] = useState(21);
  const [sectorization, setSectorization] = useState<1 | 3 | 6>(3);

  // Tab 4: Quick RF & BER state
  const [ebN0Db, setEbN0Db] = useState(10);
  const [powerDbm, setPowerDbm] = useState(30);

  const linkOut = useMemo(
    () =>
      computeLinkBudget({
        txPowerDbm,
        txGainDbi,
        rxGainDbi,
        cableLossDb,
        freqMHz,
        distanceM,
        d0M: 100,
        pathLossExp,
        bandwidthMHz,
        noiseFigureDb,
        rxSensitivityDbm,
      }),
    [txPowerDbm, txGainDbi, rxGainDbi, cableLossDb, freqMHz, distanceM, pathLossExp, bandwidthMHz, noiseFigureDb, rxSensitivityDbm],
  );

  const ofdmOut = useMemo(
    () =>
      computeOfdmDesign({
        bandwidthMHz: ofdmBwMHz,
        nFft,
        maxDelaySpreadUs: maxDelayUs,
        rmsDelaySpreadUs: rmsDelayUs,
        carrierFreqGHz: carrierGHz,
        mobileSpeedKmh: speedKmh,
        bitsPerSymbol: bitsPerSym,
      }),
    [ofdmBwMHz, nFft, maxDelayUs, rmsDelayUs, carrierGHz, speedKmh, bitsPerSym],
  );

  const cellOut = useMemo(
    () =>
      computeCellularPlan({
        clusterSizeN: clusterN,
        pathLossExp: cellNExp,
        totalChannelsS: totalChannels,
        blockingProbPb: blockingPb,
        trafficPerUserErlang: userErlang,
        numCells,
        sectorization,
      }),
    [clusterN, cellNExp, totalChannels, blockingPb, userErlang, numCells, sectorization],
  );

  const rfOut = useMemo(
    () => computeQuickRfMetrics(ebN0Db, powerDbm),
    [ebN0Db, powerDbm],
  );

  if (!isOpen) return null;

  const numField = (
    label: string,
    value: number,
    onChange: (v: number) => void,
    unit: string,
    step = 1,
    min?: number,
    max?: number,
  ) => (
    <label className="block space-y-1">
      <span className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
        {label} ({unit})
      </span>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100"
      />
    </label>
  );

  const statTile = (label: string, val: string, unit?: string, tone?: 'good' | 'warn') => (
    <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3">
      <div className="text-[11px] text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 flex items-baseline gap-1 font-mono tabular-nums">
        <span
          className={`text-lg font-semibold ${
            tone === 'good'
              ? 'text-emerald-700 dark:text-emerald-400'
              : tone === 'warn'
                ? 'text-amber-700 dark:text-amber-400'
                : 'text-slate-900 dark:text-slate-100'
          }`}
        >
          {val}
        </span>
        {unit && <span className="text-xs text-slate-500 dark:text-slate-400">{unit}</span>}
      </div>
    </div>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ECE 441 Wireless Design Calculator"
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4"
    >
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              ECE 441 Wireless Engineering Design Calculator
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close design calculator"
            className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Sub-tool tabs */}
        <div
          role="tablist"
          aria-label="Calculator tools"
          className="flex items-center gap-1 px-5 pt-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 overflow-x-auto"
        >
          {(
            [
              { id: 'link' as CalcTab, label: 'RF Link Budget', icon: Radio },
              { id: 'ofdm' as CalcTab, label: 'OFDM & Doppler', icon: Waves },
              { id: 'cellular' as CalcTab, label: 'Cellular Erlang-B', icon: Network },
              { id: 'rf' as CalcTab, label: 'dB / BER / Shannon', icon: Gauge },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setTab(item.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'border-blue-600 text-blue-700 dark:text-blue-400 bg-white dark:bg-slate-900 rounded-t'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {tab === 'link' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {numField('Tx Power P_t', txPowerDbm, setTxPowerDbm, 'dBm', 1)}
                {numField('Tx Antenna G_t', txGainDbi, setTxGainDbi, 'dBi', 1)}
                {numField('Rx Antenna G_r', rxGainDbi, setRxGainDbi, 'dBi', 1)}
                {numField('Feeder Loss', cableLossDb, setCableLossDb, 'dB', 0.5, 0)}
                {numField('Carrier Freq', freqMHz, setFreqMHz, 'MHz', 100, 100)}
                {numField('Distance d', distanceM, setDistanceM, 'm', 100, 10)}
                {numField('Path-Loss Exp n', pathLossExp, setPathLossExp, '-', 0.1, 1.5, 6)}
                {numField('Bandwidth B', bandwidthMHz, setBandwidthMHz, 'MHz', 5, 0.2)}
                {numField('Rx Noise Fig NF', noiseFigureDb, setNoiseFigureDb, 'dB', 0.5, 0)}
                {numField('Rx Sensitivity', rxSensitivityDbm, setRxSensitivityDbm, 'dBm', 1)}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {statTile('EIRP', linkOut.eirpDbm.toFixed(1), 'dBm')}
                {statTile('Wavelength λ', (linkOut.wavelengthM * 100).toFixed(2), 'cm')}
                {statTile('Log-Distance PL', linkOut.logDistancePlDb.toFixed(2), 'dB')}
                {statTile('Received Power P_r', linkOut.rxPowerDbm.toFixed(2), 'dBm')}
                {statTile('Thermal Noise N_0B', linkOut.thermalNoiseDbm.toFixed(2), 'dBm')}
                {statTile('Link SNR', linkOut.snrDb.toFixed(2), 'dB', linkOut.snrDb >= 10 ? 'good' : 'warn')}
                {statTile('Fade Margin', linkOut.fadeMarginDb.toFixed(2), 'dB', linkOut.fadeMarginDb >= 0 ? 'good' : 'warn')}
                {statTile('Shannon Capacity', linkOut.shannonCapacityMbps.toFixed(1), 'Mbps')}
              </div>
            </div>
          )}

          {tab === 'ofdm' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {numField('Channel Bandwidth', ofdmBwMHz, setOfdmBwMHz, 'MHz', 5, 1)}
                <label className="block space-y-1">
                  <span className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    FFT Size N
                  </span>
                  <select
                    value={nFft}
                    onChange={(e) => setNFft(Number(e.target.value))}
                    className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs font-mono"
                  >
                    {[64, 128, 256, 512, 1024, 2048].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </label>
                {numField('Max Delay Spread τ_max', maxDelayUs, setMaxDelayUs, 'µs', 0.1, 0.05)}
                {numField('RMS Delay Spread σ_τ', rmsDelayUs, setRmsDelayUs, 'µs', 0.05, 0.01)}
                {numField('Carrier Frequency f_c', carrierGHz, setCarrierGHz, 'GHz', 0.1, 0.4)}
                {numField('Mobile Speed v', speedKmh, setSpeedKmh, 'km/h', 10, 0)}
                <label className="block space-y-1">
                  <span className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    Modulation Order
                  </span>
                  <select
                    value={bitsPerSym}
                    onChange={(e) => setBitsPerSym(Number(e.target.value))}
                    className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs font-mono"
                  >
                    <option value={1}>BPSK (1 b/sym)</option>
                    <option value={2}>QPSK (2 b/sym)</option>
                    <option value={4}>16-QAM (4 b/sym)</option>
                    <option value={6}>64-QAM (6 b/sym)</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {statTile('Subcarrier Δf', ofdmOut.subcarrierSpacingKHz.toFixed(2), 'kHz')}
                {statTile('Useful Symbol T_u', ofdmOut.usefulSymbolUs.toFixed(2), 'µs')}
                {statTile('Rec. Cyclic Prefix', `${ofdmOut.recommendedCpSamples} smp`, `(${ofdmOut.cpDurationUs.toFixed(2)} µs)`)}
                {statTile('CP Efficiency', ofdmOut.cpEfficiencyPct.toFixed(1), '%')}
                {statTile('Coherence BW (50%)', ofdmOut.coherenceBandwidth50KHz.toFixed(1), 'kHz', ofdmOut.isFlatPerSubcarrier ? 'good' : 'warn')}
                {statTile('Max Doppler f_D', ofdmOut.maxDopplerHz.toFixed(1), 'Hz')}
                {statTile('Coherence Time T_c', Number.isFinite(ofdmOut.coherenceTimeMs) ? ofdmOut.coherenceTimeMs.toFixed(2) : '∞', 'ms')}
                {statTile('Raw Bit Rate', ofdmOut.rawBitRateMbps.toFixed(1), 'Mbps')}
              </div>

              <div className="text-xs font-mono text-slate-600 dark:text-slate-300 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-3 py-2">
                Flat-per-subcarrier check (Δf &lt; B_c):{' '}
                <strong>{ofdmOut.isFlatPerSubcarrier ? 'PASS' : 'WARNING — increase N_FFT'}</strong>
                {' · '}
                Slow-fading symbol check (T_sym &lt; 0.1·T_c):{' '}
                <strong>{ofdmOut.isSlowFadingSymbol ? 'PASS' : 'WARNING — high Doppler ICI risk'}</strong>
              </div>
            </div>
          )}

          {tab === 'cellular' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <label className="block space-y-1">
                  <span className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    Cluster Size N
                  </span>
                  <select
                    value={clusterN}
                    onChange={(e) => setClusterN(Number(e.target.value))}
                    className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs font-mono"
                  >
                    {[1, 3, 4, 7, 9, 12].map((n) => (
                      <option key={n} value={n}>N = {n}</option>
                    ))}
                  </select>
                </label>
                {numField('Path-Loss Exp n', cellNExp, setCellNExp, '-', 0.1, 2, 5)}
                {numField('Total Duplex Channels S', totalChannels, setTotalChannels, 'ch', 10, 12)}
                {numField('Target Blocking P_b', blockingPb, setBlockingPb, 'GoS', 0.005, 0.001, 0.2)}
                {numField('Traffic per User A_u', userErlang, setUserErlang, 'Erlang', 0.005, 0.002)}
                {numField('Total Cells in System', numCells, setNumCells, 'cells', 1, 1)}
                <label className="block space-y-1">
                  <span className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    Antenna Sectorization
                  </span>
                  <select
                    value={sectorization}
                    onChange={(e) => setSectorization(Number(e.target.value) as 1 | 3 | 6)}
                    className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs font-mono"
                  >
                    <option value={1}>Omnidirectional (6 interferers)</option>
                    <option value={3}>120° 3-Sector (2 interferers)</option>
                    <option value={6}>60° 6-Sector (1 interferer)</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {statTile('Reuse Factor Q', cellOut.coChannelFactorQ.toFixed(2), 'D/R')}
                {statTile('Cell-Edge SIR', cellOut.worstCaseSirDb.toFixed(2), 'dB', cellOut.worstCaseSirDb >= 15 ? 'good' : 'warn')}
                {statTile('Channels / Cell', String(cellOut.channelsPerCell), `(${cellOut.channelsPerSector}/sec)`)}
                {statTile('Trunking Efficiency', cellOut.trunkingEfficiencyPct.toFixed(1), '%')}
                {statTile('Capacity / Sector', cellOut.maxErlangsPerSector.toFixed(2), 'Erlangs')}
                {statTile('Capacity / Cell', cellOut.maxErlangsPerCell.toFixed(2), 'Erlangs')}
                {statTile('Subscribers / Cell', cellOut.subscribersPerCell.toLocaleString(), 'users')}
                {statTile('Total System Users', cellOut.totalSystemSubscribers.toLocaleString(), `${numCells} cells`)}
              </div>
            </div>
          )}

          {tab === 'rf' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {numField('Operating E_b/N_0 or SNR', ebN0Db, setEbN0Db, 'dB', 1, -10, 40)}
                {numField('RF Transmit Power', powerDbm, setPowerDbm, 'dBm', 1, -120, 60)}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {statTile('Linear SNR', rfOut.ebN0Lin.toFixed(3), 'ratio')}
                {statTile('Power (Watts)', rfOut.powerWattsFromDbm >= 0.01 ? rfOut.powerWattsFromDbm.toFixed(4) : rfOut.powerWattsFromDbm.toExponential(3), 'W')}
                {statTile('Power (mW)', rfOut.powerMwFromDbm >= 0.01 ? rfOut.powerMwFromDbm.toFixed(3) : rfOut.powerMwFromDbm.toExponential(3), 'mW')}
                {statTile('AWGN Shannon SE', rfOut.shannonSeBpsHz.toFixed(3), 'bps/Hz')}
                {statTile('BPSK/QPSK AWGN BER', rfOut.bpskAwgnBer.toExponential(3))}
                {statTile('BPSK Rayleigh BER', rfOut.bpskRayleighBer.toExponential(3))}
                {statTile('16-QAM AWGN BER', rfOut.qam16AwgnBer.toExponential(3))}
                {statTile('3 dB Power Factor', '2.000×', '±10 dB = 10×')}
              </div>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            Exact closed-form ECE 441 formulas · 100% browser-local
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
};
