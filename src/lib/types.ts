export type StreamId = 'cttl' | 'isodp' | 'dir' | 'career' | 'per';
export type Kind = 'task' | 'watch';

export interface Stream {
  id: StreamId;
  owner_id: string;
  title: string;
  short: string;
  code: string;
  position: number;
}

export interface Section {
  id: string;
  owner_id: string;
  stream_id: StreamId;
  title: string;
  /**
   * The group this section sits in. Null means it hangs straight off the
   * stream. One level only — a group's own parent is always null.
   */
  parent_id: string | null;
  monitor: boolean;
  position: number;
  deleted_at: string | null;
}

export interface Task {
  id: string;
  owner_id: string;
  stream_id: StreamId;
  section_id: string;
  natural_key: string | null;
  title: string;
  kind: Kind;
  context: string | null;
  note: string | null;
  done: boolean;
  done_at: string | null;
  do_now: boolean;
  due: string | null;
  position: number;
  user_edited: boolean;
  touched_at: string | null;
  reviewed_at: string | null;
  /** "I do not know what this means yet." Still work; just not actionable. */
  unclear: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Person {
  id: string;
  name: string;
  role: string | null;
}

/** A stream plus everything computed about it. */
export interface StreamHealth extends Stream {
  openTasks: number;
  doneTasks: number;
  watchItems: number;
  doNow: number;
  dated: number;
  lastTouchedAt: string | null;
  daysQuiet: number | null;
}

export type IntakeStatus = 'pending' | 'extracting' | 'ready' | 'failed';
export type Confidence = 'high' | 'medium' | 'low';

export interface Intake {
  id: string;
  owner_id: string;
  label: string | null;
  source_text: string;
  summary: string | null;
  status: IntakeStatus;
  error: string | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
  processed_at: string | null;
  deleted_at: string | null;
}

/** A proposal. Nothing here is in the register until it is accepted. */
export interface IntakeItem {
  id: string;
  intake_id: string;
  owner_id: string;
  title: string;
  kind: Kind;
  context: string | null;
  stream_id: StreamId | null;
  section_id: string | null;
  do_now: boolean;
  due: string | null;
  waiting_on: string[];
  evidence: string | null;
  confidence: Confidence;
  duplicate_of: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  task_id: string | null;
  position: number;
  created_at: string;
}

export type ReviewReason = 'overdue' | 'unfinishable' | 'unclear' | 'urgent_undated' | 'stale';
export type ReviewMode = 'weekly' | 'unclear' | 'person';

export interface ReviewCard {
  task: Task;
  reason: ReviewReason;
  daysIdle: number;
  /** Open items in the same section — a proxy for what is queued behind it. */
  blocking: number;
  waitingOn: string[];
}

export type Decision =
  | { kind: 'date'; due: string }
  | { kind: 'watch' }
  | { kind: 'drop' }
  | { kind: 'unclear' }
  | { kind: 'clear' }
  | { kind: 'done' }
  | { kind: 'chased' }
  | { kind: 'keep' };

export interface Thread {
  id: string;
  owner_id: string;
  title: string;
  anchor: string | null;
  created_at: string;
  deleted_at: string | null;
}
