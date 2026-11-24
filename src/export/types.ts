import type {
  FigureSpec,
  ModuleDescriptor,
  ModuleResultBundle,
  ModuleTheoryContent,
  TeamMember,
} from '../types/simulation';

export interface SubmissionModulePayload {
  descriptor: ModuleDescriptor;
  theory: ModuleTheoryContent;
  results: ModuleResultBundle;
  params?: Record<string, unknown>;
}

export interface SubmissionExportOptions {
  reportTitle: string;
  dateStr: string;
  teamMembers: TeamMember[];
  references: string[];
  discussionText: string;
  conclusionsText: string;
  modules: SubmissionModulePayload[];
  /** Optional cache of pre-rendered 2x PNG data URLs keyed by `${moduleId}:${figureId}` */
  preRenderedFigures?: Record<string, string>;
  onProgress?: (message: string) => void;
}

const FALLBACK_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

export function slugifyFilename(text: string, maxLen = 44): string {
  const s = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, maxLen);
  return s || 'ece441_submission';
}

export function figureCacheKey(moduleId: string, figureId: string): string {
  return `${moduleId}:${figureId}`;
}

/**
 * Render all module figures once at high DPI (2x) and return a map keyed by `${moduleId}:${figureId}`.
 * Gracefully falls back to a valid minimal PNG when executed in headless Node unit tests.
 */
export async function preRenderAllFigures(
  modules: SubmissionModulePayload[],
  existing?: Record<string, string>,
  onProgress?: (msg: string) => void,
): Promise<Record<string, string>> {
  const out: Record<string, string> = { ...(existing ?? {}) };
  const isBrowser = typeof document !== 'undefined' && typeof window !== 'undefined';

  let count = 0;
  const total = modules.reduce((acc, m) => acc + m.results.figures.length, 0);

  for (const mod of modules) {
    for (const fig of mod.results.figures) {
      const key = figureCacheKey(mod.descriptor.id, fig.id);
      if (out[key]) {
        count++;
        continue;
      }
      count++;
      onProgress?.(`Rendering high-DPI figure ${count}/${total}: ${fig.shortTitle}...`);
      if (!isBrowser) {
        out[key] = FALLBACK_PNG_DATA_URL;
        continue;
      }
      try {
        const { renderFigureToPngDataUrl } = await import('../ui/PlotlyChart');
        const dataUrl = await renderFigureToPngDataUrl(fig, 1120, 560);
        out[key] = dataUrl.startsWith('data:image/png') ? dataUrl : FALLBACK_PNG_DATA_URL;
      } catch {
        out[key] = FALLBACK_PNG_DATA_URL;
      }
    }
  }
  return out;
}

export function getEffectiveParams(mod: SubmissionModulePayload): Record<string, unknown> {
  if (mod.params && Object.keys(mod.params).length > 0) {
    return mod.params;
  }
  return mod.results.meta.paramsSnapshot ?? {};
}

export function summarizeFigureForComparison(fig: FigureSpec): string {
  return fig.keyFindings[0] ?? fig.title;
}
