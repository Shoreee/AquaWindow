import { useState } from 'react';
import type { StudyCondition } from '@aquawindow/agent-sdk';
import { AGENCY_SCALE, NASA_TLX, TASKS, downloadText, type QuestionnaireResponse } from '@aquawindow/study';
import { useShell } from '../hooks/useShell.js';
import {
  getQuestionnaires,
  launchScenario,
  logger,
  pushQuestionnaire,
  setCondition,
  setDepthEnabled,
  toggleConsole,
} from '../runtime.js';
import { store } from '../runtime.js';

const CONDITIONS: StudyCondition[] = ['baseline', 'tiling', 'fluid', 'fluid-agent'];

export function ResearcherConsole() {
  const shell = useShell();
  const [taskId, setTaskId] = useState(TASKS[0]!.id);
  const [qOpen, setQOpen] = useState(false);
  const task = TASKS.find((t) => t.id === taskId);

  if (!shell.consoleOpen) return null;

  return (
    <>
      <aside className="aw-console">
        <h3>Researcher console</h3>
        <label>
          Condition
          <select value={shell.condition} onChange={(e) => setCondition(e.target.value as StudyCondition)}>
            {CONDITIONS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Task
          <select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
            {TASKS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
        <p>{task?.goal}</p>
        <ol>
          {task?.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <button
            onClick={() => {
              launchScenario(taskId);
              logger.startTask(taskId, shell.condition);
            }}
          >
            Inject task
          </button>
          <button onClick={() => logger.completeTask()}>Complete</button>
          <button onClick={() => setDepthEnabled(!shell.depthEnabled)}>
            Depth {shell.depthEnabled ? 'on' : 'off'}
          </button>
          <button onClick={() => setQOpen(true)}>Questionnaire</button>
          <button
            onClick={() =>
              downloadText(
                `aquawindow-${Date.now()}.jsonl`,
                logger.toJSONL() +
                  '\n' +
                  JSON.stringify({ t: Date.now(), kind: 'questionnaires', payload: getQuestionnaires() }),
              )
            }
          >
            Export JSONL
          </button>
          <button
            onClick={() => {
              store.getWindows().forEach((w) => store.dispatch({ type: 'close', id: w.id }));
            }}
          >
            Close all
          </button>
          <button onClick={toggleConsole}>Hide</button>
        </div>
      </aside>
      {qOpen && (
        <Questionnaire
          condition={shell.condition}
          scenarioId={taskId}
          onClose={() => setQOpen(false)}
          onSubmit={(r) => {
            pushQuestionnaire(r);
            setQOpen(false);
          }}
        />
      )}
    </>
  );
}

function Questionnaire({
  condition,
  scenarioId,
  onClose,
  onSubmit,
}: {
  condition: string;
  scenarioId: string;
  onClose: () => void;
  onSubmit: (r: QuestionnaireResponse) => void;
}) {
  const [nasa, setNasa] = useState<Record<string, number>>({});
  const [agency, setAgency] = useState<Record<string, number>>({});

  return (
    <form
      className="aw-q"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ condition, scenarioId, nasaTlx: nasa, agency, completedAt: Date.now() });
      }}
    >
      <h2>Post-condition questionnaire</h2>
      <h3>NASA-TLX</h3>
      {NASA_TLX.map((item) => (
        <label key={item.id}>
          {item.label} ({item.lowAnchor}–{item.highAnchor})
          <input
            type="range"
            min={item.min}
            max={item.max}
            onChange={(e) => setNasa({ ...nasa, [item.id]: Number(e.target.value) })}
          />
        </label>
      ))}
      <h3>Agency</h3>
      {AGENCY_SCALE.map((item) => (
        <label key={item.id}>
          {item.label}
          <input
            type="range"
            min={item.min}
            max={item.max}
            onChange={(e) => setAgency({ ...agency, [item.id]: Number(e.target.value) })}
          />
        </label>
      ))}
      <button type="submit">Save</button>
      <button type="button" className="ghost" onClick={onClose} style={{ marginLeft: 8 }}>
        Cancel
      </button>
    </form>
  );
}
