import {LiquidBoundary} from './LiquidBoundary';
import {LiquidPeel} from './LiquidPeel';
import {pointer} from '../agent/adaptive/runtime';
import {DesktopAppIcon} from './DesktopAppIcon';
import {WindowMenu} from './WindowMenu';
import {useStore} from '../system/createStore';
import {DockedCapsules} from './DockedCapsules';
import {dockParent} from '../agent/adaptive/capsuleTree';
import {NativeBondSkin} from './NativeBondSkin';
import {beginSurfaceSplit,cancelSurfaceInteraction,fuseSurfaces,previewSurfaceFusion,shakeApart,surfaceUi} from './surfaceFusion';
import {attachedResize,isSurfaceGroup,seamGeometry,surfaceBonds,surfaceComponent} from './surfaceBondGeometry';
import {TransportSkin} from './TransportSkin';
import {cancelCapsuleMotion,packWindows,previewCapsuleDrop,finishCapsuleDrop,capsuleDropUi,manualCapsuleWorkArea} from "../agent/adaptive/capsule";
import {capsuleSize} from '../agent/adaptive/capsuleGeometry';
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
import type { Techniques } from '../techniques/techniques';
import { rerankTrail, scrubTrail } from '../techniques/trail';
import { capsuleRectFor, type WindowVisual } from '../techniques/visuals';
import { FluidBoundary, fluidGeometry } from "./FluidBoundary";
import { AgentAttachment, AgentAnchor, SessionCapsule } from './AgentAttachment';
import type { AgentView, CapsuleSnapshot } from '../agent/adaptive/types';
import { readingProgress } from '../apps/content';


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
  const edge = 24;
  if (x <= edge) return { x: W.x, y: W.y, w: W.w / 2 - 4, h: W.h };
  if (x >= w - edge) return { x: W.x + W.w / 2 + 4, y: W.y, w: W.w / 2 - 4, h: W.h };
  if (y < MENUBAR + 2) return W;
  return null;
}


function WindowImpl({ win, visual, focused, tech, xray, active, alert }: Props) {
  const studyMode=useStore(ui,s=>s.studyMode);
  const studyDesktop=useStore(ui,s=>s.experimentOpen);
  const canCapsule=!studyDesktop||studyMode==='capsule';
  const canFusion=!studyDesktop||studyMode==='fusion';
  const canShake=!studyDesktop||studyMode==='fusion';
  const def = APPS[win.appId];
  const [menuAt,setMenuAt]=useState<{x:number;y:number}|null>(null);
  const closeMenu=useCallback(()=>setMenuAt(null),[]);
  const [marking,setMarking]=useState<false|'keep'|'hole'>(false);
  const [markRect,setMarkRect]=useState<Rect|null>(null);
  const [capsuleProposal,setCapsuleProposal]=useState(false);
  const capsule = win.form === 'capsule';
  const rect = capsule ? capsuleRectFor(win, kernel.getState().screen) : win.rect;
  const ghost = !!win.props.ghost;
  const agentView = win.props.agentView as AgentView | undefined;
  const sessionCapsule = win.props.agentCapsule as CapsuleSnapshot | undefined;
  const agentMotion = win.props.agentMotion as AgentMotion | undefined;
  const [agentExpanded, setAgentExpanded] = useState(false);
  const toggleAgent=useCallback(()=>setAgentExpanded(v=>!v),[]);
  const shellRef=useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!marking)return;
    const cancel=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.stopPropagation();setMarking(false);setMarkRect(null);}};
    window.addEventListener('keydown',cancel,true);
    return()=>window.removeEventListener('keydown',cancel,true);
  },[marking]);
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{
      if(kernel.getState().focusedId!==win.id||win.minimized||capsule||win.appId==='experiment')return;
      if(studyDesktop&&studyMode!=='reveal')return;
      if(event.repeat||event.ctrlKey||event.metaKey||event.key.toLowerCase()!=='s'||event.shiftKey===event.altKey)return;
      const target=event.target as HTMLElement|null;
      if(target?.isContentEditable||target?.closest('input,textarea,select,[contenteditable="true"]'))return;
      event.preventDefault();event.stopImmediatePropagation();setMarkRect(null);setMarking(event.altKey?'hole':'keep');
    };
    window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true);
  },[win.id,win.minimized,capsule,studyDesktop,studyMode]);
  const burstImportance=(regionId:string,element:HTMLElement,ownerId=win.id)=>{
    if(element.dataset.burst)return;
    element.dataset.burst='true';
    element.animate([{opacity:1,filter:'blur(0px)',transform:'scale(1)'},{opacity:0,filter:'blur(5px)',transform:'scale(1.1)'}],{duration:240,easing:'cubic-bezier(.16,1,.3,1)',fill:'forwards'}).finished.then(()=>{
      const owner=kernel.get(ownerId);if(!owner)return;
      kernel.beginGesture('importance:burst');kernel.setImportance(ownerId,owner.importance.filter(region=>region.id!==regionId));kernel.endGesture();
    });
  };
  const startImportance=(event:RPE<HTMLDivElement>)=>{
    if(event.button!==0||!contentRef.current)return;
    event.preventDefault();event.stopPropagation();
    const bounds=contentRef.current.getBoundingClientRect();
    const point=(x:number,y:number)=>({x:Math.max(0,Math.min(bounds.width,x-bounds.left)),y:Math.max(0,Math.min(bounds.height,y-bounds.top))});
    const start=point(event.clientX,event.clientY);
    const move=(e:PointerEvent)=>{const end=point(e.clientX,e.clientY);setMarkRect({x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),w:Math.abs(end.x-start.x),h:Math.abs(end.y-start.y)});};
    const up=(e:PointerEvent)=>{
      window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);
      const end=point(e.clientX,e.clientY),x=Math.min(start.x,end.x),y=Math.min(start.y,end.y),w=Math.abs(end.x-start.x),h=Math.abs(end.y-start.y);
      if(w>=24&&h>=24){
        kernel.beginGesture('importance:mark');
        kernel.setImportance(win.id,[...(kernel.get(win.id)?.importance??[]),{id:`marked:${Date.now()}`,x:x/bounds.width,y:y/bounds.height,w:w/bounds.width,h:h/bounds.height,weight:1,label:'',...(marking==='hole'?{kind:'hole' as const}:{})}]);
        kernel.endGesture();
        log({src:'technique',type:'cutout',windowId:win.id,data:{op:marking}});
      }
      setMarking(false);setMarkRect(null);
    };
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);
  };
  useEffect(() => { setAgentExpanded(!!agentView?.revealed); }, [agentView?.planId, agentView?.revealed]);
  useEffect(() => { if (contentRef.current && typeof win.props.restoreScroll === 'number') { const pane = contentRef.current.querySelector<HTMLElement>('.writer-page,.finder-list,.pv') ?? contentRef.current; pane.scrollTop = win.props.restoreScroll; } }, [win.props.restoreToken, win.props.restoreScroll]);
  const revealed = !!agentView?.revealed && agentExpanded && Number(win.props.agentRevealExit??1)>.0001;
  const revealProgress = revealed ? Number(win.props.agentRevealProgress ?? ((agentMotion?.primitive === "peel" || agentMotion?.concurrent === "peel") ? motionEase((agentMotion.action-.12)/.88) : 1) * Number(win.props.agentRevealExit??1)) : 0;


  // ── focus / depth pull ────────────────────────────────────────────────────
  const onPointerDownCapture = (e: RPE) => {
    if((e.target as HTMLElement).closest('.file-study-submit button,.file-study-compact'))return;
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

  const trySeam=(event:RPE)=>{
    const state=kernel.getState();
    for(const bond of surfaceBonds(state.windows[win.id])){
      const a=state.windows[bond.a],b=state.windows[bond.b];if(!a||!b)continue;
      const g=seamGeometry(a.rect,b.rect,bond.axis),normal=bond.axis==='x'?event.clientX:event.clientY,along=bond.axis==='x'?event.clientY:event.clientX;
      if(Math.abs(normal-(g.first+g.second)/2)<=18&&along>=g.lo-12&&along<=g.hi+12){event.preventDefault();event.stopPropagation();beginSurfaceSplit(bond,event.nativeEvent);return true;}
    }
    return false;
  };
  // ── move (group-aware) ────────────────────────────────────────────────────
  const startMove = (e: RPE) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button,input')) return;
    if(trySeam(e)||surfaceUi.get().split)return;
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
    let lastShakeX=sx,shakeDirection=0,shakeTurnX=sx,shakeTurns=0;
    const move = (ev: PointerEvent) => {
      if(material?.stopped)return;
      if(canShake&&members.length>1&&!capsule){
        const step=ev.clientX-lastShakeX,dir=Math.sign(step);
        if(Math.abs(step)>2&&dir){
          if(!shakeDirection)shakeDirection=dir;
          else if(dir!==shakeDirection&&Math.abs(lastShakeX-shakeTurnX)>40){shakeTurns++;shakeTurnX=lastShakeX;shakeDirection=dir;}
        }
        lastShakeX=ev.clientX;
        if(shakeTurns>=2){
          window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('blur',up);
          previewCapsuleDrop([]);previewSurfaceFusion(null);material?.handoff();shakeApart(win.id,true);
          ui.set({activeId:null,snapPreview:null});
          return;
        }
      }
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      if (capsule) {
    if(dockParent(win)&&kernel.get(dockParent(win)!))return null;
        kernel.setCapsuleRect(win.id, { ...cap0, x: cap0.x + dx, y: Math.max(MENUBAR, cap0.y + dy) });
        return;
      }
      for (const s of starts) material?.update(s.id, { ...s.r, x: s.r.x + dx, y: Math.max(MENUBAR, s.r.y + dy) });
      if(canCapsule)previewCapsuleDrop(starts.map(s=>s.id),ev.clientX,ev.clientY);
      if(members.length===1&&(!canCapsule||!capsuleDropUi.get().target)&&tech.fusion&&canFusion)previewSurfaceFusion(win.id,true);else previewSurfaceFusion(null);
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
      const drop=canCapsule?capsuleDropUi.get().target:null;previewCapsuleDrop([]);
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
    if(trySeam(e)||surfaceUi.get().split)return;
    pointer.kind=edge==='n'||edge==='s'?'ns':edge==='e'||edge==='w'?'ew':edge==='nw'||edge==='se'?'nwse':'nesw';
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
      kernel.setProps(win.id,{agentCollapsePreview:canCapsule&&r.w<160&&r.h<110});
      if(canCapsule)previewCapsuleDrop(resizeIds,ev.clientX,ev.clientY);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('blur',up);
      if(material.stopped){previewCapsuleDrop([]);ui.set({activeId:null});return;}
      const current=kernel.get(win.id),drop=canCapsule?capsuleDropUi.get().target:null;previewCapsuleDrop([]);
      if(drop){material.handoff();kernel.setProps(win.id,{agentCollapsePreview:undefined});finishCapsuleDrop(resizeIds,drop,true);}
      else if(canCapsule&&current&&current.rect.w<160&&current.rect.h<110){kernel.setProps(win.id,{agentCollapsePreview:undefined});material.finish();setCapsuleProposal(true);}
      else {kernel.setProps(win.id,{agentCollapsePreview:undefined});material.finish();}
      ui.set({ activeId: null });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('blur',up);
  };

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
  const clip = visual.clipPath;
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
          <div className="aw-title" tabIndex={0} aria-label={`窗口标题栏：${win.title}`} onContextMenu={e=>{e.preventDefault();e.stopPropagation();setMenuAt({x:e.clientX,y:e.clientY});}} onKeyDown={e=>{if(e.shiftKey&&e.key==='F10'){e.preventDefault();const r=e.currentTarget.getBoundingClientRect();setMenuAt({x:r.x+80,y:r.y+25});}}} onPointerDown={stableStartMove} onDoubleClick={e => {if(!(e.target as HTMLElement).closest('button'))maximizeWithMotion(win.id, workArea(),{x:e.clientX,y:e.clientY});}}>
            <div className="lights">
              <button aria-label="关闭" className="l close" onClick={() => {cancelSurfaceInteraction();kernel.close(win.id);}} />
              <button aria-label="最小化" className="l min" onClick={() => kernel.minimize(win.id)} />
              <button aria-label="最大化或还原" className="l max" onClick={e => maximizeWithMotion(win.id, workArea(),{x:e.clientX,y:e.clientY})} />
            </div>
            <div className="aw-title-text">
              {win.appId==='blank'?null:win.appId==='study'||win.appId==='experiment'||win.appId.startsWith('file-study')||win.appId==='finder'?<DesktopAppIcon id={win.appId==='experiment'||win.appId==='file-study-guide'?'experiment':win.appId==='finder'?'finder':win.appId.startsWith('file-study')?'gallery':({files:'finder',qa:'chat',notes:'writer',browser:'browser',gallery:'gallery'}[String(win.props.resource)]??'writer')}/>:<AppIcon appId={win.appId} size={16}/>}


              {branchPayload?.parentSnapshot?<span className="agent-title-layers"><span style={{opacity:'calc(1 - var(--agent-title-mix, 1))'}}>{branchPayload.parentSnapshot.title}</span><span style={{opacity:'var(--agent-title-mix, 1)'}}>{win.title}</span></span>:win.title}
            </div>
            <DockedCapsules parentId={win.id}/>
          </div>
  ),[win.id,win.appId,win.props.resource,win.title,win.group,win.capsuleRect,tech,def?.peripheral,branchPayload?.parentSnapshot?.title,stableStartMove]);

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
  const proposedCapsuleRect=capsuleProposal?(()=>{
    const size=capsuleSize(surfaceComponent(kernel.getState(),win.id).length),count=kernel.list().filter(item=>item.props.agentCapsule).length,area=manualCapsuleWorkArea();
    return {x:area.x+area.w-size.w-12,y:Math.min(area.y+area.h-size.h,area.y+16+count*126),...size};
  })():null;
  const proposal=capsuleProposal?createPortal(<div className="study-capsule-proposal" role="dialog" aria-label="胶囊布局预览" style={{left:Math.max(12,Math.min(innerWidth-270,rect.x+rect.w-240)),top:Math.max(MENUBAR+8,Math.min(innerHeight-156,rect.y+44))}}>
    <div className="study-capsule-ghost"><AppIcon appId={win.appId} size={16}/><span>{win.title}</span></div>
    <p>将这个窗口收为胶囊，保留返回入口。</p>
    <div><button onClick={()=>setCapsuleProposal(false)}>取消</button><button className="confirm" onClick={()=>{setCapsuleProposal(false);cancelManualWindowMotion();packWindows(surfaceComponent(kernel.getState(),win.id));}}>确认收纳</button></div>
  </div>,document.body):null;
  const proposalTarget=proposedCapsuleRect?createPortal(<div className="study-capsule-target" style={{left:proposedCapsuleRect.x,top:proposedCapsuleRect.y,width:proposedCapsuleRect.w,height:proposedCapsuleRect.h}} aria-hidden="true"><AppIcon appId={win.appId} size={17}/><span>{win.title}</span></div>,document.body):null;
  return (
    <>{menuAt&&<WindowMenu id={win.id} x={menuAt.x} y={menuAt.y} onClose={closeMenu} onMarkImportance={()=>setMarking('keep')} onCutHole={()=>setMarking('hole')} onPreviewCapsule={()=>setCapsuleProposal(true)} studyMode={studyDesktop?studyMode:undefined}/>} {receiver}{capsuleGhost}{proposal}{proposalTarget}<div className={cls} style={{ ...outerStyle, ['--agent-title-mix' as string]:titleMix, ['--agent-panel-w' as string]: `${Math.min(300, Math.max(180, win.rect.w * (agentView?.extent ?? .32)))}px`, ['--agent-reveal' as string]: revealProgress, ['--agent-peel-width' as string]: `${Math.min(300, Math.max(180, win.rect.w * (agentView?.extent ?? .32))) * revealProgress}px`, ['--agent-peel-height' as string]: `${win.rect.h * .45 * revealProgress}px` }} data-win={win.id} data-agent-bond={win.props.agentBond ? String(win.props.agentBond) : undefined} data-agent-branch={win.props.agentBranch ? "true" : undefined} data-agent-motion={agentMotion?.primitive} onPointerDownCapture={onPointerDownCapture} onWheel={onWheel}>
      {!!win.props.agentCollapsePreview&&<div className="collapse-hint">松开预览胶囊布局</div>}
      {!!win.props.agentBond && <div className="agent-bond-skin" aria-hidden="true" />}
      <div className="aw-shell" ref={shellRef} style={shellStyle} data-fluid-skin={deformation?"true":undefined}>
        {deformation&&!revealed&&!visual.maskImage&&!visual.dented&&<div className="agent-fluid-material" aria-hidden="true"/>}
        {agentView && !agentView.revealed && <AgentAttachment view={agentView} motion={agentMotion} expanded={revealed} onToggle={toggleAgent} />}
        <div className="aw-body" style={bodyStyle} ref={bodyRef} onContextMenu={e=>{if((e.target as HTMLElement).closest('input,textarea,[contenteditable="true"]'))return;e.preventDefault();e.stopPropagation();setMenuAt({x:e.clientX,y:e.clientY});}}>
          {titleBar}
          <div className="aw-content" style={deformation?{transform:deformation.contentTransform,willChange:'transform'}:undefined} ref={contentRef} onScrollCapture={(e) => readingProgress.set(win.id, (e.target as HTMLElement).scrollTop)}>
            <Content win={win} peripheral={false} />
            {win.importance.filter(region=>region.id.startsWith('marked:')&&region.kind!=='hole').map(region=><div key={region.id} className="study-important-outline" style={{left:`${region.x*100}%`,top:`${region.y*100}%`,width:`${region.w*100}%`,height:`${region.h*100}%`}} role="button" tabIndex={0} aria-label="移除重点区域" onPointerDown={e=>e.stopPropagation()} onDoubleClick={e=>{e.stopPropagation();burstImportance(region.id,e.currentTarget);}} onKeyDown={e=>{if(e.key==='Delete'||e.key==='Enter')burstImportance(region.id,e.currentTarget);}}><LiquidBoundary/></div>)}
            {marking&&<div className="study-mark-layer" onPointerDown={startImportance}><span>{marking==='hole'?'框选扣洞':'框选保留区域'} · Esc 取消</span>{markRect&&<div className="study-mark-rect" style={{left:markRect.x,top:markRect.y,width:markRect.w,height:markRect.h}}/>}</div>}
          </div>
        </div>
        {agentView?.revealed && <RevealSurface id={win.id} view={agentView} width={rect.w} height={rect.h} progress={revealProgress} closure={win.props.agentRevealClosure as RevealClosure|undefined} body={bodyRef} baseClip={clip}/>}
      </div>

      {surfaceBonds(win).length>0&&<NativeBondSkin win={win} shell={shellRef} geometry={deformation} baseClip={undefined}/>}
      <TransportSkin width={rect.w} height={rect.h} motion={agentMotion}/>
      {deformation&&<FluidBoundary geometry={deformation} material={false}/>}

      {agentView && !agentView.revealed && <AgentAnchor view={agentView} expanded={revealed} onToggle={toggleAgent} />}
      {visual.holes.map(h => (
        <div
          key={`${h.ownerId}:${h.regionId}`}
          className="cut-rim"
          style={{ left: h.rect.x, top: h.rect.y, width: h.rect.w, height: h.rect.h }}
          role="button" tabIndex={0} aria-label="移除透出区域"
          onPointerDown={e=>e.stopPropagation()}
          onDoubleClick={e=>{e.stopPropagation();burstImportance(h.regionId,e.currentTarget,h.ownerId);}}
          onKeyDown={e=>{if(e.key==='Enter'||e.key==='Delete'){e.preventDefault();e.stopPropagation();burstImportance(h.regionId,e.currentTarget,h.ownerId);}}}

        ><LiquidBoundary/></div>
      ))}

      <LiquidPeel id={win.id} width={rect.w} height={rect.h} body={bodyRef} enabled={(tech.peel||!!win.props.agentCornerFold)&&!capsule} baseClip={clip}/>
      {resizeHandles}
    </div></>
  );
}

export const Window = memo(WindowImpl);
