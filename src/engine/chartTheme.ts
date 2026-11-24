import type * as Plotly from 'plotly.js';
import type { WilsonCI } from './stats';

/** Fixed color-blind-safe categorical palette in exact mandated order. */
export const SERIES_PALETTE = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
] as const;

/** Distinct marker symbols per series index (>= 6px). */
export const SERIES_MARKERS = [
  'circle',
  'square',
  'diamond',
  'triangle-up',
  'cross',
  'x',
  'triangle-down',
  'star',
] as const;

export function seriesColor(index: number): string {
  return SERIES_PALETTE[index % SERIES_PALETTE.length];
}

export function seriesMarker(index: number): string {
  return SERIES_MARKERS[index % SERIES_MARKERS.length];
}

/**
 * Create a simulation curve trace: markers + 2px line, optional 95% Wilson CI error bars.
 */
export function makeSimTrace(opts: {
  name: string;
  x: number[];
  y: number[];
  seriesIndex: number;
  wilson?: WilsonCI[];
  mode?: 'lines+markers' | 'markers';
  markerSize?: number;
  hoverTemplate?: string;
}): Plotly.Data {
  const color = seriesColor(opts.seriesIndex);
  const symbol = seriesMarker(opts.seriesIndex);

  const trace: Record<string, unknown> = {
    type: 'scatter',
    mode: opts.mode ?? 'lines+markers',
    name: opts.name,
    x: opts.x,
    y: opts.y,
    line: {
      color,
      width: 2,
    },
    marker: {
      color,
      symbol,
      size: Math.max(6, opts.markerSize ?? 7),
      line: { width: 1, color: '#ffffff' },
    },
  };

  if (opts.wilson && opts.wilson.length === opts.y.length) {
    trace.error_y = {
      type: 'data',
      symmetric: false,
      array: opts.wilson.map((w) => w.errPlus),
      arrayminus: opts.wilson.map((w) => w.errMinus),
      visible: true,
      thickness: 1.3,
      width: 4,
      color,
    };
  }

  if (opts.hoverTemplate) {
    trace.hovertemplate = opts.hoverTemplate;
  }

  return trace as Plotly.Data;
}

/**
 * Create a theoretical reference trace: dashed gray line (2px), no heavy markers.
 */
export function makeTheoryTrace(opts: {
  name: string;
  x: number[];
  y: number[];
  color?: string;
  dash?: 'dash' | 'dot' | 'dashdot';
}): Plotly.Data {
  return {
    type: 'scatter',
    mode: 'lines',
    name: opts.name,
    x: opts.x,
    y: opts.y,
    line: {
      color: opts.color ?? '#64748b',
      width: 2,
      dash: opts.dash ?? 'dash',
    },
  } as Plotly.Data;
}

/**
 * Apply consistent light/dark or presentation-mode styling to any Plotly layout.
 * Never uses dual axes; shows legend whenever >= 2 traces are present.
 */
export function buildThemedLayout(
  base: Partial<Plotly.Layout>,
  traceCount: number,
  options: { isDark: boolean; presentation?: boolean },
): Partial<Plotly.Layout> {
  const isDark = options.presentation ? false : options.isDark;
  const pres = Boolean(options.presentation);

  const bg = isDark ? '#0f172a' : '#ffffff';
  const paperBg = isDark ? '#0f172a' : '#ffffff';
  const fg = isDark ? '#e2e8f0' : '#0f172a';
  const muted = isDark ? '#94a3b8' : '#475569';
  const grid = isDark ? '#1e293b' : '#e2e8f0';
  const zeroLine = isDark ? '#334155' : '#cbd5e1';

  const baseFontSize = pres ? 16 : 12;
  const titleFontSize = pres ? 20 : 14;

  const mergedXAxis: Partial<Plotly.LayoutAxis> = {
    gridcolor: grid,
    zerolinecolor: zeroLine,
    linecolor: zeroLine,
    tickfont: { color: muted, size: baseFontSize - 1, family: 'IBM Plex Mono, monospace' },
    title: {
      ...(typeof base.xaxis?.title === 'string'
        ? { text: base.xaxis.title }
        : (base.xaxis?.title as Record<string, unknown> | undefined)),
      font: { color: fg, size: baseFontSize, family: 'Plus Jakarta Sans, sans-serif' },
    },
    ...(base.xaxis ?? {}),
  };

  const mergedYAxis: Partial<Plotly.LayoutAxis> = {
    gridcolor: grid,
    zerolinecolor: zeroLine,
    linecolor: zeroLine,
    tickfont: { color: muted, size: baseFontSize - 1, family: 'IBM Plex Mono, monospace' },
    title: {
      ...(typeof base.yaxis?.title === 'string'
        ? { text: base.yaxis.title }
        : (base.yaxis?.title as Record<string, unknown> | undefined)),
      font: { color: fg, size: baseFontSize, family: 'Plus Jakarta Sans, sans-serif' },
    },
    ...(base.yaxis ?? {}),
  };

  // Re-apply title font carefully in case base.xaxis overwrote title object
  if (base.xaxis?.title) {
    const tText = typeof base.xaxis.title === 'string' ? base.xaxis.title : base.xaxis.title.text;
    mergedXAxis.title = {
      text: tText,
      font: { color: fg, size: baseFontSize, family: 'Plus Jakarta Sans, sans-serif' },
      standoff: 10,
    };
  }
  if (base.yaxis?.title) {
    const tText = typeof base.yaxis.title === 'string' ? base.yaxis.title : base.yaxis.title.text;
    mergedYAxis.title = {
      text: tText,
      font: { color: fg, size: baseFontSize, family: 'Plus Jakarta Sans, sans-serif' },
      standoff: 10,
    };
  }

  const isMultiRow = Boolean(base.grid && (base.grid.rows ?? 1) > 1);
  const hasTitle = Boolean(base.title);
  const showLegend = traceCount >= 2 ? true : (base.showlegend ?? false);
  const topMargin = hasTitle
    ? showLegend
      ? pres
        ? 102
        : 92
      : pres
        ? 58
        : 52
    : pres
      ? 48
      : isMultiRow
        ? 56
        : 44;

  return {
    ...base,
    autosize: true,
    paper_bgcolor: paperBg,
    plot_bgcolor: bg,
    font: {
      family: 'Plus Jakarta Sans, sans-serif',
      size: baseFontSize,
      color: fg,
    },
    title: hasTitle
      ? {
          text: typeof base.title === 'string' ? base.title : base.title!.text,
          font: { size: titleFontSize, color: fg, family: 'Plus Jakarta Sans, sans-serif' },
          x: 0.02,
          xanchor: 'left',
          y: 0.97,
          yref: 'container',
          yanchor: 'top',
        }
      : undefined,
    margin: base.margin ?? {
      l: pres ? 74 : 64,
      r: base.yaxis2 ? 68 : 24,
      t: topMargin,
      b: pres ? 54 : 52,
    },
    showlegend: showLegend,
    legend: {
      orientation: 'h',
      yanchor: 'bottom',
      y: isMultiRow ? 1.06 : 1.02,
      xanchor: 'left',
      x: 0,
      bgcolor: isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.88)',
      bordercolor: grid,
      borderwidth: 1,
      font: { size: pres ? 13 : 11, color: fg },
      ...(base.legend ?? {}),
    },
    hovermode: base.hovermode ?? 'closest',
    xaxis: mergedXAxis,
    yaxis: mergedYAxis,
  };
}

/** Convenient aliases shared across modules 1-8. */
export const PALETTE = SERIES_PALETTE;
export const SIM_MARKERS = SERIES_MARKERS;
export const THEORY_LINE_COLOR = '#64748b';

export function baseFigureLayout(
  title: string,
  xTitle: string,
  yTitle: string,
  logY = false,
  extra?: Partial<Plotly.Layout>,
): Partial<Plotly.Layout> {
  return {
    ...extra,
    title: { text: title },
    xaxis: {
      title: { text: xTitle },
      ...(extra?.xaxis ?? {}),
    },
    yaxis: {
      title: { text: yTitle },
      ...(logY ? { type: 'log' as const } : {}),
      ...(extra?.yaxis ?? {}),
    },
  };
}

