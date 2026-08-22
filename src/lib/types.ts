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
