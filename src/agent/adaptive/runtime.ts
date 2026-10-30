import {cancelSurfaceInteraction,surfaceBusy} from '../../shell/surfaceFusion';
import {getSessionKey,setSessionKey} from './credentials';
import {cancelManualWindowMotion,manualWindowMotionActive} from "./manualMotion";
import {previewCapsuleDrop,cancelCapsuleMotion,capsuleMotionActive,capsuleRectInside} from "./capsule";
import { kernel, workArea } from "../../system/kernel";
import { bus } from "../../system/bus";
import { createStore } from "../../system/createStore";
import { toast, ui } from "../../system/ui";
import { log } from "../../study/logger";
import { bounded } from "./compiler";
import { CandidateBuffer, type ServiceStatus } from "./buffer";
import { makeContext } from "./context";
import { AdaptationSession } from "./session";
import type { AgentContext } from "./types";

export const pointer = {
  x: typeof window === "undefined" ? 0 : window.innerWidth / 2,
  y: typeof window === "undefined" ? 0 : window.innerHeight / 2,
  visible: false,
  kind: "arrow" as "arrow" | "text" | "pointer" | "ew" | "ns" | "nwse" | "nesw",
  injection: { x: 0, y: 0, target: "", at: -10000 },
};
export const serviceStore = createStore<{
  status: ServiceStatus;
  configured: boolean;
  model: string;
  remoteEnabled: boolean;
}>({ status: "local", configured: false, model: "", remoteEnabled: false });
const feedback: AgentContext["feedback"] = { accepted: [], rejected: [] };
export const planBuffer = new CandidateBuffer();
planBuffer.onChange = () => serviceStore.set({ status: planBuffer.status, remoteEnabled: planBuffer.remoteEnabled });
const context = (selected: string[]) =>
  makeContext(kernel.getState(), workArea(), selected, bus.recent, feedback);
export const adaptation = new AdaptationSession({
  kernel,
  context,
  plans: (ctx) => planBuffer.get(ctx),
  request: (ctx) => planBuffer.request(ctx, true),
  feedback: (plan, accepted) => {
    const list = accepted ? feedback.accepted : feedback.rejected;
    list.push(plan.title);
    if (list.length > 5) list.shift();
    log({
      src: "agent",
      type: accepted ? "adaptation.accept" : "adaptation.reject",
      data: { planId: plan.id, primitives: plan.steps.map((s) => s.type) },
    });
  },
  reducedMotion: () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  notify: (message) => toast(message, message.startsWith("已采用")),
});

/** Explicit, session-only opt-in. Disabling also discards queued and in-flight model responses. */
export function setDeepSeekEnabled(enabled: boolean) {
  adaptation.cancel(true);
  planBuffer.setRemoteEnabled(enabled);
  const ctx = context([]);
  planBuffer.request(ctx, true);
  if(enabled&&getSessionKey()){serviceStore.set({configured:true,model:'deepseek-flash'});return;}
  if (enabled) void fetch("/api/agent/status")
    .then((response) => response.json())
    .then((data) => {
      if (planBuffer.remoteEnabled) serviceStore.set({ configured: !!data.configured, model: String(data.model ?? ""), ...(!data.configured ? { status: "unconfigured" as const } : {}) });
    })
    .catch(() => { if (planBuffer.remoteEnabled) serviceStore.set({ status: "offline" }); });
}

export function setDeepSeekApiKey(value:string){
 setDeepSeekEnabled(false);setSessionKey(value);serviceStore.set({configured:!!value.trim(),model:value.trim()?'deepseek-flash':''});
 toast(value.trim()?'Key 已保存到本次页面；开启 DeepSeek 后才会接入':'已清除本次页面的 Key');
}

export {restoreCapsule} from './capsule';

export function startAdaptiveRuntime() {
  planBuffer.start();
  let key = "";
  const tick = () => {
    if (document.hidden) return;
    if (!adaptation.active&&!capsuleMotionActive()&&!manualWindowMotionActive()&&!surfaceBusy()) {
      const ctx = context([]);
      if (ctx.key !== key) {
        key = ctx.key;
        planBuffer.request(ctx);
      }
    }
    planBuffer.tick();
  };
  const background = window.setInterval(tick, 500);
  let gesture = 0;
  const animateGesture = () => {
    if (adaptation.active && !document.hidden) adaptation.advance();
    gesture = requestAnimationFrame(animateGesture);
  };
  gesture = requestAnimationFrame(animateGesture);
  const off = kernel.onEvent((e) => {
    if (e.actor === "user" && e.type === "focus")
      bus.emit({ type: "window.focus", windowId: e.windowId });
    if (adaptation.active && ["close", "open", "reset"].includes(e.type))
      adaptation.invalidate();
  });
  const editable = (target: EventTarget | null) =>
    target instanceof HTMLElement &&
    !!target.closest(
      'input,textarea,select,[contenteditable="true"],[role="textbox"]',
    );
  const down = (e: KeyboardEvent) => {
    if(e.key==='Escape'&&document.querySelector('.window-context-menu'))return;
    if((e.key==='Escape'||(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z')&&cancelSurfaceInteraction()){e.preventDefault();e.stopImmediatePropagation();return;}
    if(e.key==='Escape'&&manualWindowMotionActive()){cancelManualWindowMotion();previewCapsuleDrop([]);if(kernel.canUndo())kernel.undo('user');e.preventDefault();e.stopImmediatePropagation();return;}
    if(e.key==='Escape'&&cancelCapsuleMotion()){e.preventDefault();e.stopImmediatePropagation();return;}
    if(e.key==='Escape'&&!adaptation.active&&!editable(e.target)&&kernel.canUndo()){
      e.preventDefault();e.stopImmediatePropagation();kernel.undo('user');return;
    }
    if(adaptation.active&&['ArrowLeft','ArrowRight'].includes(e.key)){
      e.preventDefault();e.stopImmediatePropagation();adaptation.navigate(e.key==='ArrowLeft'?-1:1);return;
    }
    if (e.key === "Escape" && adaptation.active) {
      e.preventDefault();
      e.stopImmediatePropagation();
      adaptation.cancel();
      return;
    }
    if (
      adaptation.active &&
      (e.key === "F3" ||
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z"))
    ) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (
      e.code !== "Space" ||
      e.isComposing ||
      (!adaptation.active &&
        (editable(e.target) ||
          e.metaKey ||
          e.altKey ||
          e.ctrlKey ||
          ui.get().missionControl))
    )
      return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if(capsuleMotionActive()||manualWindowMotionActive()||surfaceBusy())return;
    if (!e.repeat) adaptation.press();
  };
  const up = (e: KeyboardEvent) => {
    if (e.code === "Space" && adaptation.active) {
      e.preventDefault();
      e.stopImmediatePropagation();
      adaptation.release();
    }
  };
  const capture = (e: PointerEvent | MouseEvent) => {
    if (!adaptation.active || e.button !== 0) return;
    if((e.target as HTMLElement).closest('.agent-candidate-tabs'))return;
    if((e.target as HTMLElement).closest('.toast button')){if(e.type==='click')adaptation.cancel();e.preventDefault();e.stopImmediatePropagation();return;}
    const phase = adaptation.store.get().phase;
    if(e.type==='pointerdown'&&['charging','hatching','waiting'].includes(phase)){
      const id=(e.target as HTMLElement).closest<HTMLElement>('[data-win]')?.dataset.win;
      if(id&&kernel.get(id)?.form==='normal'){
        adaptation.select(id);
        pointer.injection={x:e.clientX,y:e.clientY,target:id,at:performance.now()};
      }
    }
    if (phase === "frozen" && !adaptation.store.get().performing &&
      (e.target as HTMLElement).closest(".agent-anchor,[data-agent-result]")) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  const move = (e: PointerEvent) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.visible = e.pointerType !== "touch";
    const target = e.target as HTMLElement;
    if (target.closest('input,textarea,[contenteditable="true"]'))
      pointer.kind = "text";
    else if (target.closest(".rz-e,.rz-w")) pointer.kind = "ew";
    else if (target.closest(".rz-n,.rz-s")) pointer.kind = "ns";
    else if (target.closest(".rz-nw,.rz-se")) pointer.kind = "nwse";
    else if (target.closest(".rz-ne,.rz-sw")) pointer.kind = "nesw";
    else
      pointer.kind = target.closest('button,a,[role="button"],.finder-row')
        ? "pointer"
        : "arrow";
  };
  const leave = () => {
    pointer.visible = false;
  };
  const cancel = () => {
    cancelManualWindowMotion();adaptation.cancel(true);
    pointer.visible = false;
  };
  const visibility = () => {
    if (document.hidden) cancel();
  };
  const resize = () => {
    cancelManualWindowMotion();cancelCapsuleMotion();adaptation.cancel(true);
    kernel.setScreen(innerWidth, innerHeight);
    const state = kernel.getState(),
      work = workArea();
    kernel.previewState({
      ...state,
      windows: Object.fromEntries(
        Object.entries(state.windows).map(([id, w]) => [
          id,
          { ...w, rect: bounded(w.rect, work),...(w.capsuleRect?{capsuleRect:capsuleRectInside(w.capsuleRect)}:{}) },
        ]),
      ),
    });
  };
  window.addEventListener("keydown", down, true);
  window.addEventListener("keyup", up, true);
  for (const event of [
    "pointerdown",
    "pointerup",
    "click",
    "dblclick",
  ] as const)
    window.addEventListener(event, capture, true);
  window.addEventListener("pointermove", move, true);
  document.addEventListener("pointerleave", leave);
  window.addEventListener("blur", cancel);
  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("resize", resize);
  tick();
  return () => {
    clearInterval(background);
    cancelAnimationFrame(gesture);
    off();
    planBuffer.stop();
    adaptation.cancel();
    window.removeEventListener("keydown", down, true);
    window.removeEventListener("keyup", up, true);
    for (const event of [
      "pointerdown",
      "pointerup",
      "click",
      "dblclick",
    ] as const)
      window.removeEventListener(event, capture, true);
    window.removeEventListener("pointermove", move, true);
    document.removeEventListener("pointerleave", leave);
    window.removeEventListener("blur", cancel);
    document.removeEventListener("visibilitychange", visibility);
    window.removeEventListener("resize", resize);
  };
}
