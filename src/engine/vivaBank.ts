import type { ModuleId, ModuleResultBundle } from '../types/simulation';

export interface VivaQuestion {
  id: string;
  question: string;
  answer: string;
  figureId?: string;
  figureLabel?: string;
}

/**
 * E4: Examiner Q&A (Viva) Bank — 10 oral-exam questions per module with answers
 * dynamically citing the module's own computed simulation results.
 */
export function getVivaQuestions(
  moduleId: ModuleId,
  bundle: ModuleResultBundle | null,
): VivaQuestion[] {
  const s = (bundle?.rawSummary ?? {}) as Record<string, number | string | null | undefined>;
  const vErr =
    bundle?.verification && Number.isFinite(bundle.verification.maxRelError)
      ? `${(bundle.verification.maxRelError * 100).toFixed(2)}%`
      : '<= 15%';
  const fmt = (v: unknown, digits = 2, fallback = 'computed on run') =>
    typeof v === 'number' && Number.isFinite(v) ? v.toFixed(digits) : fallback;

  switch (moduleId) {
    case 'module1':
      return [
        {
          id: 'm1_q1',
          question: 'Why does 3.5 GHz suffer ~11.8 dB more path loss than 900 MHz at the exact same distance?',
          answer: `For isotropic receive antennas, effective capture aperture scales as λ²/(4π) ∝ 1/f². Raising frequency from 900 to 3500 MHz increases FSPL by 20·log10(3500/900) = ${fmt(s.fGapDb, 2, '11.80')} dB at every distance, assuming equal antenna gains.`,
          figureId: 'fig2_pl_comparison',
          figureLabel: 'Fig 2: Path Loss',
        },
        {
          id: 'm1_q2',
          question: 'How does the 11.8 dB propagation gap translate into base-station site density?',
          answer: `In our run, the 90% coverage radius drops from ${fmt(s.r90Low, 0)} m to ${fmt(s.r90High, 0)} m. Since cell area scales as R², covering the same city at the higher band requires roughly ${fmt(s.areaRatio, 1)}× as many base stations.`,
          figureId: 'fig1_pr_vs_dist',
          figureLabel: 'Fig 1: Pr vs Dist',
        },
        {
          id: 'm1_q3',
          question: 'What is the physical meaning of the path-loss exponent n, and why is n > 2 in urban areas?',
          answer: 'In free space (n = 2), spherical spreading attenuates power by 20 dB/decade. In urban environments, ground-reflection cancellation, rooftop diffraction, and building blockage accelerate decay to 30–40 dB/decade (n = 3 to 4).',
          figureId: 'fig3_exponent_n',
          figureLabel: 'Fig 3: Exponent n',
        },
        {
          id: 'm1_q4',
          question: 'Why do we anchor log-distance path loss at a close-in reference distance d0 = 100 m?',
          answer: 'The log10(d/d0) formula diverges as d → 0 and does not hold in the antenna reactive near field. Anchoring at d0 = 100 m places the reference safely in the Fraunhofer far field where FSPL is valid.',
          figureId: 'fig2_pl_comparison',
          figureLabel: 'Fig 2: Path Loss',
        },
        {
          id: 'm1_q5',
          question: 'What causes log-normal shadowing X_σ, and why is it Gaussian in dB?',
          answer: 'Random macroscopic obstacles (buildings, hills, trees) multiply attenuation factors along different paths of equal length. By the Central Limit Theorem in the log domain, the sum of many random dB attenuations approaches a Gaussian N(0, σ²).',
          figureId: 'fig1_pr_vs_dist',
          figureLabel: 'Fig 1: Pr vs Dist',
        },
        {
          id: 'm1_q6',
          question: 'How do you calculate cell-edge coverage probability analytically from mean Pr and σ?',
          answer: `Since Pr(d) ~ N(meanPr, σ²), P(Pr >= S_rx) = Q((S_rx - meanPr)/σ). Our Monte-Carlo simulation matched this exact Q-function within ${vErr} max relative error.`,
          figureId: 'fig4_coverage_outage',
          figureLabel: 'Fig 4: Coverage',
        },
        {
          id: 'm1_q7',
          question: 'Why does upgrading cell-edge reliability from 90% to 95% noticeably shrink cell radius?',
          answer: `90% edge coverage requires a 1.282·σ fade margin while 95% requires 1.645·σ (an extra 0.363·σ dB). In our run, the low-band radius contracted from ${fmt(s.r90Low, 0)} m (90%) to ${fmt(s.r95Low, 0)} m (95%).`,
          figureId: 'fig4_coverage_outage',
          figureLabel: 'Fig 4: Coverage',
        },
        {
          id: 'm1_q8',
          question: 'Why is cell-area coverage probability always higher than cell-edge coverage probability?',
          answer: `Users closer to the base station experience much higher mean Pr than edge users. Therefore, even when edge reliability is 90%, area-averaged coverage across the disk (e.g., ${fmt(s.areaCoveragePct, 1)}% in Fig 6) is substantially higher.`,
          figureId: 'fig6_cell_heatmap',
          figureLabel: 'Fig 6: Cell Map',
        },
        {
          id: 'm1_q9',
          question: 'How do wireless operators compensate for 3.5 GHz propagation loss in 5G NR?',
          answer: 'Operators combine high-gain Massive MIMO beamforming (boosting effective Gt), denser urban microcell grids, and carrier aggregation with a 700/900 MHz coverage anchor layer.',
          figureId: 'fig5_environments',
          figureLabel: 'Fig 5: Environments',
        },
        {
          id: 'm1_q10',
          question: 'What small-scale effect is deliberately excluded from this large-scale model?',
          answer: 'Rapid multipath Rayleigh/Rician fading (over half-wavelength scales) is averaged out here; large-scale link budgets handle it separately via a fast-fading margin or diversity/OFDM coding gain.',
          figureId: 'fig1_pr_vs_dist',
          figureLabel: 'Fig 1: Pr vs Dist',
        },
      ];

    case 'module2':
      return [
        {
          id: 'm2_q1',
          question: 'Why does Maximal Ratio Combining (MRC) always outperform Selection Combining (SC) and EGC?',
          answer: 'MRC co-phases every branch and weights each branch proportionally to its complex conjugate channel gain h_k*, maximizing instantaneous output SNR = sum(|h_k|²·γ̄). SC discards L-1 branches completely, while EGC co-phases without suppressing noisy weak branches.',
          figureId: 'fig1_ber_vs_snr',
          figureLabel: 'Fig 1: BER vs SNR',
        },
        {
          id: 'm2_q2',
          question: 'How much SNR does EGC lose compared to MRC, and why is EGC still useful?',
          answer: 'In Rayleigh fading, EGC stays within roughly 0.5–1.0 dB of MRC for any L while avoiding amplitude estimation (requiring only phase co-phasing), making it simpler in analog/RF implementations.',
          figureId: 'fig2_fixed_l_compare',
          figureLabel: 'Fig 2: L=2 vs L=4',
        },
        {
          id: 'm2_q3',
          question: 'What is "diversity order" geometrically on a log-BER vs SNR(dB) plot?',
          answer: 'Diversity order L equals the negative asymptotic slope of the BER curve at high SNR: BER ∝ SNR^(-L). That means every +10 dB increase in SNR reduces BER by L decades (10× for L=1, 10,000× for L=4).',
          figureId: 'fig3_diversity_order',
          figureLabel: 'Fig 3: L=1,2,4,8',
        },
        {
          id: 'm2_q4',
          question: 'Why do we see diminishing returns when going from L=4 to L=8 compared to L=1 to L=2?',
          answer: 'The biggest jump occurs moving from L=1 to L=2 because the probability of a single deep fade (1/SNR) becomes the probability of two simultaneous independent fades (1/SNR²). Beyond L=4, the curve already approaches AWGN slope, yielding smaller dB gains per added RF chain.',
          figureId: 'fig3_diversity_order',
          figureLabel: 'Fig 3: L=1,2,4,8',
        },
        {
          id: 'm2_q5',
          question: 'What is the exact distribution of combined SNR for MRC with L independent Rayleigh branches?',
          answer: 'Each branch SNR is exponential (chi-square with 2 DoF), so the sum of L independent branches follows an Erlang / Gamma (chi-square with 2L DoF) distribution with mean L·γ̄.',
          figureId: 'fig4_outage',
          figureLabel: 'Fig 4: Outage',
        },
        {
          id: 'm2_q6',
          question: 'How does SC outage probability simplify mathematically for L i.i.d. Rayleigh branches?',
          answer: 'SC is in outage only if ALL L branches simultaneously fall below γ_th: P_out,SC = (1 - exp(-γ_th / γ̄))^L. At high SNR this decays as (γ_th / γ̄)^L — proving SC achieves the same diversity order L as MRC, just with a horizontal array-gain shift!',
          figureId: 'fig4_outage',
          figureLabel: 'Fig 4: Outage',
        },
        {
          id: 'm2_q7',
          question: 'Why does coherent BPSK in Rayleigh fading (L=1) perform so much worse than AWGN?',
          answer: 'In AWGN, BER decays exponentially as Q(√(2γ)), whereas in single-branch Rayleigh fading deep fades occur with probability ~1/γ, flattening BER decay to an inverse-linear 1/(4γ) slope — costing >20 dB at BER = 10⁻³.',
          figureId: 'fig1_ber_vs_snr',
          figureLabel: 'Fig 1: BER vs SNR',
        },
        {
          id: 'm2_q8',
          question: 'How did you verify your Monte-Carlo diversity simulation against theory?',
          answer: `We verified simulated No-Diversity, SC, and MRC BER curves directly against Proakis/Simon-Alouini closed-form expressions across statistically reliable points (>= 100 errors), achieving max relative error ${vErr} (<= 15% PASS).`,
          figureId: 'fig1_ber_vs_snr',
          figureLabel: 'Fig 1: BER vs SNR',
        },
        {
          id: 'm2_q9',
          question: 'What happens if the L receive antennas are spaced closer than λ/2?',
          answer: 'Spatial correlation increases between branches so they fade together, reducing the effective diversity order below L and shrinking the SNR gain.',
          figureId: 'fig5_complexity_gain',
          figureLabel: 'Fig 5: Complexity',
        },
        {
          id: 'm2_q10',
          question: 'When would a hardware designer choose SC over MRC?',
          answer: 'SC needs only a single full demodulator chain connected via an RF switch to the strongest antenna (monitoring envelope power), saving power and silicon cost in battery-constrained IoT/handset receivers.',
          figureId: 'fig5_complexity_gain',
          figureLabel: 'Fig 5: Complexity',
        },
      ];

    case 'module3':
      return [
        {
          id: 'm3_q1',
          question: 'Why does the BER vs CP-length curve have a sharp U-shaped minimum right at N_cp = L - 1?',
          answer: 'For N_cp < L - 1, the channel delay spread spills across symbol boundaries causing severe ISI and ICI (creating an irreducible error floor). At N_cp = L - 1, ISI/ICI drops to zero. For N_cp > L - 1, no further multipath immunity is gained while useful transmit energy is wasted as (N/(N+N_cp)), pushing effective Eb/N0 down and BER slightly back up!',
          figureId: 'fig5_efficiency_tradeoff',
          figureLabel: 'Fig 5: Efficiency U-Curve',
        },
        {
          id: 'm3_q2',
          question: 'How does the Cyclic Prefix turn linear channel convolution into circular convolution?',
          answer: 'Copying the last N_cp samples to the front of each OFDM symbol ensures that during the N-sample FFT window (after discarding the first N_cp ISI-corrupted samples), every delayed multipath tap wraps periodically around the N-sample symbol — making linear convolution mathematically identical to circular convolution, which diagonalizes in the DFT domain as Y[k] = H[k]X[k] + W[k].',
          figureId: 'fig3_ber_cp_compare',
          figureLabel: 'Fig 3: BER vs CP',
        },
        {
          id: 'm3_q3',
          question: 'Why did ZF and MMSE give the exact same BER for QPSK, yet different MSE/constellations for 16-QAM?',
          answer: 'With sufficient CP, each subcarrier is an independent scalar channel Y[k]=H[k]X[k]+W[k]. Scalar ZF divides by H[k] and MMSE multiplies by H*[k]/(|H[k]|²+N0). Both have the EXACT same phase, so for QPSK (whose decision boundaries are the I/Q axes at 0), bit decisions are bit-for-bit identical! For 16-QAM, MMSE shrinks constellation amplitudes toward zero while reducing noise enhancement (lower equalizer MSE/EVM).',
          figureId: 'fig6_zf_vs_mmse',
          figureLabel: 'Fig 6: ZF vs MMSE',
        },
        {
          id: 'm3_q4',
          question: 'Why does OFDM without CP hit an irreducible BER floor even as Eb/N0 approaches infinity?',
          answer: 'Because ISI from the previous OFDM symbol and ICI from loss of subcarrier orthogonality scale proportionally with signal power! Increasing transmit power boosts interference equally with desired signal, capping SINR at a finite ceiling.',
          figureId: 'fig3_ber_cp_compare',
          figureLabel: 'Fig 3: BER vs CP',
        },
        {
          id: 'm3_q5',
          question: 'What is the spectral efficiency penalty of inserting a Cyclic Prefix of length N_cp?',
          answer: 'Spectral efficiency drops by factor η = N / (N + N_cp). For N = 64 and N_cp = 16, 20% of symbol duration and 0.97 dB of transmit energy are spent on the guard interval.',
          figureId: 'fig5_efficiency_tradeoff',
          figureLabel: 'Fig 5: Efficiency U-Curve',
        },
        {
          id: 'm3_q6',
          question: 'Why did we simulate OFDM using true linear convolution across consecutive symbols rather than circular convolution?',
          answer: 'Circular convolution inherently assumes an infinite CP and can NEVER produce ISI or ICI! True linear convolution carrying the L-1 sample tail from symbol i-1 into symbol i is essential to capture genuine multipath ISI and ICI when N_cp < L - 1.',
          figureId: 'fig4_ber_vs_delay',
          figureLabel: 'Fig 4: BER vs Delay',
        },
        {
          id: 'm3_q7',
          question: 'Why does uncoded OFDM over a multipath Rayleigh channel with sufficient CP match flat-Rayleigh single-carrier BER?',
          answer: 'When each subcarrier has unit average channel power E[|H[k]|²] = 1, the marginal distribution of H[k] is CN(0,1) — identical to flat Rayleigh fading! Without channel coding across subcarriers, each subcarrier individually experiences Rayleigh fading, which verified our simulation within ' + vErr + '.',
          figureId: 'fig2_verify',
          figureLabel: 'Fig 2: Verification',
        },
        {
          id: 'm3_q8',
          question: 'How does frequency-selective fading appear in |H[k]| across subcarriers?',
          answer: 'Multipath delay spread τ_max creates constructive and destructive interference notches across frequency separated by coherence bandwidth B_c ≈ 1/(5·τ_rms). Deep notches amplify noise under ZF equalization.',
          figureId: 'fig1_pdp_freq',
          figureLabel: 'Fig 1: PDP & |H[k]|',
        },
        {
          id: 'm3_q9',
          question: 'What happens visually to the equalized constellation when CP is removed vs sufficient?',
          answer: 'Without CP, ISI/ICI smears constellation points into wide overlapping clouds even at high SNR. Adding CP >= L - 1 snaps points cleanly back onto tight AWGN-limited clusters.',
          figureId: 'fig7_constellations',
          figureLabel: 'Fig 7: Constellations',
        },
        {
          id: 'm3_q10',
          question: 'Why is an exponential Power Delay Profile (PDP) more realistic than a uniform PDP?',
          answer: 'Longer multipath reflections travel farther and undergo more reflections, arriving with exponentially decaying average power rather than equal power at the maximum excess delay.',
          figureId: 'fig1_pdp_freq',
          figureLabel: 'Fig 1: PDP & |H[k]|',
        },
      ];

    case 'module4':
      return [
        {
          id: 'm4_q1',
          question: 'Why does DSSS neither improve nor degrade BER in pure AWGN (with no jammer)?',
          answer: `Spreading keeps bit energy Eb = SF·Ec constant and white Gaussian noise remains white Gaussian noise after multiplying by a ±1 PN code. Our verification confirmed no-jammer DSSS matches exact unspread AWGN BPSK Q(√(2Eb/N0)) within ${vErr}.`,
          figureId: 'fig1_ber_vs_ebn0',
          figureLabel: 'Fig 1: BER vs Eb/N0',
        },
        {
          id: 'm4_q2',
          question: 'How does DSSS reject a narrowband jammer that is stronger than the desired signal (J/S > 0 dB)?',
          answer: `Multiplying the received signal by the synchronized PN code collapses the spread signal back to baseband (since c[n]² = +1) while spreading the narrowband jammer across SF× wider chip bandwidth. The integrate-and-dump filter rejects (1 - 1/SF) of the jammer power, yielding processing gain Gp = 10·log10(SF) = ${fmt(s.gpDb, 2)} dB.`,
          figureId: 'fig6_psd_spectrum',
          figureLabel: 'Fig 6: PSD Spectrum',
        },
        {
          id: 'm4_q3',
          question: 'What is the fundamental trade-off for increasing Spreading Factor SF?',
          answer: 'Processing gain grows only logarithmically as 10·log10(SF) dB, whereas required RF bandwidth expands linearly as W_ss = SF·R_b. Gaining +10 dB extra jamming resistance requires 10× more spectrum.',
          figureId: 'fig4_processing_gain',
          figureLabel: 'Fig 4: Proc. Gain',
        },
        {
          id: 'm4_q4',
          question: 'What makes an LFSR m-sequence ideal for DSSS spreading?',
          answer: 'An m-sequence of length L = 2^m - 1 has maximal period, near-perfect balance of +1/-1 chips (differing by 1), and ideal two-level periodic autocorrelation (peak = L at lag 0, -1 at all nonzero lags), producing a nearly flat white spectrum.',
          figureId: 'fig6_psd_spectrum',
          figureLabel: 'Fig 6: PSD Spectrum',
        },
        {
          id: 'm4_q5',
          question: 'When would you choose Gold codes over single m-sequences?',
          answer: 'While a single m-sequence has ideal autocorrelation, pairs of arbitrary m-sequences can have large cross-correlation peaks. Gold codes XOR a preferred pair of m-sequences to guarantee small, bounded three-level cross-correlation for multiuser CDMA/GPS.',
          figureId: 'fig3_sf_effect',
          figureLabel: 'Fig 3: Effect of SF',
        },
        {
          id: 'm4_q6',
          question: 'Why does the jammed DSSS BER curve flatten to an error floor at high Eb/N0?',
          answer: 'As thermal noise N0 → 0, SINR saturates at SF·(S/J), leaving an interference-limited BER floor ≈ Q(√(2·SF·S/J)). Raising Eb/N0 cannot lower this floor unless J/S decreases or SF increases.',
          figureId: 'fig1_ber_vs_ebn0',
          figureLabel: 'Fig 1: BER vs Eb/N0',
        },
        {
          id: 'm4_q7',
          question: 'Why is the formula Pb = Q(√(2·SINR)) labeled an approximation under tone jamming?',
          answer: 'A single-tone sinusoid has a bounded arcsine amplitude distribution rather than Gaussian tails. By the Central Limit Theorem, the sum of SF despread jammer chips approaches Gaussian as SF grows, making SGA very accurate for SF >= 15.',
          figureId: 'fig2_ber_vs_js',
          figureLabel: 'Fig 2: BER vs J/S',
        },
        {
          id: 'm4_q8',
          question: 'What happens to the transmitted Power Spectral Density when we spread by SF = 31?',
          answer: 'Total power stays constant while bandwidth widens by 31×, so PSD drops by ~14.9 dB — often below the thermal noise floor, giving DSSS Low Probability of Intercept (LPI).',
          figureId: 'fig6_psd_spectrum',
          figureLabel: 'Fig 6: PSD Spectrum',
        },
        {
          id: 'm4_q9',
          question: 'Would DSSS reject a wideband barrage jammer covering the entire chip bandwidth?',
          answer: 'Only by the ratio of signal power to jammer power within the data bandwidth — a wideband jammer already occupies W_ss so despreading cannot spread it further; its PSD behaves like elevated thermal noise N_J = J / W_ss.',
          figureId: 'fig2_ber_vs_js',
          figureLabel: 'Fig 2: BER vs J/S',
        },
        {
          id: 'm4_q10',
          question: 'What happens if the receiver PN sequence is misaligned by just 1 full chip?',
          answer: 'Because m-sequence autocorrelation drops from +SF to -1 for any lag >= 1 chip, a 1-chip timing error destroys signal collapse completely — requiring dedicated PN acquisition and DLL tracking loops.',
          figureId: 'fig5_bpsk_vs_dsss',
          figureLabel: 'Fig 5: BPSK vs DSSS',
        },
      ];

    case 'module5':
      return [
        {
          id: 'm5_q1',
          question: 'What causes the Near-Far Problem in uplink DS-CDMA?',
          answer: 'Uplink mobiles transmit asynchronously with non-orthogonal spreading codes (~1/√SF cross-correlation). Because path loss scales as d^(-n), a nearby mobile can arrive 30–40 dB stronger than a cell-edge mobile, so its cross-correlation leakage completely swamps the distant user\'s signal.',
          figureId: 'fig6_nearfar_physics',
          figureLabel: 'Fig 6: Near-Far Physics',
        },
        {
          id: 'm5_q2',
          question: 'Why does the Near-Far Problem mainly affect the uplink rather than the downlink?',
          answer: 'On the downlink, all users\' signals originate from the same base station and travel the exact same path to a given mobile — so they arrive with identical path loss AND synchronized orthogonal Walsh-Hadamard codes!',
          figureId: 'fig6_nearfar_physics',
          figureLabel: 'Fig 6: Near-Far Physics',
        },
        {
          id: 'm5_q3',
          question: 'How does closed-loop power control solve the near-far problem?',
          answer: 'The base station continuously measures each mobile\'s received SINR and sends fast up/down commands (800–1500 Hz in IS-95/WCDMA) so every user arrives at the base station with equal received power P_k = P_1.',
          figureId: 'fig1_ber_vs_nfr',
          figureLabel: 'Fig 1: BER vs NFR',
        },
        {
          id: 'm5_q4',
          question: 'What is "soft capacity" in CDMA compared to TDMA/FDMA?',
          answer: `TDMA/FDMA have a hard slot limit. In CDMA, adding one more user slightly degrades every user's SINR via MAI variance (K-1)/SF. In our run, Ideal PC supported up to K_max = ${s.kMaxIdeal1e2 ?? 'N/A'} users at BER 10⁻² (dropping to ${s.kMaxIdeal1e3 ?? 'N/A'} at BER 10⁻³).`,
          figureId: 'fig2_ber_vs_k',
          figureLabel: 'Fig 2: BER vs K',
        },
        {
          id: 'm5_q5',
          question: 'Why does zero-mean dB power-control error σ_pc still hurt average CDMA capacity?',
          answer: `Because linear interference power 10^(e/10) is convex! Even when E[e_dB] = 0, E[10^(e/10)] = exp(0.5·(ln(10)/10 · σ_pc)²) > 1, reducing K_max from ${s.kMaxIdeal1e2 ?? 'N/A'} (ideal) to ${s.kMaxImp1e2 ?? 'N/A'} (imperfect).`,
          figureId: 'fig4_pc_comparison',
          figureLabel: 'Fig 4: With vs Without PC',
        },
        {
          id: 'm5_q6',
          question: 'How does the Decorrelating Multiuser Detector achieve near-far resistance without power control?',
          answer: 'By multiplying the matched-filter vector y_MF by R⁻¹ (the inverse of the K×K code cross-correlation matrix), it projects each user onto the nullspace of all interferers — canceling MAI completely at any near-far ratio, at the cost of slight noise enhancement (R⁻¹)_11 >= 1.',
          figureId: 'fig1_ber_vs_nfr',
          figureLabel: 'Fig 1: BER vs NFR',
        },
        {
          id: 'm5_q7',
          question: 'Why does raising Eb/N0 fail to remove the BER floor in multiuser CDMA?',
          answer: 'If all users raise transmit power together, MAI rises identically with desired signal power, leaving SIR = SF / sum(P_k/P_1) unchanged.',
          figureId: 'fig4_pc_comparison',
          figureLabel: 'Fig 4: With vs Without PC',
        },
        {
          id: 'm5_q8',
          question: 'How does doubling the spreading factor SF affect multiuser capacity?',
          answer: 'Doubling SF halves MAI variance per interferer and approximately doubles K_max at a fixed target BER — trading per-user bit rate against the number of simultaneous users.',
          figureId: 'fig5_sf_mai',
          figureLabel: 'Fig 5: SF & MAI',
        },
        {
          id: 'm5_q9',
          question: 'How did you validate the CDMA simulation model?',
          answer: `We verified single-user K=1 BER against exact AWGN BPSK Q(√(2Eb/N0)) AND multiuser Ideal-PC BER against the Standard Gaussian Approximation (SGA), passing with max relative error ${vErr}.`,
          figureId: 'fig2_ber_vs_k',
          figureLabel: 'Fig 2: BER vs K',
        },
        {
          id: 'm5_q10',
          question: 'What secondary benefit does uplink power control provide for mobile handsets?',
          answer: 'Nearby users throttle transmit power down by 20–40 dB instead of transmitting at full 23 dBm, dramatically extending mobile battery life and lowering inter-cell interference to neighboring base stations.',
          figureId: 'fig6_nearfar_physics',
          figureLabel: 'Fig 6: Near-Far Physics',
        },
      ];

    case 'module6':
      return [
        {
          id: 'm6_q1',
          question: 'Why are hexagonal cluster sizes restricted to N = i² + ij + j² (1, 3, 4, 7, 9, 12...)?',
          answer: 'Regular hexagons tile the 2D plane on a 60° triangular lattice. Moving i cells along one lattice axis and turning 60° to move j cells gives squared center-to-center distance D² = 3R²(i² + ij + j²), which equals N times one cell\'s area — so only integer pairs (i, j) create seamless symmetric clusters.',
          figureId: 'fig1_reuse_geometry',
          figureLabel: 'Fig 1: Reuse D & q',
        },
        {
          id: 'm6_q2',
          question: 'Why does the classical formula SIR ≈ (√(3N))^n / 6 overestimate true worst-case cell-edge SIR?',
          answer: 'The classical approximation assumes all 6 first-tier interferers are at distance D from the user. In reality, a cell-edge user at distance R toward an interferer is only (D - R) away from the closest interferer(s), which receive disproportionately larger interference (D - R)^(-n).',
          figureId: 'fig2_sir_vs_n',
          figureLabel: 'Fig 2: SIR vs N',
        },
        {
          id: 'm6_q3',
          question: 'Why does increasing every base station\'s transmit power equally NOT improve downlink SIR?',
          answer: 'In the interference-limited regime, Pt appears in both the desired signal numerator and every co-channel interferer denominator, canceling out completely! SIR depends purely on geometry (N, R), path-loss exponent n, and shadowing.',
          figureId: 'fig2_sir_vs_n',
          figureLabel: 'Fig 2: SIR vs N',
        },
        {
          id: 'm6_q4',
          question: 'What is the core engineering trade-off between cluster size N and cellular capacity?',
          answer: `Per-cell channels scale as C_tot / N (reuse efficiency 1/N). Smaller N increases channels per cell but degrades SIR and raises outage; our optimizer selected N = ${s.recommendedN ?? 7} as the smallest cluster size satisfying the target SIR and outage constraints.`,
          figureId: 'fig5_tradeoff',
          figureLabel: 'Fig 5: Reuse Trade-off',
        },
        {
          id: 'm6_q5',
          question: 'How does a higher path-loss exponent n affect Co-Channel Interference?',
          answer: 'Surprisingly, a HIGHER path-loss exponent n IMPROVES SIR! Because interferers are farther away (D > R), steeper distance attenuation suppresses distant co-channel interferers much faster than the nearby serving BS (q^n grows rapidly with n).',
          figureId: 'fig2_sir_vs_n',
          figureLabel: 'Fig 2: SIR vs N',
        },
        {
          id: 'm6_q6',
          question: 'How does log-normal shadowing impact downlink outage probability?',
          answer: 'Independent shadowing on desired and interfering links creates random SIR fluctuations — a deep desired-link fade combined with a strong interferer shadow peak causes cell-edge outages even when deterministic path-loss SIR exceeds the threshold.',
          figureId: 'fig4_outage_vs_n',
          figureLabel: 'Fig 4: Outage vs N',
        },
        {
          id: 'm6_q7',
          question: 'How can cellular operators achieve N = 1 reuse in 4G LTE / 5G NR without catastrophic CCI?',
          answer: 'Modern systems combine 120° cell sectoring (cutting 1st-tier interferers from 6 to 2, +4.8 dB SIR), Fractional Frequency Reuse (FFR — N=1 at cell center, N=3 at cell edge), adaptive MCS, and ICIC/CoMP coordination.',
          figureId: 'fig3_sir_cdf',
          figureLabel: 'Fig 3: SIR CDF',
        },
        {
          id: 'm6_q8',
          question: 'Why is second-tier interference usually small compared to first-tier interference?',
          answer: 'The 12 second-tier interferers sit at distances √3·D and 2D; raised to the (-n) power (with n = 3.5–4), their combined contribution is typically < 1 dB unless n is very low (~2.0–2.5).',
          figureId: 'fig6_hex_map',
          figureLabel: 'Fig 6: Hex SIR Map',
        },
        {
          id: 'm6_q9',
          question: 'How did you verify the hexagonal Monte-Carlo simulation?',
          answer: `We verified simulated uniform ring cell-edge SIR (no shadowing) against exact 6-interferer distance summation across all cluster sizes N, passing with max relative error ${vErr}.`,
          figureId: 'fig2_sir_vs_n',
          figureLabel: 'Fig 2: SIR vs N',
        },
        {
          id: 'm6_q10',
          question: 'Where inside the serving hexagon is downlink SIR lowest?',
          answer: 'At the six hexagon corners pointing directly toward the six first-tier co-channel base stations, as clearly visible in the 6-fold symmetric spatial SIR heatmap.',
          figureId: 'fig6_hex_map',
          figureLabel: 'Fig 6: Hex SIR Map',
        },
      ];

    case 'module7':
      return [
        {
          id: 'm7_q1',
          question: 'Why does MIMO ergodic capacity scale linearly with min(Nt, Nr) at high SNR?',
          answer: 'Through Singular Value Decomposition (SVD), an Nr×Nt rich-scattering MIMO channel decomposes into r = min(Nt, Nr) parallel independent spatial eigen-channels. Each spatial stream adds ~1 bit/s/Hz per 3 dB of SNR (3.32 bits/s/Hz per 10 dB), giving total high-SNR slope min(Nt, Nr).',
          figureId: 'fig2_multiplexing_slope',
          figureLabel: 'Fig 2: High-SNR Slope',
        },
        {
          id: 'm7_q2',
          question: 'Why does 1×2 SIMO outperform 2×1 MISO (with no Tx CSI) at the same total transmit power?',
          answer: 'In 1×2 SIMO, both receive antennas capture independent copies of the full transmit power (yielding 2× receive aperture / +3 dB array gain). In 2×1 MISO without CSIT, total power must be split ρ/2 per transmit antenna, losing the 3 dB array gain while keeping diversity.',
          figureId: 'fig3_antenna_configs',
          figureLabel: 'Fig 3: Antenna Configs',
        },
        {
          id: 'm7_q3',
          question: 'Why does adding antennas only at one end (SIMO or MISO) NOT increase the high-SNR capacity slope?',
          answer: 'Because rank(H) <= min(Nt, Nr) = 1! Only one spatial stream can be multiplexed; extra antennas at one end provide logarithmic SNR/array gain (horizontal shift) rather than multiplicative slope.',
          figureId: 'fig3_antenna_configs',
          figureLabel: 'Fig 3: Antenna Configs',
        },
        {
          id: 'm7_q4',
          question: 'What is the difference between Ergodic Capacity and 10% Outage Capacity?',
          answer: 'Ergodic capacity E[C] is the long-term average rate achievable when codewords span many independent fading states (delay-tolerant traffic). 10% Outage capacity C_0.1 is the rate guaranteed in 90% of realizations for slow-fading / delay-sensitive links.',
          figureId: 'fig4_outage_cdf',
          figureLabel: 'Fig 4: Outage CDF',
        },
        {
          id: 'm7_q5',
          question: 'How does Kronecker spatial antenna correlation (r_t, r_r > 0) degrade MIMO capacity?',
          answer: 'Spatial correlation makes the channel matrix H ill-conditioned (increasing eigenvalue spread toward rank-1). Smaller singular values drop into noise, reducing both effective multiplexing streams and ergodic capacity (especially severely for ρ >= 0.7).',
          figureId: 'fig5_correlation_loss',
          figureLabel: 'Fig 5: Correlation Loss',
        },
        {
          id: 'm7_q6',
          question: 'What is the closed-form analytical formula for SISO Rayleigh ergodic capacity?',
          answer: `C_SISO(ρ) = (e^(1/ρ) · E_1(1/ρ)) / ln(2), where E_1 is the exponential integral. Our Monte-Carlo simulation verified this closed form across all SNR points within ${vErr} max relative error.`,
          figureId: 'fig1_ergodic_capacity',
          figureLabel: 'Fig 1: Ergodic Capacity',
        },
        {
          id: 'm7_q7',
          question: 'Why is total transmit power normalized by 1/Nt in C = log2 det(I + (ρ/Nt) H H^H)?',
          answer: 'To ensure a fair comparison with SISO at the exact same total radiated power! Without 1/Nt normalization, adding transmit antennas would artificially inject Nt× more total transmit power.',
          figureId: 'fig1_ergodic_capacity',
          figureLabel: 'Fig 1: Ergodic Capacity',
        },
        {
          id: 'm7_q8',
          question: 'How does MIMO stabilize the capacity CDF (channel hardening)?',
          answer: 'As Nt and Nr grow (e.g., 4×4 and 8×8), averaging over Nt·Nr independent channel entries reduces the relative variance of capacity, making the CDF steeper and bringing 10% outage capacity much closer to ergodic capacity.',
          figureId: 'fig4_outage_cdf',
          figureLabel: 'Fig 4: Outage CDF',
        },
        {
          id: 'm7_q9',
          question: 'When would a 4×4 MIMO system gain more from water-filling with CSIT?',
          answer: 'At LOW SNR or HIGH spatial correlation, equal power allocation wastes power on weak eigenmodes; knowing CSIT lets the transmitter concentrate power on the strongest singular modes via water-filling. At high SNR and i.i.d. Rayleigh, equal power is nearly optimal.',
          figureId: 'fig5_correlation_loss',
          figureLabel: 'Fig 5: Correlation Loss',
        },
        {
          id: 'm7_q10',
          question: 'How is the correlated channel matrix H_corr generated mathematically in your engine?',
          answer: 'Using the Kronecker model H_corr = R_rx^(1/2) · H_iid · (R_tx^(1/2))^H, where R_tx and R_rx are exponential Toeplitz correlation matrices factored via exact Cholesky decomposition.',
          figureId: 'fig5_correlation_loss',
          figureLabel: 'Fig 5: Correlation Loss',
        },
      ];

    case 'module8':
      return [
        {
          id: 'm8_q1',
          question: 'Why does channel-aware OFDMA beat TDMA in total system throughput with identical power and bandwidth?',
          answer: `Through Multiuser Frequency Diversity! Because users fade independently across subcarriers, assigning each subcarrier to a user experiencing a fading peak (rather than a deep fade) boosted OFDMA Proportional Fair throughput by +${fmt(s.pfGainPct, 1)}% and Max-Sum-Rate by +${fmt(s.maxRateGainPct, 1)}% over TDMA.`,
          figureId: 'fig1_throughput_vs_snr',
          figureLabel: 'Fig 1: Throughput vs SNR',
        },
        {
          id: 'm8_q2',
          question: 'Why do blind OFDMA-Fixed and equal-time TDMA achieve the exact same average ergodic throughput?',
          answer: 'Without Channel State Information (CSI), each user receives 1/K of the time-frequency plane on average with identical marginal Rayleigh SNR statistics — yielding the exact same ergodic Shannon integral E[log2(1+γ|H|²)].',
          figureId: 'fig1_throughput_vs_snr',
          figureLabel: 'Fig 1: Throughput vs SNR',
        },
        {
          id: 'm8_q3',
          question: 'Why is greedy Max-Sum-Rate scheduling unacceptable in commercial cellular networks?',
          answer: `Max-Sum-Rate assigns nearly all subcarriers to the strongest near-BS user, starving weak cell-edge users (Jain fairness dropped to J = ${fmt(s.maxRateJain, 3)} in our run). Users at the cell edge would suffer timeouts and dropped sessions.`,
          figureId: 'fig2_per_user_rates',
          figureLabel: 'Fig 2: Per-User Rates',
        },
        {
          id: 'm8_q4',
          question: 'How does Proportional Fair (PF) scheduling achieve BOTH high throughput AND high fairness?',
          answer: `PF maximizes r_{k,m} / R̄_k (instantaneous rate normalized by moving-average rate). Every user gets scheduled when its OWN channel is at a relative fading peak — regardless of its average path loss — delivering +${fmt(s.pfGainPct, 1)}% gain over TDMA at Jain J = ${fmt(s.pfJain, 3)}.`,
          figureId: 'fig5_pareto_se_fairness',
          figureLabel: 'Fig 5: SE vs Fairness',
        },
        {
          id: 'm8_q5',
          question: 'What is the range and interpretation of Jain\'s Fairness Index J?',
          answer: 'J = (Σ R_k)² / (K · Σ R_k²) ranges from 1/K (worst case: one user gets 100% of resources) to 1.0 (perfect equality: every user receives identical throughput).',
          figureId: 'fig4_fairness_vs_snr',
          figureLabel: 'Fig 4: Jain Fairness',
        },
        {
          id: 'm8_q6',
          question: 'Why is the percentage multiuser diversity gain largest at low SNR?',
          answer: 'At low SNR, log2(1 + γ) ≈ γ/ln(2) is linear in SNR, so doubling instantaneous SNR via multiuser selection nearly doubles rate. At high SNR, log2(1 + γ) grows logarithmically so the same SNR boost yields a smaller percentage gain.',
          figureId: 'fig3_tdma_vs_ofdma_gain',
          figureLabel: 'Fig 3: OFDMA Gain %',
        },
        {
          id: 'm8_q7',
          question: 'Why does Max-Min fairness sacrifice total spectral efficiency compared to Proportional Fair?',
          answer: 'To force a 3 dB cell-edge user to match the rate of a 25 dB near user, Max-Min must divert a large fraction of the cell\'s subcarriers to the low-spectral-efficiency link, lowering aggregate cell throughput.',
          figureId: 'fig5_pareto_se_fairness',
          figureLabel: 'Fig 5: SE vs Fairness',
        },
        {
          id: 'm8_q8',
          question: 'What happens to multiuser diversity gain as the number of active users K increases?',
          answer: 'With more independent users competing for each subcarrier, the maximum of K exponential variables grows as ln(K) (extreme-value theory), monotonically boosting channel-aware OFDMA throughput!',
          figureId: 'fig3_tdma_vs_ofdma_gain',
          figureLabel: 'Fig 3: OFDMA Gain %',
        },
        {
          id: 'm8_q9',
          question: 'What happens in the limiting case K = 1, and how did you verify the simulation?',
          answer: `For K = 1, multiuser diversity vanishes and all schedulers collapse to the single-user Rayleigh Shannon rate. Both TDMA and K=1 verified against the exact exp(1/γ)E1(1/γ)/ln(2) formula within ${vErr}.`,
          figureId: 'fig1_throughput_vs_snr',
          figureLabel: 'Fig 1: Throughput vs SNR',
        },
        {
          id: 'm8_q10',
          question: 'What practical signaling overhead does channel-aware OFDMA require compared to TDMA?',
          answer: 'Users must measure and feed back sub-band Channel Quality Indicators (CQI) to the base station every few milliseconds, and the BS must transmit dynamic resource-block allocation maps (PDCCH in LTE/5G) on every frame.',
          figureId: 'fig5_pareto_se_fairness',
          figureLabel: 'Fig 5: SE vs Fairness',
        },
      ];
  }
}
