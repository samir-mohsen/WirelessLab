# WirelessLab ECE441

**Desktop-grade, 100% offline simulation workbench for ECE 441 — Wireless and Mobile Communications**  
*Delta University for Science and Technology, Faculty of Engineering (Option B: Simulation-Based Research Presentation)*

All Monte-Carlo physics, signal processing, FFT/IFFT, matrix decompositions, LFSR PN/Gold codes, hexagonal cellular lattices, and analytical closed-form verification run **100% locally in browser Web Workers** with zero backend dependencies or external API calls.

---

## Quick Start (Web Dev, Build & Tests)

```bash
# 1. Install dependencies
npm install

# 2. Run local development server (http://localhost:3000)
npm run dev

# 3. Run all Vitest verification unit tests (core DSP engine + Modules 1–8 vs closed-form theory)
npm test

# 4. Type-check & create offline production bundle (dist/)
npm run lint
npm run build
```

---

## Packaging as a Windows Desktop App (`.exe` Installer + Portable)

`WirelessLab ECE441` includes a complete Electron desktop wrapper (`/electron/main.cjs`, `/electron/preload.cjs`) with persistent window bounds, native File/View/Help menus, offline asset loading (`base: './'`), and `electron-builder` configuration for both **NSIS Installer** and **Portable `.exe`**.

On a Windows (or macOS/Linux with Wine) machine:

```bash
# Install Electron & electron-builder locally as devDependencies
npm install -D electron electron-builder

# Option A: Launch Electron against the running Vite dev server
npm run dev
# (in a second terminal)
npm run electron:dev

# Option B: Build standalone Windows NSIS installer + portable .exe into dist-electron/
npm run electron:build
```

Outputs in `dist-electron/`:
- `WirelessLab ECE441 Setup 1.0.0.exe` (Windows NSIS installer with desktop shortcut)
- `WirelessLab ECE441 1.0.0.exe` (single-file portable executable — no install required)

---

## Course Mapping: All 8 ECE 441 Simulation Modules

| # | Module | Core Physical & Mathematical Engine | Required Figures | Theory Verification Target |
|---|---|---|---|---|
| **1** | **Wireless Propagation & Cellular Coverage** | FSPL, log-distance path loss + log-normal shadowing ($\sigma$), 900 MHz vs 3.5 GHz link budgets, 2D cell map | 6 figures (Pr vs d, PL 11.8 dB gap, exponent $n$, Coverage/Outage vs Q-func, Environments, 2D cell heatmap) | Analytical $Q((P_{\min}-\bar{P}_r)/\sigma)$ & exact 11.80 dB gap |
| **2** | **Diversity Combining over Fading Channels** | Coherent BPSK over $L$ i.i.d. Rayleigh branches ($L=1..8$), No Diversity, SC, EGC, MRC | 5 figures (BER vs SNR + theory, Fixed $L=2/4$, Diversity order slope, Outage probability, Complexity vs gain) | Exact closed-form MRC, SC & No-Div BER + Outage formulas |
| **3** | **OFDM Performance over Multipath Channels** | True linear-convolution ISI/ICI, $L$-tap exponential/uniform PDP, $N_{\text{cp}}$ sweep, ZF vs MMSE, QPSK/16-QAM | 7 figures (PDP & $|H[k]|$, AWGN/Rayleigh verify, BER vs CP, BER vs delay, Efficiency U-curve, ZF vs MMSE, Constellations) | Exact AWGN & Rayleigh QPSK/16-QAM BER closed forms |
| **4** | **DSSS Performance under Interference** | Real LFSR m-sequences ($2^m-1$) & Gold codes, narrowband tone / noise jamming, FFT PSD | 6 figures (BER vs $E_b/N_0$, BER vs $J/S$, SF effect, Measured vs theoretical $G_p$, BPSK vs DSSS, PSD spectrum) | AWGN BPSK & Gaussian-approx SINR $Q(\sqrt{2\gamma_{\text{eff}}})$ |
| **5** | **CDMA Near-Far Problem & Power Control** | Multiuser uplink DS-CDMA, No PC vs Ideal PC vs Imperfect PC ($\sigma_{\text{pc}}$) + Decorrelating MUD ($R^{-1}$) | 6 figures (BER vs NFR, User count $K$, SIR before/after PC, PC schemes & $K_{\max}$, SF vs MAI, Near-far physics) | Standard Gaussian Approximation (SGA) MAI formula |
| **6** | **Cellular Frequency Reuse & CCI** | Exact hexagonal lattice ($N = i^2+ij+j^2 \in \{1,3,4,7,9,12\}$), 1st & 2nd tier interferers, log-normal shadowing | 6 figures (Reuse geometry $D, q$, SIR vs $N$, SIR CDF/histogram, Outage vs $N$, Capacity trade-off, 2D hex heatmap) | Worst-case cell-edge $\text{SIR} = (\sqrt{3N})^n / 6$ |
| **7** | **SISO vs MIMO Capacity & Performance** | Complex Rayleigh $N_r \times N_t$ ($1\times1$..$8\times8$), exact $\log_2\det(I+\frac{\rho}{N_t}HH^H)$, Kronecker Cholesky correlation | 5 figures (Ergodic capacity vs SNR, High-SNR slope $\min(N_t,N_r)$, Antenna configs, 10% Outage CDF, Correlation loss) | Exact SISO $\frac{1}{\ln 2}e^{1/\rho}E_1(1/\rho)$ & SIMO/MISO bounds |
| **8** | **TDMA vs OFDMA Multiuser Allocation** | Frequency-selective multipath / Rayleigh, TDMA, OFDMA-Fixed, Max-Sum-Rate (+ Water-Filling), Proportional Fair, Max-Min | 5 figures (Throughput vs SNR, Per-user rates, TDMA vs OFDMA gain %, Jain fairness, Pareto SE vs Fairness) | Closed-form TDMA ergodic benchmark & Jain index $J \in [1/K, 1]$ |

---

## Suite-Wide Engineering Enhancements

- **2D Parameter Sweep (`2D Sweep` tab)**: Interactive Plotly Heatmap + Contour maps across parameter pairs with live ETA and abort support.
- **Scenario Presets**: Built-in Course Default / Worst Case / Urban presets per module plus custom presets persisted in `localStorage`.
- **Compare Runs & History**: Pin any figure's curves as a dotted reference overlay (`Pin Ref`) and restore any prior run's parameters & seed from `History`.
- **Examiner Viva Q&A (`Viva Q&A` tab)**: 80 course oral-exam questions (10 per module) dynamically populated from your computed results, with Quiz Mode scoring and figure jump links.
- **Auto-Discussion & 12-Section Reports**: Generates editable draft Discussion & Conclusions from computed metrics, single-module or full **Suite Report** (with Table of Contents & Executive Summary) exported as self-contained HTML or PDF.
- **Reproducible Code Export**: One-click standalone **Python (`.py`)** and **MATLAB (`.m`)** script generation matching current parameters & seed.
- **Real-Time Parameter Validity Checks**, **Keyboard Shortcuts (`Ctrl+Enter` Run, `Esc` Stop)**, **Global Search**, **Light/Dark Theme**, and **English / Arabic (RTL) UI Toggle**.

---

## Project Architecture

```text
├── electron/
│   ├── main.cjs              # Electron BrowserWindow, window state persistence, native menus
│   └── preload.cjs           # Context-isolated IPC bridge
├── build/
│   ├── icon.svg              # Vector desktop app icon
│   └── icon.png              # 256×256 PNG icon for electron-builder
├── src/
│   ├── engine/               # Pure TypeScript DSP, RNG, FFT, matrix, stats, workerPool, sweep, vivaBank, presets, validity
│   ├── export/               # Python (.py) & MATLAB (.m) code generators
│   ├── i18n/                 # English / Arabic RTL UI strings
│   ├── modules/
│   │   ├── registry.ts       # Metadata for all 8 ECE 441 modules
│   │   ├── adapter.tsx       # Unified ModuleAdapter registry
│   │   └── module1..module8/ # Each contains: model.ts, worker.ts, ui.tsx, theory.tsx, model.test.ts
│   ├── report/               # 12-section printable HTML/PDF report & Suite Report generator
│   ├── store/                # LocalStorage persistence, CSV/JSON download helpers
│   ├── types/                # Shared TypeScript interfaces
│   └── ui/                   # HomeDashboard, ModuleWorkspace, FigureTabView, PlotlyChart, SweepView, VivaView, PresentationMode, ReportModal
```

---

## How to Add a New Simulation Module

1. Create `src/modules/module9/` containing:
   - `model.ts` (parameter interface, defaults, pure Monte-Carlo & closed-form theory functions, `buildModule9Tasks`, `assembleModule9Results`, `MODULE9_THEORY`)
   - `worker.ts` (thin Web Worker importing `runModule9Task` from `./model`)
   - `ui.tsx` (grouped parameter sliders/inputs with tooltips)
   - `theory.tsx` (KaTeX system model & equations using `<MathBlock />`)
   - `model.test.ts` (Vitest unit test verifying simulation against analytical theory `<= 15%`)
2. Register the module descriptor in `src/modules/registry.ts` and add its adapter entry in `src/modules/adapter.tsx`.
3. Optionally add 2D sweep definitions (`src/engine/sweep.ts`), scenario presets (`src/engine/presets.ts`), Viva questions (`src/engine/vivaBank.ts`), and code templates (`src/export/codeExporter.ts`).
