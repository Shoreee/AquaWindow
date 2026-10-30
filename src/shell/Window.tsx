import {WindowMenu} from './WindowMenu';
import {useStore} from '../system/createStore';
import {DockedCapsules} from './DockedCapsules';
import {dockParent} from '../agent/adaptive/capsuleTree';
import {NativeBondSkin} from './NativeBondSkin';
import {cancelSurfaceInteraction,fuseSurfaces,previewSurfaceFusion,surfaceUi} from './surfaceFusion';
import {attachedResize,isSurfaceGroup,surfaceBonds,surfaceComponent} from './surfaceBondGeometry';
import {TransportSkin} from './TransportSkin';
import {cancelCapsuleMotion,packWindows,previewCapsuleDrop,finishCapsuleDrop,capsuleDropUi} from "../agent/adaptive/capsule";
import {beginWindowMotion,cancelManualWindowMotion,maximizeWithMotion} from "../agent/adaptive/manualMotion";
import { ease as motionEase } from "../agent/adaptive/choreography";
import type { AgentMotion } from "../agent/adaptive/choreography";
import { createPortal } from 'react-dom';
import { memo, useCallback, useMemo, useEffect, useRef, useState, type PointerEvent as RPE } from 'react';
import {RevealSurface,type RevealClosure} from "./RevealSurface";
import {AppSurface} from "./AppSurface";
import { sameAppContent } from "./appContent";
import { APPS } from '../apps/registry';
import { AppIcon } from '../apps/icons';
import type { Rect, WindowState } from '../kernel/types';
import { log } from '../study/logger';
import { kernel, ui, workArea } from '../system';
import { MENUBAR } from '../system/kernel';
import { depthStyle } from '../techniques/depth';
import { peelGeometry, polyCss, polySvg } from '../techniques/peel';
import type { Techniques } from '../techniques/techniques';
import { rerankTrail, scrubTrail } from '../techniques/trail';
import { capsuleRectFor, type WindowVisual } from '../techniques/visuals';
import { FluidBoundary, fluidGeometry } from "./FluidBoundary";
import { AgentAttachment, AgentAnchor, SessionCapsule } from './AgentAttachment';
import type { AgentView, CapsuleSnapshot } from '../agent/adaptive/types';
import { readingProgress } from '../apps/content';

type Pt = [number, number];

interface Props {
  win: WindowState;
  visual: WindowVisual;
  focused: boolean;
  tech: Techniques;
  xray: boolean;
  active: boolean;
  alert: boolean;
}


const Content = memo(
  function Content({ win, peripheral }: { win: WindowState; peripheral: boolean }) {
    const branch=win.props.agentBranch as {artifact:{title:string;body:string;sourceIds:string[]}}|undefined;
    if(branch){
      const payload=win.props.agentBranch as {artifact:{title:string;body:string;sourceIds:string[]};parentSnapshot?:WindowState};
      const division=win.props.agentDivision as {born:boolean;amount:number}|undefined;
      const result=division?(division.born?motionEase((division.amount-.55)/.45):1-motionEase((division.amount-.2)/.55)):1;
      const Origin=payload.parentSnapshot?APPS[payload.parentSnapshot.appId]?.Component:undefined;
      return <div className="agent-child-layers">
        {Origin&&payload.parentSnapshot&&<div className="agent-child-origin" style={{opacity:1-result,width:payload.parentSnapshot.rect.w,height:payload.parentSnapshot.rect.h}}><AppSurface win={payload.parentSnapshot} peripheral={false}/></div>}
        <article className="agent-child-content" style={{opacity:result}}><small>独立分支 · {branch.artifact.sourceIds.length} 处来源</small><h2>{branch.artifact.title}</h2><p>{branch.artifact.body}</p></article>
      </div>;
    }
    return <AppSurface win={win} peripheral={peripheral}/>;
  },
  (a,b)=>a.peripheral===b.peripheral && (a.win.props.agentBranch||b.win.props.agentBranch
    ? a.win.props===b.win.props && a.win.id===b.win.id
    : sameAppContent(a.win,b.win)),
);

const EDGES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const;

function snapTarget(x: number, y: number): Rect | null {
  const W = workArea();
  const { w } = kernel.getState().screen;
  if (x < 6) return { x: W.x, y: W.y, w: W.w / 2 - 4, h: W.h };
  if (x > w - 6) return { x: W.x + W.w / 2 + 4, y: W.y, w: W.w / 2 - 4, h: W.h };
  if (y < MENUBAR + 2) return W;
  return null;
}


function WindowImpl({ win, visual, focused, tech, xray, active, alert }: Props) {
  const fusionPending=useStore(surfaceUi,s=>s.candidate?.a===win.id||s.candidate?.b===win.id);
  const def = APPS[win.appId];
  const [menuAt,setMenuAt]=useState<{x:number;y:number}|null>(null);
  const closeMenu=useCallback(()=>setMenuAt(null),[]);
  const capsule = win.form === 'capsule';
  const rect = capsule ? capsuleRectFor(win, kernel.getState().screen) : win.rect;
  const [peel, setPeel] = useState<{ corner: Pt; p: Pt; pinned: boolean } | null>(null);
  const peelAnim = useRef(0);
  const peelRef = useRef(peel);
  peelRef.current = peel;
  const ghost = !!win.props.ghost;
  const agentView = win.props.agentView as AgentView | undefined;
  const sessionCapsule = win.props.agentCapsule as CapsuleSnapshot | undefined;
  const agentMotion = win.props.agentMotion as AgentMotion | undefined;
  const [agentExpanded, setAgentExpanded] = useState(false);
  const toggleAgent=useCallback(()=>setAgentExpanded(v=>!v),[]);
  const shellRef=useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setAgentExpanded(!!agentView?.revealed); }, [agentView?.planId, agentView?.revealed]);
  useEffect(() => { if (contentRef.current && typeof win.props.restoreScroll === 'number') { const pane = contentRef.current.querySelector<HTMLElement>('.writer-page,.finder-list,.pv') ?? contentRef.current; pane.scrollTop = win.props.restoreScroll; } }, [win.props.restoreToken, win.props.restoreScroll]);
  const revealed = !!agentView?.revealed && agentExpanded && Number(win.props.agentRevealExit??1)>.0001;
  const revealProgress = revealed ? Number(win.props.agentRevealProgress ?? ((agentMotion?.primitive === "peel" || agentMotion?.concurrent === "peel") ? motionEase((agentMotion.action-.12)/.88) : 1) * Number(win.props.agentRevealExit??1)) : 0;

  useEffect(() => () => cancelAnimationFrame(peelAnim.current), []);

  // ── focus / depth pull ────────────────────────────────────────────────────
  const onPointerDownCapture = (e: RPE) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest(".agent-anchor,[data-agent-result],[data-reveal-handle],[data-capsule-id]")) return;
    if (win.depth > 0.05 && !e.altKey) {
      if (win.group?.startsWith('trail')) rerankTrail(kernel, win.group, win.id, 'trail:pull');
      else {
        kernel.apply([{ windowId: win.id, depth: 0, focus: true }], 'user', 'depth:pull');
        log({ src: 'technique', type: 'depth', windowId: win.id, data: { op: 'pull-click' } });
      }
      return;
    }
    kernel.focus(win.id);
  };

  // ── move (group-aware) ────────────────────────────────────────────────────
  const startMove = (e: RPE) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button,input')) return;
    e.preventDefault();
    const sx = e.clientX;
    const sy = e.clientY;
    cancelSurfaceInteraction();
    const current=kernel.get(win.id)??win;
    let members = [current];
    if ((tech.fusion||isSurfaceGroup(current.group)) && current.group && !capsule) {
      if (e.shiftKey&&!isSurfaceGroup(current.group)) {
        kernel.setGroup(win.id, undefined);
        log({ src: 'technique', type: 'fusion', windowId: win.id, data: { op: 'detach' } });
      } else members = kernel.list().filter((w) => w.group === current.group && w.form === 'normal' && (isSurfaceGroup(current.group)||!w.minimized));
    }
    const starts = members.map((m) => ({ id: m.id, r: { ...m.rect } }));
    const cap0 = { ...rect };
    cancelCapsuleMotion();cancelManualWindowMotion();
    kernel.beginGesture('move');
    const material=!capsule?beginWindowMotion(starts.map(s=>s.id),'move',{x:e.clientX,y:e.clientY},true):null;
    ui.set({ activeId: win.id });
    let snap: Rect | null = null;
    const move = (ev: PointerEvent) => {
      if(material?.stopped)return;
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      if (capsule) {
    if(dockParent(win)&&kernel.get(dockParent(win)!))return null;
        kernel.setCapsuleRect(win.id, { ...cap0, x: cap0.x + dx, y: Math.max(MENUBAR, cap0.y + dy) });
        return;
      }
      for (const s of starts) material?.update(s.id, { ...s.r, x: s.r.x + dx, y: Math.max(MENUBAR, s.r.y + dy) });
      previewCapsuleDrop(starts.map(s=>s.id),ev.clientX,ev.clientY);
      if(members.length===1&&!capsuleDropUi.get().target)previewSurfaceFusion(win.id);else previewSurfaceFusion(null);
      if (tech.snap && members.length === 1) {
        snap = snapTarget(ev.clientX, ev.clientY);
        ui.set({ snapPreview: snap });
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('blur',up);
      if(material?.stopped){previewCapsuleDrop([]);previewSurfaceFusion(null);ui.set({activeId:null,snapPreview:null});return;}
      if (snap){if(material)material.update(win.id,snap);else kernel.setRect(win.id, snap, 'user', 'snap');}
      const drop=capsuleDropUi.get().target;previewCapsuleDrop([]);
      const fusion=surfaceUi.get().candidate;
      if(material&&drop){material.handoff();previewSurfaceFusion(null);finishCapsuleDrop(starts.map(s=>s.id),drop,true);}
      else if(material&&fusion?.a===win.id&&!snap){material.handoff();fuseSurfaces(win.id,fusion.b,true);}else{previewSurfaceFusion(null);if(material)material.finish();else kernel.endGesture();}
      ui.set({ activeId: null, snapPreview: null });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('blur',up);
  };

  // ── resize ────────────────────────────────────────────────────────────────
  const startResize = (edge: (typeof EDGES)[number]) => (e: RPE) => {
    e.stopPropagation();
    e.preventDefault();
    kernel.focus(win.id);
    const sx = e.clientX;
    const sy = e.clientY;
    const minW=64;
    const minH=42;
    cancelSurfaceInteraction();cancelCapsuleMotion();cancelManualWindowMotion();
    const r0={...(kernel.get(win.id)??win).rect};
    kernel.beginGesture('resize');
    const resizeBase=kernel.getState(),resizeIds=isSurfaceGroup(win.group)?surfaceComponent(resizeBase,win.id):[win.id];
    const material=beginWindowMotion(resizeIds,'resize',{x:e.clientX,y:e.clientY},true);
    ui.set({ activeId: win.id });
    const move = (ev: PointerEvent) => {
      if(material?.stopped)return;
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      const r = { ...r0 };
      if (edge.includes('e')) r.w = Math.max(minW, r0.w + dx);
      if (edge.includes('s')) r.h = Math.max(minH, r0.h + dy);
      if (edge.includes('w')) {
        r.w = Math.max(minW, r0.w - dx);
        r.x = r0.x + r0.w - r.w;
      }
      if (edge.includes('n')) {
        r.h = Math.max(minH, r0.h - dy);
        r.y = Math.max(MENUBAR, r0.y + r0.h - r.h);
      }
      for(const [id,rect] of attachedResize(resizeBase,win.id,r))material.update(id,rect);
      kernel.setProps(win.id,{agentCollapsePreview:r.w<160&&r.h<110});
      previewCapsuleDrop(resizeIds,ev.clientX,ev.clientY);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('blur',up);
      if(material.stopped){previewCapsuleDrop([]);ui.set({activeId:null});return;}
      const current=kernel.get(win.id),drop=capsuleDropUi.get().target;previewCapsuleDrop([]);
      if(drop){material.handoff();kernel.setProps(win.id,{agentCollapsePreview:undefined});finishCapsuleDrop(resizeIds,drop,true);}
      else if(current&&current.rect.w<160&&current.rect.h<110){material.handoff();kernel.setProps(win.id,{agentCollapsePreview:undefined});packWindows(resizeIds,true,resizeBase);}
      else {kernel.setProps(win.id,{agentCollapsePreview:undefined});material.finish();}
      ui.set({ activeId: null });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('blur',up);
  };

  // ── peel ─────────────────────────────────────────────────────────────────
  const localPt = (cx: number, cy: number): Pt => {
    const s = visual.depthT.s;
    return [(cx - visual.vis.x) / s, (cy - visual.vis.y) / s];
  };
  const startPeel = (corner: Pt) => (e: RPE) => {
    e.stopPropagation();
    e.preventDefault();
    cancelAnimationFrame(peelAnim.current);
    kernel.focus(win.id);
    log({ src: 'technique', type: 'peel', windowId: win.id });
    setPeel({ corner, p: localPt(e.clientX, e.clientY), pinned: false });
    const move = (ev: PointerEvent) => setPeel((pp) => (pp ? { ...pp, p: localPt(ev.clientX, ev.clientY) } : pp));
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (ev.shiftKey) setPeel((pp) => (pp ? { ...pp, pinned: true } : pp));
      else springBack();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const springBack = () => {
    const start = peelRef.current;
    if (!start) return;
    const t0 = performance.now();
    const from = start.p;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 280);
      const k = 1 - Math.pow(1 - t, 3);
      if (t >= 1) return setPeel(null);
      setPeel({ ...start, pinned: false, p: [from[0] + (start.corner[0] - from[0]) * k, from[1] + (start.corner[1] - from[1]) * k] });
      peelAnim.current = requestAnimationFrame(step);
    };
    peelAnim.current = requestAnimationFrame(step);
  };
  const onAltCorner = (e: RPE) => {
    if (!tech.peel || !e.altKey || capsule) return;
    const [lx, ly] = localPt(e.clientX, e.clientY);
    const corners: Pt[] = [
      [0, 0],
      [win.rect.w, 0],
      [win.rect.w, win.rect.h],
      [0, win.rect.h],
    ];
    const c = corners.find((q) => Math.hypot(q[0] - lx, q[1] - ly) < 110);
    if (c) startPeel(c)(e);
  };

  const pg = peel ? peelGeometry(win.rect.w, win.rect.h, peel.corner, peel.p) : null;

  // ── wheel depth ───────────────────────────────────────────────────────────
  const onWheel = (e: React.WheelEvent) => {
    if (!tech.depth || !e.altKey) return;
    const dir = (e.deltaY || e.deltaX) > 0 ? 1 : -1;
    if (win.group?.startsWith('trail')) {
      scrubTrail(kernel, win.group, dir as 1 | -1);
    } else {
      kernel.setDepth(win.id, win.depth + dir * 0.08);
    }
    log({ src: 'technique', type: 'depth', windowId: win.id, data: { op: 'wheel', dir } });
  };

  // ── styles ────────────────────────────────────────────────────────────────
  const { s, dx, dy } = visual.depthT;
  const ds = depthStyle(win.depth, xray);
  const clip = pg ? polyCss(pg.visible) : visual.clipPath;
  const outerStyle: React.CSSProperties = {
    left: rect.x,
    top: rect.y,
    width: rect.w,
    height: rect.h,
    zIndex: visual.zIndex,
    transform: `translate(${dx}px, ${dy}px) scale(${s})`,
    opacity: ghost ? 0.42 : ds.opacity,
    filter: ds.filter,
    ...(agentMotion||win.props.agentCapsuleBusy||win.props.surfaceAnimating ? { transition: 'none' } : {}),
    ['--r' as string]: `${visual.radius}px`,
  };
  const shellStyle: React.CSSProperties = visual.yieldScale
    ? { transform: `translate(${visual.yieldScale.dx}px, ${visual.yieldScale.dy}px) scale(${visual.yieldScale.s})`, transformOrigin: '0 0' }
    : {};
  const releasing=win.props.agentRelease as {amount:number}|undefined;
  if(releasing){const reveal=motionEase(releasing.amount/.55);outerStyle.opacity=Number(outerStyle.opacity)*reveal;outerStyle.clipPath=`inset(${(1-reveal)*42}% 0 round ${22+(1-reveal)*60}px)`;}
  const reentry=win.props.agentReentry as {amount:number;source?:CapsuleSnapshot;rect?:Rect}|undefined;
  if(reentry){const reveal=motionEase(reentry.amount/.5);outerStyle.opacity=Number(outerStyle.opacity)*reveal;outerStyle.clipPath=`inset(${(1-reveal)*45}% 0 round ${22+(1-reveal)*40}px)`;}
  const division=win.props.agentDivision as {born:boolean;absorbed:boolean;amount:number;sourceVisibility?:number}|undefined;
  if(division){
    const visibility=(division.born?motionEase((division.amount-.08)/.45):1-motionEase((division.amount-.52)/.46))*(division.sourceVisibility??1)*(win.props.agentMergeSeed?motionEase(division.amount/.16):1);
    outerStyle.opacity=Number(outerStyle.opacity)*visibility;
    // A soft neck opens the child content, and closes again during absorption.
    const branch=win.props.agentBranch as {parentId:string}|undefined;
    const parent=branch?kernel.get(branch.parentId):undefined;
    const attachedRight=parent?parent.rect.x+parent.rect.w*.5>rect.x+rect.w*.5:true;
    outerStyle.clipPath=`inset(0 ${attachedRight?0:(1-visibility)*100}% 0 ${attachedRight?(1-visibility)*100:0}% round ${22+(1-visibility)*60}px)`;
  }
  const queue=win.props.agentQueue as {amount:number;travel:number;index:number;waiting:boolean;mergedCount:number;incoming:number}|undefined;
  if(queue&&!capsule){
    const neck=motionEase((queue.travel-.40)/.60);
    outerStyle.clipPath=`inset(${neck*38}% ${neck*2}% round ${22+neck*90}px)`;
    outerStyle.opacity=Number(outerStyle.opacity)*(1-motionEase((queue.travel-.76)/.24));
  }
  const branchPayload=win.props.agentBranch as {parentSnapshot?:WindowState}|undefined;
  const titleMix=division?(division.born?motionEase((division.amount-.55)/.45):1-motionEase((division.amount-.2)/.55)):1;
  const deformation=fluidGeometry(rect.w,rect.h,agentMotion);
  if(deformation){
    shellStyle.clipPath=deformation.clipPath;
    outerStyle.boxShadow=focused?'0 24px 75px #344c7225,0 3px 10px #33496b0c':'0 18px 55px #344c7221,0 2px 7px #33496b0d';
    outerStyle.borderRadius=22;
  }
  const bodyStyle: React.CSSProperties = {
    clipPath: clip,
    WebkitMaskImage: visual.maskImage,
    maskImage: visual.maskImage,
    maskSize: '100% 100%',
    WebkitMaskSize: '100% 100%',
    maskMode: visual.maskImage ? 'luminance' : undefined,

  };

  const cls = [
    'aw-win',
    win.props.agentCollapsePreview?'aw-collapse-preview':'',
    focused ? 'focused' : '',
    active ? 'active' : '',
    clip ? 'clipped' : '',
    capsule ? 'capsule' : '',
    tech.shape === 'squircle' ? 'fluid' : '',
    win.depth > 0.05 ? 'deep' : '',
    ghost ? 'ghost' : '',
    visual.dented ? 'dented' : '',
    def?.bare ? 'bare' : '',
    alert ? 'alert' : '',
    win.group && (tech.fusion||isSurfaceGroup(win.group)) ? 'grouped' : '',
    agentView ? 'agent-attached' : '',
    revealed ? 'agent-revealed' : '',
  ].join(' ');

  const moveRef=useRef(startMove);moveRef.current=startMove;
  const resizeRef=useRef(startResize);resizeRef.current=startResize;
  const stableStartMove=useCallback((e:RPE)=>moveRef.current(e),[]);
  const resizeHandles=useMemo(()=>EDGES.map(edge=><div key={edge} className={`rz rz-${edge}`} onPointerDown={e=>resizeRef.current(edge)(e)}/>),[]);
  const titleBar=useMemo(()=>(
          <div className="aw-title" tabIndex={0} aria-label={`窗口标题栏：${win.title}`} onContextMenu={e=>{e.preventDefault();e.stopPropagation();setMenuAt({x:e.clientX,y:e.clientY});}} onKeyDown={e=>{if(e.shiftKey&&e.key==='F10'){e.preventDefault();const r=e.currentTarget.getBoundingClientRect();setMenuAt({x:r.x+80,y:r.y+25});}}} onPointerDown={stableStartMove} onDoubleClick={e => maximizeWithMotion(win.id, workArea(),{x:e.clientX,y:e.clientY})}>
            <div className="lights">
              <button className="l close" onClick={() => {cancelSurfaceInteraction();kernel.close(win.id);}} />
              <button className="l min" onClick={() => kernel.minimize(win.id)} />
              <button className="l max" onClick={e => maximizeWithMotion(win.id, workArea(),{x:e.clientX,y:e.clientY})} />
            </div>
            <div className="aw-title-text">
              <AppIcon appId={win.appId} size={14} />
              {branchPayload?.parentSnapshot?<span className="agent-title-layers"><span style={{opacity:'calc(1 - var(--agent-title-mix, 1))'}}>{branchPayload.parentSnapshot.title}</span><span style={{opacity:'var(--agent-title-mix, 1)'}}>{win.title}</span></span>:win.title}
            </div>
            <DockedCapsules parentId={win.id}/>
          </div>
  ),[win.id,win.appId,win.title,win.group,win.capsuleRect,tech,def?.peripheral,branchPayload?.parentSnapshot?.title,stableStartMove]);

  if (capsule) {
    if(dockParent(win)&&kernel.get(dockParent(win)!))return null;
    if (sessionCapsule) return <div className={`${cls} task-session`} style={outerStyle} data-win={win.id} data-agent-bond={win.props.agentBond ? String(win.props.agentBond) : undefined} data-agent-branch={win.props.agentBranch ? "true" : undefined} data-agent-motion={agentMotion?.primitive}><SessionCapsule id={win.id} snapshot={sessionCapsule} mergedCount={queue?.mergedCount} incoming={queue?.incoming}/></div>;
    return (
      <div className={cls} style={outerStyle} data-win={win.id} data-agent-bond={win.props.agentBond ? String(win.props.agentBond) : undefined} data-agent-branch={win.props.agentBranch ? "true" : undefined} data-agent-motion={agentMotion?.primitive} onPointerDownCapture={onPointerDownCapture} onWheel={onWheel}>
        <div className="aw-shell">
          <div className="aw-body" onPointerDown={startMove}>
            <div className="cap-head">
              <AppIcon appId={win.appId} size={16} />
              <span className="cap-title">{win.title}</span>
              <button className="tb-btn" title="Expand" onClick={() => kernel.setForm(win.id, 'normal')}>
                ⤢
              </button>
            </div>
            <div className="cap-content">
              <Content win={win} peripheral />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const receiver=queue?.index===0 && queue.amount>.64 && sessionCapsule && agentMotion ? createPortal(
    <div className="agent-queue-receiver task-session" style={{position:'fixed',left:agentMotion.to.x,top:agentMotion.to.y,width:agentMotion.to.w,height:agentMotion.to.h,zIndex:visual.zIndex,opacity:motionEase((queue.amount-.64)/.36),pointerEvents:'none'}} aria-hidden="true">
      <SessionCapsule id={win.id} snapshot={sessionCapsule} mergedCount={queue.mergedCount} incoming={queue.incoming}/>
    </div>,document.body):null;
  const capsuleGhost=reentry?.source&&reentry.rect&&reentry.amount<.65?createPortal(<div className="agent-queue-receiver task-session" style={{position:'fixed',left:reentry.rect.x,top:reentry.rect.y,width:reentry.rect.w,height:reentry.rect.h,zIndex:visual.zIndex,opacity:1-motionEase(reentry.amount/.4),pointerEvents:'none'}} aria-hidden="true"><SessionCapsule id={win.id} snapshot={reentry.source}/></div>,document.body):null;
  return (
    <>{menuAt&&<WindowMenu id={win.id} x={menuAt.x} y={menuAt.y} onClose={closeMenu}/>} {receiver}{capsuleGhost}<div className={cls} style={{ ...outerStyle, ['--agent-title-mix' as string]:titleMix, ['--agent-panel-w' as string]: `${Math.min(300, Math.max(180, win.rect.w * (agentView?.extent ?? .32)))}px`, ['--agent-reveal' as string]: revealProgress, ['--agent-peel-width' as string]: `${Math.min(300, Math.max(180, win.rect.w * (agentView?.extent ?? .32))) * revealProgress}px`, ['--agent-peel-height' as string]: `${win.rect.h * .45 * revealProgress}px` }} data-win={win.id} data-agent-bond={win.props.agentBond ? String(win.props.agentBond) : undefined} data-agent-branch={win.props.agentBranch ? "true" : undefined} data-agent-motion={agentMotion?.primitive} onPointerDownCapture={onPointerDownCapture} onPointerDown={onAltCorner} onWheel={onWheel}>
      {!!win.props.agentCollapsePreview&&<div className="collapse-hint">松开收为胶囊</div>}
      {!!win.props.agentBond && <div className="agent-bond-skin" aria-hidden="true" />}
      <div className="aw-shell" ref={shellRef} style={shellStyle} data-fluid-skin={deformation?"true":undefined}>
        {(deformation||surfaceBonds(win).length>0)&&!revealed&&!visual.maskImage&&!visual.dented&&<div className="agent-fluid-material" aria-hidden="true"/>}
        {agentView && !agentView.revealed && <AgentAttachment view={agentView} motion={agentMotion} expanded={revealed} onToggle={toggleAgent} />}
        <div className="aw-body" style={bodyStyle} ref={bodyRef}>
          {titleBar}
          <div className="aw-content" style={deformation?{transform:deformation.contentTransform,willChange:'transform'}:undefined} ref={contentRef} onScrollCapture={(e) => readingProgress.set(win.id, (e.target as HTMLElement).scrollTop)}>
            <Content win={win} peripheral={false} />
          </div>
        </div>
        {agentView?.revealed && <RevealSurface id={win.id} view={agentView} width={rect.w} height={rect.h} progress={revealProgress} closure={win.props.agentRevealClosure as RevealClosure|undefined} body={bodyRef} baseClip={clip}/>}
      </div>

      {(surfaceBonds(win).length>0||fusionPending)&&<NativeBondSkin win={win} shell={shellRef} geometry={deformation} baseClip={undefined}/>}
      <TransportSkin width={rect.w} height={rect.h} motion={agentMotion}/>
      {deformation&&<FluidBoundary geometry={deformation} material={false}/>}

      {agentView && !agentView.revealed && <AgentAnchor view={agentView} expanded={revealed} onToggle={toggleAgent} />}
      {visual.holes.map((h, i) => (
        <div
          key={i}
          className="cut-rim"
          style={{ left: h.rect.x, top: h.rect.y, width: h.rect.w, height: h.rect.h }}
          title="Click to bring this window forward"
          onPointerDown={(e) => {
            e.stopPropagation();
            kernel.focus(h.ownerId);
          }}
        >
          {h.label && <span>{h.label}</span>}
        </div>
      ))}

      {pg && (
        <svg className="peel-flap" width={win.rect.w} height={win.rect.h} onPointerDown={(e) => { if (peel?.pinned) { e.stopPropagation(); springBack(); } }}>
          <defs>
            <linearGradient id={`pf-${win.id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f4f6fb" />
              <stop offset="1" stopColor="#c9d0de" />
            </linearGradient>
          </defs>
          <polygon points={polySvg(pg.flap)} fill={`url(#pf-${win.id})`} stroke="rgba(0,0,0,.12)" style={{ pointerEvents: peel?.pinned ? 'auto' : 'none', cursor: 'pointer' }} />
          {pg.fold && <line x1={pg.fold[0][0]} y1={pg.fold[0][1]} x2={pg.fold[1][0]} y2={pg.fold[1][1]} stroke="rgba(255,255,255,.9)" strokeWidth="1.5" />}
        </svg>
      )}

      {tech.peel && !pg && (
        <>
          <div className="dog-ear br" onPointerDown={startPeel([win.rect.w, win.rect.h])} title="Peel back" />
          <div className="dog-ear bl" onPointerDown={startPeel([0, win.rect.h])} title="Peel back" />
        </>
      )}

      {!pg && resizeHandles}
    </div></>
  );
}

export const Window = memo(WindowImpl);
