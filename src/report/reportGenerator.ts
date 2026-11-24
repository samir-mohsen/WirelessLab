import type {
  ModuleDescriptor,
  ModuleResultBundle,
  ModuleTheoryContent,
  TeamMember,
} from '../types/simulation';
import { renderLatexToHtml } from '../ui/MathBlock';
import { renderFigureToPngDataUrl } from '../ui/PlotlyChart';

export interface ReportExportOptions {
  reportTitle: string;
  dateStr: string;
  teamMembers: TeamMember[];
  references: string[];
  discussionText: string;
  conclusionsText: string;
  modules: Array<{
    descriptor: ModuleDescriptor;
    theory: ModuleTheoryContent;
    results: ModuleResultBundle;
  }>;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Generates a self-contained single printable HTML report matching the 12-section
 * ECE 441 Delta University Faculty of Engineering course report structure.
 */
export async function generatePrintableReportHtml(
  opts: ReportExportOptions,
): Promise<string> {
  // Capture all figures to high-DPI PNG data URLs via Plotly.toImage
  const renderedModules = await Promise.all(
    opts.modules.map(async (mod) => {
      const figureImages = await Promise.all(
        mod.results.figures.map(async (fig) => {
          const dataUrl = await renderFigureToPngDataUrl(fig, 1020, fig.layout.height ?? 500);
          return { fig, dataUrl };
        }),
      );
      return { ...mod, figureImages };
    }),
  );

  const primaryMod = renderedModules[0];
  const isSuite = renderedModules.length > 1;

  const teamRowsHtml = opts.teamMembers
    .map(
      (m) => `
      <tr>
        <td>${escapeHtml(m.name)}</td>
        <td class="mono">${escapeHtml(m.studentId)}</td>
        <td>${escapeHtml(m.contribution)}</td>
      </tr>`,
    )
    .join('');

  const referencesHtml = opts.references
    .map((ref, idx) => `<li>[${idx + 1}] ${escapeHtml(ref)}</li>`)
    .join('');

  const equationsHtml = renderedModules
    .map((mod) => {
      const eqBlocks = mod.theory.equations
        .map(
          (eq, idx) => `
          <div class="eq-card">
            <div class="eq-title">(${idx + 1}) ${escapeHtml(eq.title)}</div>
            <div class="eq-math">${renderLatexToHtml(eq.latex, true)}</div>
            <div class="eq-desc">${escapeHtml(eq.explanation)}</div>
          </div>`,
        )
        .join('');
      return `${isSuite ? `<h3>${escapeHtml(mod.descriptor.title)}</h3>` : ''}
        <p>${escapeHtml(mod.theory.systemModelSummary)}</p>
        ${eqBlocks}`;
    })
    .join('');

  const paramsTablesHtml = renderedModules
    .map((mod) => {
      const entries = Object.entries(mod.results.meta.paramsSnapshot);
      const rows = entries
        .map(
          ([k, v]) => `
          <tr>
            <td class="mono">${escapeHtml(k)}</td>
            <td class="mono">${escapeHtml(typeof v === 'object' ? JSON.stringify(v) : String(v))}</td>
          </tr>`,
        )
        .join('');
      return `
        ${isSuite ? `<h3>${escapeHtml(mod.descriptor.title)}</h3>` : ''}
        <table>
          <thead><tr><th>Parameter</th><th>Value</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    })
    .join('');

  const resultsHtml = renderedModules
    .map((mod) => {
      const figsHtml = mod.figureImages
        .map(({ fig, dataUrl }) => {
          const tblHeaders = fig.table.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
          const tblRows = fig.table.rows
            .slice(0, 24)
            .map(
              (r) =>
                `<tr>${r.map((c) => `<td class="mono">${escapeHtml(String(c))}</td>`).join('')}</tr>`,
            )
            .join('');
          const findings = fig.keyFindings.map((f) => `<li>${escapeHtml(f)}</li>`).join('');
          return `
            <div class="figure-block">
              <h4>${escapeHtml(fig.title)}</h4>
              ${fig.subtitle ? `<p class="muted">${escapeHtml(fig.subtitle)}</p>` : ''}
              <img src="${dataUrl}" alt="${escapeHtml(fig.title)}" class="fig-img" />
              <div class="findings-box">
                <strong>Computed Key Findings:</strong>
                <ul>${findings}</ul>
              </div>
              <table>
                <thead><tr>${tblHeaders}</tr></thead>
                <tbody>${tblRows}</tbody>
              </table>
            </div>`;
        })
        .join('');

      const ver = mod.results.verification;
      const verHtml = ver
        ? `<div class="verify-box">
            <strong>Automated Verification Summary:</strong> ${escapeHtml(ver.summary)}
          </div>`
        : '';

      return `${isSuite ? `<h3 id="mod-${escapeHtml(mod.descriptor.id)}">Module ${mod.descriptor.number}: ${escapeHtml(mod.descriptor.title)}</h3>` : ''}${verHtml}${figsHtml}`;
    })
    .join('');

  const allKeyFindingsHtml = renderedModules
    .map((mod) => {
      const bullets = mod.results.figures
        .flatMap((f) => f.keyFindings.slice(0, 2))
        .map((k) => `<li>${escapeHtml(k)}</li>`)
        .join('');
      return `${isSuite ? `<h4>${escapeHtml(mod.descriptor.title)}</h4>` : ''}<ul>${bullets}</ul>`;
    })
    .join('');

  const appendixJson = JSON.stringify(
    renderedModules.map((m) => ({
      module: m.descriptor.id,
      title: m.descriptor.title,
      seed: m.results.meta.seed,
      timestamp: m.results.meta.timestamp,
      elapsedMs: Math.round(m.results.meta.elapsedMs),
      totalBitsOrTrials: m.results.meta.totalBitsOrTrials,
      parameters: m.results.meta.paramsSnapshot,
    })),
    null,
    2,
  );

  // Extract loaded KaTeX CSS rules from document stylesheets so math prints cleanly offline
  let inlineKatexCss = '';
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const rules = Array.from(sheet.cssRules || []);
        const katexRules = rules
          .filter((r) => r.cssText.includes('.katex'))
          .map((r) => r.cssText)
          .join('\n');
        if (katexRules) inlineKatexCss += katexRules + '\n';
      } catch {
        // Cross-origin stylesheet skipped
      }
    }
  } catch {
    // ignore
  }

  const suiteTocAndSummaryHtml = isSuite
    ? (() => {
        const tocItems = renderedModules
          .map(
            (m) =>
              `<li><a href="#mod-${escapeHtml(m.descriptor.id)}">Module ${m.descriptor.number}: ${escapeHtml(m.descriptor.title)}</a> — ${m.results.figures.length} figures</li>`,
          )
          .join('');
        const summaryRows = renderedModules
          .map((m) => {
            const v = m.results.verification;
            const errStr =
              v && Number.isFinite(v.maxRelError)
                ? `${(v.maxRelError * 100).toFixed(2)}%`
                : 'N/A';
            const statusStr = v ? (v.passed ? 'PASS' : 'CHECK') : 'N/A';
            return `<tr>
              <td class="mono">M${m.descriptor.number}</td>
              <td>${escapeHtml(m.descriptor.shortTitle)}</td>
              <td class="mono">${m.results.figures.length}</td>
              <td class="mono">${statusStr}</td>
              <td class="mono">${errStr}</td>
              <td class="mono">${m.results.meta.seed}</td>
              <td class="mono">${m.results.meta.totalBitsOrTrials.toLocaleString()}</td>
            </tr>`;
          })
          .join('');
        return `
  <section style="page-break-after: always;">
    <h2>Table of Contents &amp; Executive Summary</h2>
    <p class="muted">Complete ECE 441 Multi-Module Simulation Portfolio (${renderedModules.length} of 8 Modules Simulated)</p>
    <h3>Included Modules</h3>
    <ol>${tocItems}</ol>
    <h3>Suite Verification &amp; Reproducibility Summary</h3>
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Module</th>
          <th>Figures</th>
          <th>Verify</th>
          <th>Max Rel. Err</th>
          <th>RNG Seed</th>
          <th>Trials / Bits</th>
        </tr>
      </thead>
      <tbody>${summaryRows}</tbody>
    </table>
  </section>`;
      })()
    : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(opts.reportTitle)} — ECE 441 Report</title>
  <style>
    ${inlineKatexCss}
    @page { margin: 18mm; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.55;
      max-width: 920px;
      margin: 0 auto;
      padding: 24px;
      font-size: 13px;
    }
    .cover {
      min-height: 85vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      border: 1px solid #cbd5e1;
      padding: 48px;
      page-break-after: always;
    }
    .cover .uni { font-size: 14px; font-weight: 600; color: #334155; letter-spacing: 0.04em; text-transform: uppercase; }
    .cover .course { font-size: 15px; color: #1d4ed8; font-weight: 600; margin-top: 8px; }
    .cover h1 { font-size: 30px; margin: 24px 0 12px; line-height: 1.2; color: #0f172a; }
    .cover .meta { margin-top: 28px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
    h2 { font-size: 18px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; margin-top: 32px; page-break-after: avoid; }
    h3 { font-size: 15px; margin-top: 20px; color: #1e293b; }
    h4 { font-size: 13.5px; margin: 16px 0 6px; color: #0f172a; }
    p, li { color: #1e293b; }
    .muted { color: #64748b; font-size: 12px; }
    .mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 11.5px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0 18px; font-size: 11.5px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
    th { background: #f1f5f9; font-weight: 600; }
    .eq-card { border: 1px solid #e2e8f0; padding: 12px 14px; margin: 10px 0; border-radius: 6px; page-break-inside: avoid; }
    .eq-title { font-weight: 600; font-size: 12px; margin-bottom: 6px; color: #334155; }
    .eq-math { margin: 8px 0; overflow-x: auto; }
    .eq-desc { font-size: 11.5px; color: #475569; }
    .figure-block { page-break-inside: avoid; margin: 20px 0 28px; }
    .fig-img { width: 100%; max-width: 860px; height: auto; border: 1px solid #e2e8f0; border-radius: 4px; display: block; margin: 8px 0; }
    .findings-box, .verify-box { background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px 14px; border-radius: 6px; margin: 10px 0; }
    pre { background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 11px; }
    @media print {
      body { padding: 0; max-width: none; }
      .cover { min-height: 92vh; }
    }
  </style>
</head>
<body>
  <!-- 1. Cover Page -->
  <section class="cover">
    <div class="uni">Delta University for Science and Technology — Faculty of Engineering</div>
    <div class="course">ECE 441 — Wireless and Mobile Communications (Option B: Simulation-Based Research)</div>
    <h1>${escapeHtml(opts.reportTitle)}</h1>
    <p class="muted">Generated by WirelessLab ECE441 (Local Monte-Carlo Simulation Suite)</p>
    <div class="meta">
      <p><strong>Date:</strong> ${escapeHtml(opts.dateStr)}</p>
      <p><strong>Prepared by:</strong></p>
      <table>
        <thead><tr><th>Student Name</th><th>Student ID</th><th>Role / Contribution</th></tr></thead>
        <tbody>${teamRowsHtml}</tbody>
      </table>
    </div>
  </section>

  ${suiteTocAndSummaryHtml}

  <!-- 2. Abstract and Objectives -->
  <h2>2. Abstract and Objectives</h2>
  <p>${escapeHtml(primaryMod.theory.abstract)}</p>
  <h3>Objectives</h3>
  <ul>${primaryMod.theory.objectives.map((o) => `<li>${escapeHtml(o)}</li>`).join('')}</ul>

  <!-- 3. Technical Background -->
  <h2>3. Technical Background</h2>
  ${renderedModules
    .map(
      (m) =>
        `${isSuite ? `<h3>${escapeHtml(m.descriptor.title)}</h3>` : ''}${m.theory.technicalBackground
          .map((p) => `<p>${escapeHtml(p)}</p>`)
          .join('')}`,
    )
    .join('')}

  <!-- 4. System Model and Equations -->
  <h2>4. System Model and Equations</h2>
  ${equationsHtml}

  <!-- 5. Simulation Methodology and Assumptions -->
  <h2>5. Simulation Methodology and Assumptions</h2>
  <h3>Methodology</h3>
  <ul>${primaryMod.theory.methodology.map((m) => `<li>${escapeHtml(m)}</li>`).join('')}</ul>
  <h3>Assumptions</h3>
  <ul>${primaryMod.theory.assumptions.map((a) => `<li>${escapeHtml(a)}</li>`).join('')}</ul>

  <!-- 6. Simulation Parameters and Scenarios -->
  <h2>6. Simulation Parameters and Scenarios</h2>
  ${paramsTablesHtml}

  <!-- 7. Results -->
  <h2>7. Results</h2>
  ${resultsHtml}

  <!-- 8. Discussion and Engineering Interpretation -->
  <h2>8. Discussion and Engineering Interpretation</h2>
  <h3>Automated Quantitative Findings</h3>
  ${allKeyFindingsHtml}
  ${
    opts.discussionText.trim()
      ? `<h3>Additional Engineering Discussion</h3><p>${escapeHtml(opts.discussionText).replace(/\n/g, '<br/>')}</p>`
      : ''
  }

  <!-- 9. Conclusions and Recommendations -->
  <h2>9. Conclusions and Recommendations</h2>
  <p>${escapeHtml(opts.conclusionsText).replace(/\n/g, '<br/>')}</p>

  <!-- 10. References -->
  <h2>10. References</h2>
  <ul style="list-style:none;padding-left:0;">${referencesHtml}</ul>

  <!-- 11. Team Contributions -->
  <h2>11. Team Contributions</h2>
  <table>
    <thead><tr><th>Student Name</th><th>Student ID</th><th>Contribution</th></tr></thead>
    <tbody>${teamRowsHtml}</tbody>
  </table>

  <!-- 12. Appendix -->
  <h2>12. Appendix: Reproducibility Parameters &amp; Seeds</h2>
  <pre class="mono">${escapeHtml(appendixJson)}</pre>
</body>
</html>`;
}

/**
 * Print an HTML string cleanly using a hidden iframe (avoids window.open popup blocking).
 */
export function printHtmlDocument(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => {
        if (iframe.parentNode) document.body.removeChild(iframe);
      }, 2000);
    }
  }, 450);
}
