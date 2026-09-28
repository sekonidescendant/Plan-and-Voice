export type Phase = 'idle' | 'listening' | 'confirm' | 'generating' | 'schedule';

export type BlockType = 'task' | 'break' | 'fixed';

export interface ScheduleBlock {
  start: string;
  end: string;
  title: string;
  type: BlockType;
}

export interface GeminiResponse {
  tasks: string[];
  schedule: ScheduleBlock[];
  notes: string;
}

export interface PlanRequest {
  transcript: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
}
