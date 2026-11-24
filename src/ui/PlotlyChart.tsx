import React, { useEffect, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';
import { buildThemedLayout } from '../engine/chartTheme';
import type { FigureSpec } from '../types/simulation';

interface PlotlyChartProps {
  figure: FigureSpec;
  isDark: boolean;
  presentation?: boolean;
  className?: string;
  onPlotElementReady?: (el: HTMLElement | null) => void;
}

export const PlotlyChart: React.FC<PlotlyChartProps> = ({
  figure,
  isDark,
  presentation = false,
  className = '',
  onPlotElementReady,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const themedLayout = buildThemedLayout(figure.layout, figure.traces.length, {
      isDark,
      presentation,
    });

    const config: Partial<Plotly.Config> = {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d'],
      toImageButtonOptions: {
        format: 'png',
        filename: figure.id,
        width: 1100,
        height: 620,
        scale: 2,
      },
    };

    void Plotly.react(el, figure.traces, themedLayout, config);
    onPlotElementReady?.(el);

    const ro = new ResizeObserver(() => {
      if (el && el.clientWidth > 0) {
        try {
          Plotly.Plots.resize(el);
        } catch {
          // ignore during teardown
        }
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      onPlotElementReady?.(null);
      try {
        Plotly.purge(el);
      } catch {
        // ignore
      }
    };
  }, [figure, isDark, presentation, onPlotElementReady]);

  const minH = presentation
    ? Math.min(430, figure.layout.height ?? 415)
    : (figure.layout.height ?? 420);

  return (
    <div
      ref={containerRef}
      data-testid={`plotly-chart-${figure.id}`}
      className={`w-full ${className}`}
      style={{ height: `${minH}px` }}
    />
  );
};

/**
 * Render any FigureSpec offscreen to a high-resolution light-themed PNG data URL
 * using Plotly.toImage (for Report Export & toolbar Export PNG).
 */
export async function renderFigureToPngDataUrl(
  figure: FigureSpec,
  width = 1040,
  height = 560,
): Promise<string> {
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.width = `${width}px`;
  host.style.height = `${height}px`;
  document.body.appendChild(host);

  try {
    const themedLayout = buildThemedLayout(
      { ...figure.layout, width, height },
      figure.traces.length,
      { isDark: false, presentation: false },
    );
    await Plotly.newPlot(host, figure.traces, themedLayout, { staticPlot: true });
    const dataUrl = await Plotly.toImage(host, {
      format: 'png',
      width,
      height,
      scale: 2,
    });
    return dataUrl;
  } finally {
    try {
      Plotly.purge(host);
    } catch {
      // ignore
    }
    document.body.removeChild(host);
  }
}

export async function downloadActiveChartPng(
  el: HTMLElement | null,
  figure: FigureSpec,
): Promise<void> {
  let dataUrl: string;
  if (el) {
    dataUrl = await Plotly.toImage(el, {
      format: 'png',
      width: 1100,
      height: 620,
      scale: 2,
    });
  } else {
    dataUrl = await renderFigureToPngDataUrl(figure, 1100, 620);
  }
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${figure.id}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
