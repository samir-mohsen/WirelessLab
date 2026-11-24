import katex from 'katex';

export interface RenderedEquationImage {
  dataUrl: string;
  bytes: Uint8Array;
  width: number;
  height: number;
}

/** Convert a data:image/png;base64,... URL into raw PNG Uint8Array bytes. */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',');
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

/** Convert LaTeX to clean Unicode math typography for deterministic fallback rendering. */
export function latexToReadableMath(latex: string): string {
  return latex
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .replace(/\\mathrm\{([^}]*)\}/g, '$1')
    .replace(/\\mathbf\{([^}]*)\}/g, '$1')
    .replace(/\\mathcal\{([^}]*)\}/g, '$1')
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1) / ($2)')
    .replace(/\\sqrt\{([^}]*)\}/g, '√($1)')
    .replace(/\\sum_\{([^}]*)\}\^\{([^}]*)\}/g, 'Σ[$1..$2]')
    .replace(/\\sum/g, 'Σ')
    .replace(/\\prod/g, 'Π')
    .replace(/\\int/g, '∫')
    .replace(/\\infty/g, '∞')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\bar\{\\gamma\}/g, 'γ̄')
    .replace(/\\sigma/g, 'σ')
    .replace(/\\rho/g, 'ρ')
    .replace(/\\tau/g, 'τ')
    .replace(/\\eta/g, 'η')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\lambda/g, 'λ')
    .replace(/\\mu/g, 'μ')
    .replace(/\\pi/g, 'π')
    .replace(/\\theta/g, 'θ')
    .replace(/\\phi/g, 'φ')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\cdot/g, '·')
    .replace(/\\times/g, '×')
    .replace(/\\le/g, '≤')
    .replace(/\\ge/g, '≥')
    .replace(/\\approx/g, '≈')
    .replace(/\\ne/g, '≠')
    .replace(/\\pm/g, '±')
    .replace(/\\log_\{?2\}?/g, 'log₂')
    .replace(/\\log_\{?10\}?/g, 'log₁₀')
    .replace(/\\ln/g, 'ln')
    .replace(/\\exp/g, 'exp')
    .replace(/\\det/g, 'det')
    .replace(/\\min/g, 'min')
    .replace(/\\max/g, 'max')
    .replace(/\\left|\\right|\\quad|\\,|\\;|\\!/g, ' ')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractInlineKatexCssSafe(): string {
  // Extract structural KaTeX rules without external @font-face URLs (prevents canvas tainting)
  let css = '';
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules || [])) {
          const text = rule.cssText;
          if (text.startsWith('@font-face') || text.includes('url(')) continue;
          if (text.includes('.katex')) css += text + '\n';
        }
      } catch {
        // Skip cross-origin sheets
      }
    }
  } catch {
    // Non-browser environment
  }
  return css;
}

/**
 * Render a LaTeX equation (via KaTeX HTML inside an SVG foreignObject or HiDPI Canvas fallback)
 * into a crisp PNG image for embedding inside PowerPoint (.pptx) slides and Word (.docx) reports.
 * 100% browser-local and offline-safe.
 */
export async function renderEquationToPng(
  latex: string,
  title?: string,
  width = 860,
  height = 112,
): Promise<RenderedEquationImage> {
  const scale = 2;

  // Attempt crisp KaTeX SVG foreignObject rasterization first (browser DOM only)
  if (typeof document !== 'undefined' && typeof Image !== 'undefined') {
    try {
      const html = katex.renderToString(latex, {
        displayMode: true,
        throwOnError: false,
        strict: false,
        output: 'html',
      });
      const katexCss = extractInlineKatexCssSafe();
      const safeTitle = title
        ? `<div style="font-family:'Plus Jakarta Sans',system-ui,sans-serif;font-size:13px;font-weight:600;color:#334155;margin-bottom:6px;">${title
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')}</div>`
        : '';

      const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" />
        <foreignObject x="16" y="10" width="${width - 32}" height="${height - 20}">
          <div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;color:#0f172a;font-family:'Cambria Math','Times New Roman',serif;font-size:18px;overflow:hidden;">
            <style>${katexCss} .katex-display{margin:0 !important;text-align:left !important;} .katex{font-size:1.08em;color:#0f172a;}</style>
            ${safeTitle}
            <div>${html}</div>
          </div>
        </foreignObject>
      </svg>`;

      const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);

      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = (e) => reject(e);
          el.src = svgUrl;
        });

        const canvas = document.createElement('canvas');
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(scale, scale);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/png');
          if (dataUrl.startsWith('data:image/png;base64,')) {
            return {
              dataUrl,
              bytes: dataUrlToBytes(dataUrl),
              width,
              height,
            };
          }
        }
      } finally {
        URL.revokeObjectURL(svgUrl);
      }
    } catch {
      // Fall through to deterministic 2D Canvas math renderer
    }

    // Crisp HiDPI 2D Canvas fallback (guaranteed untainted & readable)
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(scale, scale);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, width - 2, height - 2);

      let y = 30;
      if (title) {
        ctx.fillStyle = '#334155';
        ctx.font = '600 14px system-ui, -apple-system, sans-serif';
        ctx.fillText(title, 20, y);
        y += 38;
      } else {
        y = Math.round(height / 2) + 8;
      }

      ctx.fillStyle = '#0f172a';
      ctx.font = 'italic 20px Georgia, "Times New Roman", serif';
      const readable = latexToReadableMath(latex);
      ctx.fillText(readable.slice(0, 92), 20, y, width - 40);

      const dataUrl = canvas.toDataURL('image/png');
      return {
        dataUrl,
        bytes: dataUrlToBytes(dataUrl),
        width,
        height,
      };
    }
  }

  // Minimal valid 1x1 transparent PNG fallback for headless Node unit tests
  const minimalPngB64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
  const dataUrl = `data:image/png;base64,${minimalPngB64}`;
  return {
    dataUrl,
    bytes: dataUrlToBytes(dataUrl),
    width,
    height,
  };
}
