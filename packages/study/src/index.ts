import files from './tasks/files.json';
import papers from './tasks/papers.json';
import meeting from './tasks/meeting.json';
import tutorial from './tasks/tutorial.json';
import design from './tasks/design.json';

export interface TaskScript {
  id: string;
  title: string;
  goal: string;
  steps: string[];
}

export const TASKS: TaskScript[] = [files, papers, meeting, tutorial, design] as TaskScript[];

export function getTask(id: string): TaskScript | undefined {
  return TASKS.find((t) => t.id === id);
}

export * from './logger.js';
export * from './replay.js';
export * from './questionnaires/scales.js';
