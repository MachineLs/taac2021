// IntakeProvider contract and conversation state. Owner: B2.
import type { ConsultMode, IntakeRole, IntakeSummary } from '@tingyu/shared';

export type Slot = 'issue' | 'duration' | 'impact' | 'safety' | 'modality';
export const SLOT_ORDER: Slot[] = ['issue', 'duration', 'impact', 'safety', 'modality'];

export type Stage = Slot | 'crisis_check' | 'booking' | 'closing';

/** Provider-private conversation state, persisted in intake_sessions.state (JSON). */
export interface IntakeState {
  stage: Stage;                       // the question the assistant asked last
  turns: number;                      // user turns so far
  topics: string[];                   // ISSUE_TAGS, in order of salience
  issueText: string;                  // the user's first description
  duration: string | null;
  durationDays: number | null;
  impactAreas: string[];
  impactSeverity: 'mild' | 'moderate' | 'severe' | null;
  safety: 'unknown' | 'safe' | 'unclear' | 'risk';
  modality: ConsultMode | null;
  /** slot → filled ('done') or given up after follow-ups ('skipped') */
  slots: Partial<Record<Slot, 'done' | 'skipped'>>;
  retries: Partial<Record<Stage, number>>;
  recommended: string[];
  booking: 'unknown' | 'yes' | 'no';
  crisis: boolean;
  /** keyword-hit counters used to estimate scale scores in the summary */
  signals: { low: number; anxiety: number; sleep: number; fatigue: number };
  provider?: 'rules' | 'llm';
}

export function initialState(): IntakeState {
  return {
    stage: 'issue', turns: 0, topics: [], issueText: '', duration: null, durationDays: null, impactAreas: [], impactSeverity: null,
    safety: 'unknown', modality: null, slots: {}, retries: {}, recommended: [], booking: 'unknown', crisis: false,
    signals: { low: 0, anxiety: 0, sleep: 0, fatigue: 0 },
  };
}

export interface HistoryItem { role: IntakeRole; content: string }

export interface ReplyResult { text: string; state: IntakeState }

export interface IntakeProvider {
  readonly name: 'rules' | 'llm';
  /** history includes the latest user message as its last item. */
  reply(history: HistoryItem[], state: IntakeState): Promise<ReplyResult>;
  summarize(history: HistoryItem[], state: IntakeState): Promise<IntakeSummary>;
}

export const MAX_TURNS = 8;
