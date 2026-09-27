import { useEffect, useState } from 'react';
import { createStore } from '../system/createStore';

/** Cross-app, scenario-scoped content state (not layout). */
export const appState = createStore<{
  agentFilesCreated: number;
  logLine: number;
  quarantined: string[];
  kept: string[];
  chat: { from: string; to?: string; text: string; mine?: boolean; t: number }[];
  tutorialStep: number;
  tutorialDone: string[];
  strokes: number;
  mentionAt: number | null;
  answered: boolean;
}>({
  agentFilesCreated: 0,
  logLine: 0,
  quarantined: [],
  kept: [],
  chat: [],
  tutorialStep: 0,
  tutorialDone: [],
  strokes: 0,
  mentionAt: null,
  answered: false,
});

export function resetAppState() {
  appState.set({
    agentFilesCreated: 0,
    logLine: 0,
    quarantined: [],
    kept: [],
    chat: [],
    tutorialStep: 0,
    tutorialDone: [],
    strokes: 0,
    mentionAt: null,
    answered: false,
  });
}

/** Scenario clock — seconds since the scenario (re)started. */
export const clock = createStore<{ startedAt: number; paused: boolean; pausedAt: number }>({
  startedAt: performance.now(),
  paused: false,
  pausedAt: 0,
});

export function scenarioSeconds() {
  const c = clock.get();
  return ((c.paused ? c.pausedAt : performance.now()) - c.startedAt) / 1000;
}

export function useScenarioTime(hz = 4) {
  const [t, setT] = useState(scenarioSeconds);
  useEffect(() => {
    const id = setInterval(() => setT(scenarioSeconds()), 1000 / hz);
    return () => clearInterval(id);
  }, [hz]);
  return t;
}
