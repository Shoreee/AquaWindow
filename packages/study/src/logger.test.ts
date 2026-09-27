import { describe, expect, it } from 'vitest';
import { WindowStore } from '@aquawindow/wm-kernel';
import { StudyLogger } from './logger.js';
import { getTask, TASKS } from './index.js';

describe('study', () => {
  it('ships five task scripts', () => {
    expect(TASKS).toHaveLength(5);
    expect(getTask('files')?.goal).toMatch(/CHI-draft/);
  });

  it('logs kernel commands as JSONL', () => {
    const store = new WindowStore();
    const logger = new StudyLogger();
    logger.attach(store);
    logger.startTask('files', 'fluid');
    store.dispatch({ type: 'open', window: { appId: 'finder', title: 'A' } });
    logger.completeTask();
    const lines = logger.toJSONL().split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(logger.getSession()?.completedAt).toBeTruthy();
  });
});
