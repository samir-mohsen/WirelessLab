import type { ProjectStateSnapshot, TeamMember } from '../types/simulation';

export const STORAGE_KEY = 'wirelesslab_ece441_project_v1';
export const THEME_STORAGE_KEY = 'wirelesslab_ece441_theme_v1';

export const DEFAULT_TEAM_MEMBERS: TeamMember[] = [
  { name: 'Student 1 (Edit in About / Report)', studentId: '441-001', contribution: 'System modeling & Monte-Carlo engine' },
  { name: 'Student 2', studentId: '441-002', contribution: 'Theoretical verification & analysis' },
  { name: 'Student 3', studentId: '441-003', contribution: 'Results visualization & lab report' },
];

export const DEFAULT_REFERENCES: string[] = [
  'A. Goldsmith, Wireless Communications, Cambridge University Press, 2005.',
  'T. S. Rappaport, Wireless Communications: Principles and Practice, 2nd ed., Prentice Hall, 2002.',
  'J. G. Proakis and M. Salehi, Digital Communications, 5th ed., McGraw-Hill, 2008.',
  'D. Tse and P. Viswanath, Fundamentals of Wireless Communication, Cambridge University Press, 2005.',
  'A. J. Viterbi, CDMA: Principles of Spread Spectrum Communication, Addison-Wesley, 1995.',
  'T. M. Cover and J. A. Thomas, Elements of Information Theory, 2nd ed., Wiley, 2006.',
];

export function createDefaultProject(): ProjectStateSnapshot {
  return {
    version: '1.0.0',
    savedAt: new Date().toISOString(),
    teamMembers: DEFAULT_TEAM_MEMBERS.map((m) => ({ ...m })),
    reportReferences: [...DEFAULT_REFERENCES],
    discussionNotes: {},
    moduleParams: {},
    moduleResults: {},
  };
}

export function loadProjectFromLocalStorage(): ProjectStateSnapshot {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultProject();
    const parsed = JSON.parse(raw) as Partial<ProjectStateSnapshot>;
    return {
      version: parsed.version ?? '1.0.0',
      savedAt: parsed.savedAt ?? new Date().toISOString(),
      teamMembers:
        Array.isArray(parsed.teamMembers) && parsed.teamMembers.length > 0
          ? parsed.teamMembers
          : DEFAULT_TEAM_MEMBERS.map((m) => ({ ...m })),
      reportReferences:
        Array.isArray(parsed.reportReferences) && parsed.reportReferences.length > 0
          ? parsed.reportReferences
          : [...DEFAULT_REFERENCES],
      discussionNotes: parsed.discussionNotes ?? {},
      moduleParams: parsed.moduleParams ?? {},
      moduleResults: parsed.moduleResults ?? {},
    };
  } catch {
    return createDefaultProject();
  }
}

export function saveProjectToLocalStorage(snapshot: ProjectStateSnapshot): void {
  try {
    const payload: ProjectStateSnapshot = {
      ...snapshot,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // QuotaExceededError or private browsing: silently ignore as required
  }
}

export function loadSavedTheme(): 'light' | 'dark' {
  try {
    const t = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (t === 'dark' || t === 'light') return t;
  } catch {
    // ignore
  }
  return 'light';
}

export function saveTheme(theme: 'light' | 'dark'): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

export function downloadBlobFile(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

export function downloadTextFile(filename: string, content: string, mime = 'application/json'): void {
  downloadBlobFile(filename, new Blob([content], { type: mime }));
}

export function tableToCSVString(
  headers: string[],
  rows: Array<Array<string | number>>,
): string {
  const escapeCell = (cell: string | number) => {
    const s = String(cell);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map((r) => r.map(escapeCell).join(',')),
  ];
  return lines.join('\n');
}

export function exportTableToCSV(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number>>,
): void {
  downloadTextFile(filename, tableToCSVString(headers, rows), 'text/csv;charset=utf-8;');
}
