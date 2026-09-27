import { AgentController } from '../agent/controller';
import { log, setLogContext } from '../study/logger';
import { bus } from './bus';
import { kernel, workArea } from './kernel';
import { setTech, toast, ui } from './ui';

export { bus, kernel, ui, workArea };

export const agent = new AgentController({
  kernel,
  work: workArea,
  events: () => bus.recent,
  autonomy: () => ui.get().autonomy,
  enabled: () => ui.get().agentEnabled,
  tech: () => ui.get().tech,
  scenarioId: () => ui.get().scenarioId,
  applyTechniques: (t) => {
    setTech(t);
    log({ src: 'technique', type: 'set', actor: 'agent', data: t as Record<string, unknown> });
  },
  notify: (text, undo) => toast(text, undo),
});

setLogContext(() => {
  const s = ui.get();
  return { condition: s.condition, scenario: s.scenarioId, strategy: s.strategyId, participant: s.participant };
});

kernel.onEvent((e) => log({ src: 'kernel', type: e.type, actor: e.actor, windowId: e.windowId, data: e.data }));
bus.on((e) => {
  log({ src: 'bus', type: e.type, windowId: e.windowId, data: e.data });
  agent.schedule(250);
});

export function undo() {
  const last = kernel.lastHistory();
  kernel.undo('user');
  if (last?.actor === 'agent') agent.noteUndo();
}
