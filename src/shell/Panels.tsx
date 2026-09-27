import { useEffect, useRef, useState } from 'react';
import { agentStore } from '../agent/controller';
import { observationToPrompt } from '../agent/observe';
import { RULES } from '../agent/rules';
import { useScenarioTime } from '../apps/state';
import { loadScenario } from '../scenarios/director';
import { scenarioById, SCENARIOS } from '../scenarios/scenarios';
import { exportJsonl, logStore, summarize } from '../study/logger';
import { useStore } from '../system/createStore';
import { agent, ui } from './hooks';

export function ScenarioPanel() {
  const show = useStore(ui, (s) => s.scenarioPanel);
  const sc = useStore(ui, (s) => scenarioById(s.scenarioId));
  const strategyId = useStore(ui, (s) => s.strategyId);
  const collapsed = useStore(ui, (s) => s.scenarioCollapsed);
  const setCollapsed = (v: boolean) => ui.set({ scenarioCollapsed: v });
  const t = useScenarioTime(1);
  const over = useRef(false);
  useEffect(() => {
    if (!sc || collapsed) return;
    const id = window.setTimeout(() => {
      if (!over.current) ui.set({ scenarioCollapsed: true });
    }, 8000);
    return () => clearTimeout(id);
  }, [sc?.id, strategyId, collapsed]);
  if (!show || !sc) return null;
  const st = sc.strategies.find((s) => s.id === strategyId) ?? sc.strategies[0];
  if (collapsed)
    return (
      <button className="scn-pill" onClick={() => setCollapsed(false)}>
        <b>S{sc.n}</b> {sc.title} · {st.id} {st.label} · {Math.floor(t)}s
      </button>
    );
  return (
    <div
      className="scn-panel"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerEnter={() => {
        over.current = true;
      }}
      onPointerLeave={() => {
        over.current = false;
      }}
    >
      <div className="scn-top">
        <span className="scn-badge">Scenario {sc.n}</span>
        <span className="scn-rq">{sc.rq.join(' · ')}</span>
        <span className="grow" />
        <span className="scn-time">{Math.floor(t / 60)}:{String(Math.floor(t % 60)).padStart(2, '0')}</span>
        <button className="tb-btn" onClick={() => setCollapsed(true)} title="Collapse">
          –
        </button>
      </div>
      <h3>{sc.title}</h3>
      <div className="scn-zh">{sc.zh}</div>
      <dl>
        <dt>Task</dt>
        <dd>{sc.task}</dd>
        <dt>Goal</dt>
        <dd>{sc.goal}</dd>
        <dt>Why it is hard</dt>
        <dd>{sc.whyHard}</dd>
        <dt>Initial occlusion</dt>
        <dd>{sc.occlusion}</dd>
      </dl>
      <div className="scn-h">Competing designs</div>
      <div className="scn-strats">
        {sc.strategies.map((s) => (
          <button key={s.id} className={`strat ${s.id === st.id ? 'on' : ''}`} onClick={() => loadScenario(sc.id, s.id)} title={s.description}>
            <b>{s.id}</b> {s.label}
            {s.agent && <span className="ai">agent</span>}
          </button>
        ))}
      </div>
      <div className="strat-detail">
        <div className="lineage">{st.lineage}</div>
        <p>{st.description}</p>
        <ul>
          {st.tryThis.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </div>
      <div className="scn-foot">
        <button className="btn" onClick={() => loadScenario(sc.id, st.id)}>
          Restart
        </button>
        <button className="btn" onClick={() => loadScenario(SCENARIOS[(sc.n) % SCENARIOS.length].id)}>
          Next scenario →
        </button>
      </div>
    </div>
  );
}

export function ResearcherConsole() {
  const open = useStore(ui, (s) => s.consoleOpen);
  const records = useStore(logStore, (s) => s.records);
  const participant = useStore(ui, (s) => s.participant);
  const memory = useStore(agentStore, (s) => s.memory);
  const history = useStore(agentStore, (s) => s.history);
  const [tab, setTab] = useState<'session' | 'agent' | 'log'>('session');
  const [, force] = useState(0);
  if (!open) return null;
  const sum = summarize(records);
  return (
    <div className="console" onPointerDown={(e) => e.stopPropagation()}>
      <div className="console-top">
        <b>Researcher console</b>
        <div className="seg small">
          {(['session', 'agent', 'log'] as const).map((t) => (
            <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>
        <span className="grow" />
        <button className="tb-btn" onClick={() => ui.set({ consoleOpen: false })}>
          ✕
        </button>
      </div>
      {tab === 'session' && (
        <div className="console-body">
          <label className="row">
            Participant <input value={participant} onChange={(e) => ui.set({ participant: e.target.value })} />
          </label>
          <div className="metrics">
            {Object.entries(sum).map(([k, v]) => (
              <div key={k}>
                <b>{v}</b>
                <span>{k}</span>
              </div>
            ))}
          </div>
          <div className="scn-h">Run a scenario × design</div>
          <div className="matrix">
            {SCENARIOS.map((s) => (
              <div key={s.id} className="mrow">
                <span>
                  {s.n}. {s.title}
                </span>
                {s.strategies.map((st) => (
                  <button key={st.id} className="btn tiny" title={st.label} onClick={() => loadScenario(s.id, st.id)}>
                    {st.id}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <button className="btn primary" onClick={exportJsonl}>
            Export JSONL ({records.length})
          </button>
        </div>
      )}
      {tab === 'agent' && (
        <div className="console-body">
          <div className="scn-h">Rules · preference memory</div>
          <table className="rules">
            <tbody>
              {RULES.map((r) => {
                const m = memory.rules[r.id];
                return (
                  <tr key={r.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={agent.rules.enabled.has(r.id)}
                        onChange={(e) => {
                          if (e.target.checked) agent.rules.enabled.add(r.id);
                          else agent.rules.enabled.delete(r.id);
                          force((x) => x + 1);
                        }}
                      />
                    </td>
                    <td>
                      <b>{r.label}</b>
                      <small>{r.technique}</small>
                    </td>
                    <td className="num">✓{m?.accepts ?? 0}</td>
                    <td className="num">½{m?.partials ?? 0}</td>
                    <td className="num">✕{m?.rejects ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="scn-h">Decisions</div>
          <div className="hist">
            {history.slice(0, 12).map((h) => (
              <div key={h.id}>
                <span className={`st ${h.status}`}>{h.status}</span> {h.title}
              </div>
            ))}
          </div>
          <button
            className="btn"
            onClick={() => {
              const obs = agent.observation();
              navigator.clipboard?.writeText(JSON.stringify(observationToPrompt(obs), null, 2));
            }}
          >
            Copy observation JSON (LLM prompt)
          </button>
          <p className="muted">LLM endpoint: {agent.llm.available ? agent.llm.endpoint : 'not configured (set VITE_AGENT_ENDPOINT)'}</p>
        </div>
      )}
      {tab === 'log' && (
        <div className="console-body log">
          {records.slice(-160).reverse().map((r, i) => (
            <div key={i} className={`lr ${r.src}`}>
              <span className="lt">{(r.t / 1000).toFixed(1)}</span>
              <span className="ls">{r.src}</span>
              <span className="ly">{r.type}</span>
              <span className="ld">{r.windowId ?? ''} {r.data ? JSON.stringify(r.data).slice(0, 90) : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
