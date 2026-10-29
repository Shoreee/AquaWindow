import {credentialState} from '../agent/adaptive/credentials';
import { memo, useEffect, useRef, useState } from "react";
import { AppIcon } from "../apps/icons";
import { APPS } from "../apps/registry";
import { PAPERS } from "../apps/data/papers";
import { defaultImportance } from "../apps/importance";
import { adaptation, serviceStore, setDeepSeekEnabled, setDeepSeekApiKey } from "../agent/adaptive/runtime";
import { statusMessages } from "../agent/adaptive/buffer";
import { useStore } from "../system/createStore";
import { kernel, ui, undo, useKernelState, workArea } from "./hooks";
import { openApp } from "./Chrome";
import { BASELINE } from "../techniques/techniques";
import { bounded } from "../agent/adaptive/compiler";

export function bootDesktop() {
  adaptation.cancel();
  kernel.closeAll();
  ui.set({
    scenarioId: null,
    strategyId: null,
    scenarioPanel: false,
    agentEnabled: false,
    autonomy: "off",
    tech: {
      ...BASELINE,
      shape: "squircle",
      depth: true,
      snap: true,
      periphery: true,
      semanticFiles: true,
      provenance: true,
    },
  });
  const W = workArea();
  const open = (
    appId: string,
    title: string,
    x: number,
    y: number,
    w: number,
    h: number,
    props: Record<string, unknown>,
  ) =>
    kernel.open(
      {
        appId,
        title,
        role:
          appId === "writer"
            ? "primary"
            : appId === "preview"
              ? "reference"
              : "tool",
        rect: bounded(
          {
            x: W.x + W.w * x,
            y: W.y + W.h * y,
            w: Math.min(w, W.w * 0.6),
            h: Math.min(h, W.h * 0.86),
          },
          W,
        ),
        props,
        importance: defaultImportance(appId),
        focus: false,
      },
      "system",
    );
  open("finder", "研究资料", 0.035, 0.46, 550, 350, { path: "Downloads" });
  open("preview", PAPERS[0].title, 0.1, 0.035, 580, 650, {
    paperId: PAPERS[0].id,
  });
  const note = open("writer", "窗口协作 · 研究笔记", 0.54, 0.11, 550, 610, {
    docId: "draft",
  });
  kernel.focus(note, "system");
}

function SystemMenuBarImpl() {
  // Subscribe to menu semantics, not every animation rectangle.
  useKernelState(s=>JSON.stringify([s.focusedId,...s.order.map(id=>[id,s.windows[id].appId,s.windows[id].title])]));
  const state=kernel.getState();
  const status = useStore(serviceStore, (s) => s.status);
  const remoteEnabled = useStore(serviceStore, (s) => s.remoteEnabled);
  const hasKey=useStore(credentialState,s=>s.hasKey);
  const [apiDraft,setApiDraft]=useState('');
  const phase = useStore(adaptation.store, (s) => s.phase);
  const [menu, setMenu] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const fn = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setMenu(null);
    };
    window.addEventListener("pointerdown", fn);
    return () => window.removeEventListener("pointerdown", fn);
  }, []);
  useEffect(()=>{if(menu!=='system')setApiDraft('');},[menu]);
  const focused = state.windows[state.focusedId ?? ""];
  const action = (fn: () => void) => () => {
    fn();
    setMenu(null);
  };
  return (
    <div className="menubar system-menubar" ref={ref}>
      <button
        className="system-brand"
        onClick={() => setMenu(menu === "system" ? null : "system")}
      >
        <span className="system-mark" />
        AquaWindow
      </button>
      <span className="system-app">
        {focused ? APPS[focused.appId]?.name : "桌面"}
      </span>
      <button
        className="mb-item"
        onClick={() => setMenu(menu === "windows" ? null : "windows")}
      >
        窗口
      </button>
      <button
        className="mb-item"
        onClick={() => setMenu(menu === "edit" ? null : "edit")}
      >
        编辑
      </button>
      <div className="mb-spacer" />
      <span
        className={`agent-service ${status === "ready" || status === "local" ? "ready" : ""}`}
        title={statusMessages[status]}
      >
        <i />
        {phase !== "idle"
          ? "正在协作"
          : !remoteEnabled
            ? "本地规则"
          : status === "ready"
            ? "随时就绪"
            : status === "thinking" || status === "warming"
              ? "感知中"
              : "连接待就绪"}
      </span>
      <span className="system-date">
        {now.toLocaleString("zh-CN", {
          timeZone: "Asia/Shanghai",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })}
      </span>
      {menu && (
        <div className={`mb-drop system-drop ${menu}`}>
          {menu === "system" && (
            <>
              <div className="system-about">
                <span className="system-mark" />
                <b>AquaWindow</b>
                <small>随思绪流动的工作空间</small>
              </div>
              <button role="switch" aria-checked={remoteEnabled} aria-label="接入 DeepSeek" onClick={action(() => setDeepSeekEnabled(!remoteEnabled))}>
                接入 DeepSeek <span className={`deepseek-toggle ${remoteEnabled ? "on" : ""}`} aria-hidden="true"><i /></span>
              </button>
              <div className="system-connection">{remoteEnabled ? "已允许 DeepSeek 生成方案" : "已关闭 · 本地规则演示，不消耗模型 token"}</div>
              <form className="deepseek-key-form" onSubmit={e=>{e.preventDefault();if(apiDraft.trim()){setDeepSeekApiKey(apiDraft);setApiDraft('');}}}>
                <label htmlFor="deepseek-api-key">DeepSeek API Key</label>
                <input id="deepseek-api-key" type="password" value={apiDraft} onChange={e=>setApiDraft(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder={hasKey?'已填写 · 可输入新 Key 替换':'输入你的 API Key'}/>
                <div className="deepseek-key-actions"><button type="submit" disabled={!apiDraft.trim()}>保存 Key</button>{hasKey&&<button type="button" onClick={()=>{setDeepSeekApiKey('');setApiDraft('');}}>清除 Key</button>}</div>
                <small>{hasKey?'Key 仅保留在当前页面，刷新即清空。':'仅保存在当前页面；保存后仍需开启接入。'}</small>
              </form>
              <div className="mb-sep" />
              <button onClick={action(bootDesktop)}>重新整理桌面</button>
              <div className="system-connection">{statusMessages[status]}</div>
            </>
          )}
          {menu === "windows" && (
            <>
              <button onClick={action(() => ui.set({ missionControl: true }))}>
                所有窗口 <kbd>F3</kbd>
              </button>
              <button
                disabled={!focused}
                onClick={action(() => focused && kernel.minimize(focused.id))}
              >
                最小化当前窗口
              </button>
              <button
                disabled={!focused}
                onClick={action(
                  () =>
                    focused && kernel.toggleMaximize(focused.id, workArea()),
                )}
              >
                缩放当前窗口
              </button>
              <div className="mb-sep" />
              {state.order.map((id) => (
                <button key={id} onClick={action(() => kernel.restore(id))}>
                  {state.focusedId === id ? "✓ " : ""}
                  {state.windows[id].title}
                </button>
              ))}
            </>
          )}
          {menu === "edit" && (
            <>
              <button disabled={!kernel.canUndo()} onClick={action(undo)}>
                撤销布局 <kbd>⌘ Z</kbd>
              </button>
              <div className="system-connection">
                长按空格唤出 · 松手停留
                <br />
                长按空格探索 · ← → 选择 · 松开采用 · Esc 撤回
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SystemDockImpl() {
  const apps = ["finder", "preview", "writer"];
  const running = useKernelState(s=>apps.reduce((bits,id,i)=>Object.values(s.windows).some(w=>w.appId===id&&!w.minimized)?bits|(1<<i):bits,0));
  return (
    <div className="dock-wrap">
      <div className="dock system-dock">
        {apps.map((id,index) => (
          <button
            className="dock-i"
            key={id}
            onClick={() => openApp(id)}
            aria-label={`打开${APPS[id].name}`}
          >
            <span className="dock-tip">
              {id === "finder" ? "文件" : id === "preview" ? "论文" : "笔记"}
            </span>
            <span className="dock-img">
              <AppIcon appId={id} size={45} />
            </span>
            {(running & (1<<index))!==0 && <span className="dock-dot" />}
          </button>
        ))}
        <span className="dock-sep" />
        <button
          className="dock-i dock-overview"
          title="所有窗口"
          aria-label="所有窗口"
          onClick={() => ui.set({ missionControl: true })}
        >
          <span />
          <span />
          <span />
          <span />
        </button>
      </div>
    </div>
  );
}

export const SystemMenuBar=memo(SystemMenuBarImpl);
export const SystemDock=memo(SystemDockImpl);
