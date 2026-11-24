import type * as Plotly from 'plotly.js';
import type { VerificationResult } from '../engine/stats';

export type ModuleId =
  | 'module1'
  | 'module2'
  | 'module3'
  | 'module4'
  | 'module5'
  | 'module6'
  | 'module7'
  | 'module8';

export type ModuleStatus = 'not_run' | 'ready' | 'requirements_met';

export interface DataTableSpec {
  headers: string[];
  rows: Array<Array<string | number>>;
}

export interface FigureSpec {
  id: string;
  title: string;
  shortTitle: string;
  subtitle?: string;
  traces: Plotly.Data[];
  layout: Partial<Plotly.Layout>;
  keyFindings: string[];
  table: DataTableSpec;
  isLogY?: boolean;
}

export interface RequirementCheck {
  id: string;
  label: string;
  met: boolean;
  detail: string;
}

export interface ConsoleEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

export interface TeamMember {
  name: string;
  studentId: string;
  contribution: string;
}

export interface ReportEquation {
  title: string;
  latex: string;
  explanation: string;
}

export interface ModuleTheoryContent {
  abstract: string;
  objectives: string[];
  technicalBackground: string[];
  systemModelSummary: string;
  equations: ReportEquation[];
  methodology: string[];
  assumptions: string[];
  conclusionsDefault: string[];
}

export interface ModuleRunMetadata {
  seed: number;
  elapsedMs: number;
  totalBitsOrTrials: number;
  totalErrors: number;
  quickMode: boolean;
  earlyStop: boolean;
  timestamp: string;
  paramsSnapshot: Record<string, unknown>;
}

export interface ModuleResultBundle {
  figures: FigureSpec[];
  verification: VerificationResult | null;
  requirements: RequirementCheck[];
  meta: ModuleRunMetadata;
  rawSummary?: Record<string, unknown>;
}

export interface ModuleDescriptor {
  id: ModuleId;
  number: number;
  title: string;
  shortTitle: string;
  oneLineIdea: string;
  milestone: number;
  implemented: boolean;
  requiredResultsSummary: string[];
}

export interface RunHistoryEntry {
  id: string;
  timestamp: string;
  seed: number;
  elapsedMs: number;
  mode: 'full' | 'quick' | 'selftest';
  figureCount: number;
  verifyPassed: boolean | null;
  params: Record<string, unknown>;
}

export interface ProjectStateSnapshot {
  version: string;
  savedAt: string;
  teamMembers: TeamMember[];
  reportReferences: string[];
  discussionNotes: Record<string, string>;
  moduleParams: Record<string, Record<string, unknown>>;
  moduleResults: Record<string, ModuleResultBundle | null>;
}

declare global {
  interface Window {
    wirelessLabDesktop?: {
      isDesktop: boolean;
      platform: string;
      onMenuAction: (callback: (action: string) => void) => () => void;
    };
  }
}
