import type {WindowState} from "../kernel/types";
import {materialActivity} from "../agent/adaptive/material";
import { memo, useEffect, useRef, useState } from "react";
import type { AgentMotion } from "../agent/adaptive/choreography";
import { PRIMITIVE_LABELS, type AgentView, type Primitive } from "../agent/adaptive/types";
const gestures: Record<Primitive, number> = { arrange: 1, anchor: 2, peel: 3, yield: 4, encapsulate: 5, branch: 6, merge: 7, permeate: 8 };
import { adaptation, pointer, serviceStore } from "../agent/adaptive/runtime";
import { statusMessages } from "../agent/adaptive/buffer";
import { useStore } from "../system/createStore";
import { kernel } from "../system/kernel";
import {
  createAgentRenderer,
  type EnergyScene,
  type FlowLink,
} from "../field/agentRenderer";
import {
  activationAt,
  extractionAt,
  selectionAt,
  withdrawalAt,
  WITHDRAW_DURATION,
  SELECTION_CRAWL,
  SELECTION_CONTACT,
  SELECTION_DURATION,
  HANDOFF_DURATION,
  deformationImpulse,
  nearestPerimeter,
  perimeterPoint,
} from "../field/energyMotion";

const smooth = (x: number) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};
function AgentSceneImpl() {
  const front = useRef<HTMLCanvasElement>(null),
    ambience = useRef<HTMLDivElement>(null),
    cursor = useRef<HTMLDivElement>(null),
    hint = useRef<HTMLDivElement>(null);
  const session = useStore(adaptation.store, (s) => s);
  const status = useStore(serviceStore, (s) => s.status);
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    let foreground: ReturnType<typeof createAgentRenderer> = null;
    try {
      foreground = createAgentRenderer(front.current!);
    } catch (error) {
      console.warn("Energy renderer unavailable:", error);
      setFallback(true);
    }
    const gpu = !!foreground;
    if (!gpu) setFallback(true);
    document.documentElement.classList.add("agent-cursor-enabled");
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    type Coupling = {
      age: number;
      withdrawAge?:number;
      withdrawFlight?:boolean;
      established?:boolean;
      suppressFeedback?:boolean;
      revealOutline?:boolean;
      returned?:number;
      lastWindow?:WindowState;
      fade: number;
      launch: [number,number];
      birthTime: number;
      birthFlow: number;
      pose: [number,number,number,number];
      previousPose: [number,number,number,number];
      poseSeed: number;
      previousSeed: number;
      transitionAge: number;
      lastOperation?: AgentMotion;
      primaryId: string;
      reusedStage: string;
      lastRect: DOMRect;
      badge: HTMLSpanElement;
      generation: string;
      progress: number;
      tail: number;
      root: number;
      phase: number;
      return: number;
      end: [number, number];
      kick: number;
      echo: number;
      size: [number, number];
      entry: number;
      layer: number;
      spent: number;
      element: HTMLElement | null;
    };
    const couplings = new Map<string, Coupling>();
    const cssValues=new WeakMap<HTMLElement,Map<string,string>>();
    const writeStyle=(element:HTMLElement,key:string,value:string)=>{
      let values=cssValues.get(element);if(!values){values=new Map();cssValues.set(element,values);}
      if(values.get(key)!==value){element.style.setProperty(key,value);values.set(key,value);}
    };
    const rounded=(value:number,precision=100)=>Math.round(value*precision)/precision;
    const depletion: [number, number, number] = [0, 0, 0];
    const roots: [number, number, number] = [0, .33, .66];
    let nextLayer = 0;
    let frame = 0,
      morph = 0,
      morphVelocity = 0,
      energy = 0,
      clock = 0,
      transport = 0,
      lastDrain = 0;
    let last = performance.now(),
      px = pointer.x,
      py = pointer.y,
      coreX = pointer.x,
      coreY = pointer.y,
      coreVX = 0,
      coreVY = 0,
      shellX = pointer.x, shellY = pointer.y, shellVX = 0, shellVY = 0,
      pullX = 0,
      pullY = 0,
      pullVX = 0,
      pullVY = 0,
      slow = 0,
      quality = 1.5;
    const render = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (document.hidden) {
        frame = requestAnimationFrame(render);
        return;
      }
      if (dt > 0.026) slow++;
      else slow = Math.max(0, slow - 1);
      if (slow > 24) quality = 1;
      const s = adaptation.store.get(),manual=materialActivity.get(),
        active = (s.phase !== "idle"&&s.phase!=="returning")||manual.active;
      const returningAge = Math.max(0, ...[...couplings.values()].map((c) => c.age * c.fade));
      const target = active ? activationAt(now - (s.phase==="idle"&&manual.active?manual.startedAt:s.startedAt)) : smooth(returningAge / .65);
      // A critically damped spring changes the SAME vertices in both directions.
      for (let step = 0; step < 4; step++) {
        const h = dt / 4;
        morphVelocity += ((target - morph) * 260 - morphVelocity * 31) * h;
        morph += morphVelocity * h;
      }
      morph = Math.max(0, Math.min(1, morph));
      const charging = active ? smooth((now - s.startedAt - 420) / 2080) : 0;
      const goalEnergy = active
        ? s.phase === "frozen"
          ? 0.6
          : 0.35 + charging * 0.75
        : 0;
      energy += (goalEnergy - energy) * (1 - Math.exp(-dt * 5));
      clock += motion.matches ? 0 : dt;
      const flowSpeed = 3.6 + energy * 5 + lastDrain * 13;
      transport += motion.matches ? 0 : dt * flowSpeed;
      const vx = Math.max(
        -800,
        Math.min(800, (pointer.x - px) / Math.max(0.001, dt)),
      );
      const vy = Math.max(
        -800,
        Math.min(800, (pointer.y - py) / Math.max(0.001, dt)),
      );
      px = pointer.x;
      py = pointer.y;
      // The energy's centre has mass. The ordinary cursor/hotspot keeps exact coordinates.
      for (let i = 0; i < 4; i++) {
        const h = dt / 4;
        coreVX += ((pointer.x - coreX) * 320 - coreVX * 28) * h;
        coreVY += ((pointer.y - coreY) * 320 - coreVY * 28) * h;
        coreX += coreVX * h;
        coreY += coreVY * h;
      }
      for(let i=0;i<4;i++){
        const h=dt/4;
        shellVX+=((coreX-shellX)*150-shellVX*20)*h;
        shellVY+=((coreY-shellY)*150-shellVY*20)*h;
        shellX+=shellVX*h;shellY+=shellVY*h;
      }
      const bodyX = motion.matches
          ? pointer.x
          : pointer.x + (coreX - pointer.x) * morph,
        bodyY = motion.matches
          ? pointer.y
          : pointer.y + (coreY - pointer.y) * morph;
      const shown = pointer.visible || active;
      if (ambience.current) ambience.current.style.opacity = String(morph);
      if (cursor.current) {
        cursor.current.style.transform = `translate3d(${pointer.x}px,${pointer.y}px,0)`;
        cursor.current.style.opacity =
          shown && (!gpu || pointer.kind !== "arrow")
            ? String(1 - smooth(morph))
            : "0";
        cursor.current.dataset.kind = active ? "arrow" : pointer.kind;
      }
      if (hint.current)
        hint.current.style.transform = `translate3d(${Math.min(innerWidth - 300, Math.max(12, pointer.x + 24))}px,${(pointer.y + 132 < innerHeight - 75 ? pointer.y + 132 : Math.max(12, pointer.y - 78))}px,0)`;
      const state = kernel.getState();
      const reveals=s.plan?.steps.filter(step=>step.type==='peel')??[];
      const revealTargets=new Set(reveals.flatMap(step=>step.targets));
      const subjects = active
        ? [
            ...new Set(
              s.plan
                ? [...s.selectedIds, ...Object.values(state.windows).filter(w => w.props.agentMotion).map(w => w.id), ...couplings.keys()]
                : s.selectedIds,
            ),
          ...(manual.active?manual.targets:[])]
        : [];
      for (const id of subjects) {
        if (couplings.has(id)) continue;
        const element = document.querySelector<HTMLElement>(
          `[data-win="${CSS.escape(id)}"]`,
        );
        if (!element) continue;
        const r = element.getBoundingClientRect();
        const layer = nextLayer++ % 3;
        const donorRoot = ((Math.atan2(r.top + r.height / 2 - bodyY - 32, r.left + r.width / 2 - bodyX - 38) / (Math.PI * 2)) - layer / 6 + 2) % 1;
        const badge=document.createElement('span');
        badge.className='agent-object-state';badge.setAttribute('aria-live','polite');
        element.append(badge);
        couplings.set(id, {
          age: 0,lastWindow:state.windows[id],
          fade: 1, lastRect:r, badge, primaryId: s.plan?.primaryTargets[0] ?? id, reusedStage: "",
          launch: [bodyX,bodyY], birthTime: clock, birthFlow: transport,
          pose: [0,0,0,.32], previousPose: [0,0,0,.32], poseSeed:0,previousSeed:0,transitionAge: 1,
          generation: s.plan?.id ?? "selected",
          progress: 0,
          tail: 0,
          root: (donorRoot + (Math.random() - .5) * .08 + 1) % 1,
          phase: transport,
          return: 0,
          end: [r.left, r.top + r.height / 2],
          kick: 0,
          echo: 0,
          size: [r.width, r.height],
          entry: Math.random(),
          layer,
          spent: 0,
          element,
        });
      }
      const links: FlowLink[] = [];
      let forceX = 0,
        forceY = 0,
        drained = 0;
      // Read all geometry before writing any feedback style: no inter-window layout thrashing.
      const windowElements = subjects.length||couplings.size?[...document.querySelectorAll<HTMLElement>("[data-win]")]:[];
      const rects = new Map(windowElements.map((element) => [
        element.dataset.win!, (element.querySelector<HTMLElement>(".aw-shell") ?? element).getBoundingClientRect(),
      ]));
      const occludersFor = (id: string): [number, number, number, number][] => {
        const target = windowElements.find(element => element.dataset.win === id);
        return windowElements.filter(element => Number(element.style.zIndex) > Number(target?.style.zIndex ?? 0))
          .slice(0,8).map(element => {
            const rect = rects.get(element.dataset.win!)!;
            return [rect.left,rect.top,rect.width,rect.height];
          });
      };
      const restingPoint = (pose: [number,number,number,number],seed: number,r: DOMRect): [number,number] => {
        const [gesture,,entry,extent]=pose;
        if(gesture===3)return [r.left+r.width*(extent>0?1-Math.abs(extent):Math.abs(extent)),r.bottom-18];
        if(gesture===6)return [r.left+r.width*(.5+.16*Math.sin(seed*9)),r.top+r.height*.45];
        if(gesture===7)return [r.left+r.width*.5,r.top+r.height*.5];
        const edge=perimeterPoint(r.width,r.height,entry);return [r.left+edge.x,r.top+edge.y];
      };
      for (const [id, c] of couplings) {
        const w = state.windows[id]??c.lastWindow,
          wanted = subjects.includes(id) && !!state.windows[id] && !w?.minimized;
        if(state.windows[id])c.lastWindow=state.windows[id];
        if(wanted&&!c.element?.isConnected){
          const replacement=document.querySelector<HTMLElement>(`[data-win="${CSS.escape(id)}"]`);
          if(replacement){if(c.element)cssValues.delete(c.element);c.element=replacement;replacement.append(c.badge);}
        }
        let rawMotion = state.windows[id]?.props.agentMotion as AgentMotion | undefined;
        if(!rawMotion&&manual.active&&manual.targets.includes(id)&&w){
          const rect=w.capsuleRect??w.rect,elapsed=(now-manual.startedAt)/1000;
          rawMotion={primitive:'anchor',edge:'left',transport:{active:false,coverage:0,progress:1},docked:false,elapsed,travelDuration:.35,progress:1,action:1,arrival:smooth(elapsed/.35),contactAge:elapsed-.35,seed:manual.serial,index:0,count:1,childCount:1,direction:[0,0],from:rect,to:rect};
        }
        const hasReveal=!!(w?.props.agentView as AgentView|undefined)?.revealed && !!(w?.props.agentView as AgentView|undefined)?.artifacts.length;
        const concurrent=rawMotion?.concurrent==='peel' && !hasReveal?undefined:rawMotion?.concurrent;
        const rawOperation=rawMotion?{...rawMotion,concurrent,primitive:concurrent??rawMotion.primitive}:undefined;
        if(rawOperation&&c.established&&s.phase==='cycling'&&s.selectedIds.includes(id)){rawOperation.docked=true;rawOperation.contactAge=-1;}
        if(rawOperation)c.lastOperation=rawOperation;
        let operation = rawOperation ?? (c.lastOperation ? (wanted ? {...c.lastOperation,docked:true,action:1,arrival:1,elapsed:c.lastOperation.travelDuration+3,contactAge:3} : c.lastOperation) : undefined);
        const generation = operation ? `${s.plan?.id}:${operation.primitive}:${operation.seed}` : s.plan?.id ?? "selected";
        if(s.plan)c.primaryId=s.plan.primaryTargets[0];
        if(rawOperation && !['branch','merge'].includes(rawOperation.primitive) && !rawOperation.docked && c.progress>.98 && c.tail>.98)c.reusedStage=generation;
        if(operation && c.reusedStage===generation)operation={...operation,docked:true,contactAge:-1};
        if (wanted && generation !== c.generation) {
          c.previousPose=[...c.pose];c.previousSeed=c.poseSeed;c.transitionAge=0;
          if(!operation?.docked){
            c.launch=[bodyX,bodyY];c.birthTime=clock;c.birthFlow=transport;
            if(operation?.primitive==='branch'){
              const parentId=(s.plan?.primaryTargets[0] ?? c.primaryId),parent=couplings.get(parentId),rect=rects.get(parentId);
              if(parent&&rect)c.launch=restingPoint(parent.lastOperation?.primitive==='branch'?parent.previousPose:parent.pose,parent.lastOperation?.primitive==='branch'?parent.previousSeed:parent.poseSeed,rect);
            }else if(operation?.primitive==='merge'){
              const rect=rects.get(id);if(rect)c.launch=restingPoint(c.previousPose,c.previousSeed,rect);
            }
          }
          c.age = 0;
          c.generation = generation;
          c.progress = 0;
          c.tail = 0;
          c.spent = 0;
          c.phase = transport;
        }
        const neverEmitted=!c.established&&c.progress<.002&&c.tail<.002;
        if(!wanted&&neverEmitted)c.fade=0;
        if(!wanted&&!neverEmitted&&c.withdrawAge===undefined){
          c.withdrawAge=0;c.returned=0;c.withdrawFlight=!operation&&c.age<SELECTION_CONTACT;
          c.previousPose=c.pose[0]===0?[...c.pose]:[0,1,c.entry,.32];c.previousSeed=c.poseSeed;
        }
        if(c.withdrawAge!==undefined){
          c.withdrawAge=motion.matches&&!wanted?WITHDRAW_DURATION:Math.max(0,c.withdrawAge+(wanted?-dt:dt));
          if(wanted&&c.withdrawAge===0){c.withdrawAge=undefined;if(!c.withdrawFlight)c.age=SELECTION_DURATION;c.withdrawFlight=false;}
          c.fade=1-smooth(((c.withdrawAge??0)-(WITHDRAW_DURATION-.15))/.15);
        }else c.fade = wanted ? Math.min(1, c.fade + dt * 5) : Math.max(0, c.fade - dt * 2.8);
        c.age = motion.matches ? (wanted ? HANDOFF_DURATION : 0) : wanted
          ? Math.min(operation ? HANDOFF_DURATION : SELECTION_DURATION, c.age + dt)
          : c.age;
        if(!wanted&&c.withdrawFlight){c.age=Math.max(0,c.age-dt*2);c.fade=c.age>0?1:0;}
        if (wanted && s.plan && !operation && c.established) c.age = SELECTION_DURATION;
        c.transitionAge+=dt;
        if(c.withdrawAge!==undefined)operation=undefined;
        if(operation&&!operation.docked&&!operation.departure&&operation.elapsed<=.07){c.launch=[bodyX,bodyY];c.birthTime=clock;c.birthFlow=transport;}
        const transferAge=operation ? (operation.docked ? HANDOFF_DURATION : operation.elapsed/operation.travelDuration*.81) : c.age;
        let handoff = operation ? extractionAt(transferAge) : selectionAt(c.age);
        // Child windows and the donated packet cleave / return on the same working clock.
        if(operation && ['branch','merge'].includes(operation.primitive) && !operation.docked){
          const head=operation.action,closing=smooth((head-.82)/.18);
          handoff={...handoff,head,tail:Math.min(head,Math.max(0,head-.24)*(1-closing)+closing),arrived:closing,crawl:head,bound:closing};
        }
        const withdrawing=c.withdrawAge!==undefined&&!c.withdrawFlight;
        const withdrawal=withdrawing?withdrawalAt(c.withdrawAge!):undefined;
        if(withdrawal)handoff={...handoff,head:withdrawal.head,tail:withdrawal.tail,lift:1,arrived:0,crawl:1,bound:0};
        if(handoff.head>.98&&(handoff.bound>.95||operation?.arrival===1))c.established=true;
        const material = handoff.head - c.spent;
        const extractionWeight = (operation?.docked || operation?.departure ? 0 : 1) * (s.plan?.supportTargets.includes(id) ? .65 : 1) * (operation ? .5 : 1);
        if(withdrawal){
          const restored=handoff.head-(c.returned??0);
          depletion[c.layer]=Math.max(0,Math.min(.96,depletion[c.layer]-restored*.92));c.returned=handoff.head;
        }else{
          depletion[c.layer] = Math.max(0, Math.min(.96, depletion[c.layer] + material * extractionWeight * (material > 0 ? .92 : .65)));
          c.spent = handoff.head;
        }
        c.progress = handoff.head;
        c.tail = handoff.tail;
        if (!wanted && c.fade <= 0) {
          c.element?.style.removeProperty("--agent-warp-x");
          c.element?.style.removeProperty("--agent-warp-y");
          c.element?.style.removeProperty("--agent-load");
          c.element?.style.removeProperty("--agent-arrived");
          c.element?.style.removeProperty("--agent-contact-x");
          c.element?.style.removeProperty("--agent-contact-y");
          c.element?.style.removeProperty("--agent-stretch");
          c.element?.style.removeProperty("--agent-bite-mask");
          c.badge.remove();
          if(c.element)cssValues.delete(c.element);
          couplings.delete(id);
          continue;
        }
        if (!c.element || !w) continue;
        const measured = rects.get(id) ?? c.lastRect;
        const r = measured;
        if(rects.has(id))c.lastRect=r;
        // A stable entry is picked on the actual boundary, then material crawls the entire contour.
        if (operation && (operation.primitive === "arrange" || operation.primitive === "yield") && Math.hypot(...operation.direction) > .01) {
          c.entry = nearestPerimeter(r.width, r.height, r.width / 2 + operation.direction[0] * 1000, r.height / 2 + operation.direction[1] * 1000);
        }
        if (operation && ["anchor", "peel"].includes(operation.primitive)) c.entry = .33;
        const contact = perimeterPoint(r.width, r.height, c.entry);
        const end: [number, number] = [r.left + contact.x, r.top + contact.y];
        const dx = end[0] - c.end[0],
          dy = end[1] - c.end[1];
        // Window motion feeds tension back into the core and into travelling light pulses.
        const deformation = Math.hypot(dx, dy, r.width - c.size[0], r.height - c.size[1]);
        c.kick = Math.max(
          c.age > dt * 2 && !motion.matches ? deformationImpulse(deformation<.05?0:deformation, dt) : 0,
          c.kick * Math.exp(-dt * 3.5),
        );
        c.end = end;
        c.size = [r.width, r.height];
        const from: [number, number] = [
          bodyX + 38 * morph + pullX * 0.35,
          bodyY + 32 * morph + pullY * 0.35,
        ];
        const distance = Math.max(
          1,
          Math.hypot(end[0] - from[0], end[1] - from[1]),
        );
        const nx = (end[0] - from[0]) / distance,
          ny = (end[1] - from[1]) / distance;
        const supporting = !!s.plan?.supportTargets.includes(id);
        if(s.plan){c.suppressFeedback=!!reveals.length&&!revealTargets.has(id);c.revealOutline=!!reveals.length;}
        const strength = (supporting ? 0.6 : 1) * c.fade;
        const packet = handoff,
          arrived = operation ? (operation.docked ? 1 : operation.arrival) : (s.plan ? 1 : packet.arrived);
        const settled=operation ? operation.action>.96 : packet.bound>.96;
        writeStyle(c.badge,'opacity',String(rounded((c.suppressFeedback?0:1)*c.fade*(settled?1:smooth(arrived)*.8))));
        c.badge.classList.toggle('settled',settled);
        const objectLabel=settled?'已建立协作':operation?(operation.transport.active?'包覆移位中':`${PRIMITIVE_LABELS[operation.primitive]}中`):'正在建立协作';
        if(c.badge.textContent!==objectLabel)c.badge.textContent=objectLabel;
        const impactAge = Math.max(0, c.age - (operation ? .81 : SELECTION_CONTACT));
        c.echo += (c.kick - c.echo) * (1 - Math.exp(-dt * 4));
        const recoil = Math.sin(impactAge * 17) * Math.exp(-impactAge * 5);
        const pressure =
          arrived *
          strength *
          (motion.matches ? 0 : recoil * 1.1 + c.kick * 0.4 + packet.beat * .65);
        const bite = 0;
        const extraction = packet.drain;
        drained += (extraction + c.echo * .55 + bite * .22) * strength;
        if(c.element.style.getPropertyValue("--agent-bite-mask"))c.element.style.removeProperty("--agent-bite-mask");
        writeStyle(c.element,'--agent-arrived',String(rounded(c.suppressFeedback?0:(operation?operation.arrival:(s.plan?1:packet.bound))*c.fade,1000)));
        writeStyle(c.element,'--agent-warp-x',`${rounded(-nx*pressure*1.7,50)}px`);
        writeStyle(c.element,'--agent-warp-y',`${rounded(-ny*pressure*1.7,50)}px`);
        writeStyle(c.element,'--agent-load',String(rounded(Math.min(1,Math.abs(pressure)))));
        writeStyle(c.element,'--agent-stretch',String(rounded(1+pressure*.0025,5000)));
        writeStyle(c.element,'--agent-contact-x',`${rounded(end[0]-r.left,10)}px`);
        writeStyle(c.element,'--agent-contact-y',`${rounded(end[1]-r.top,10)}px`);
        forceX +=
          (nx * (extraction * 23 + pressure * 6 + c.echo * 12) + dx * 0.08) * strength;
        forceY +=
          (ny * (extraction * 23 + pressure * 6 + c.echo * 12) + dy * 0.08) * strength;
        const merging = operation?.primitive === "merge";
        const returnGoal = !wanted || merging ? 1 : 0;
        c.return += (returnGoal - c.return) * (1 - Math.exp(-dt * 7));
        roots[c.layer] = c.root;
        c.phase += motion.matches ? 0 : dt * flowSpeed * (1 - 2 * c.return);
        if (c.progress - c.tail > 0.002 || arrived > .001) {
          const normal: [number, number] = [-contact.nx, -contact.ny];
          // Continue inside the host, then fan into the same locally clipped material.
          const inside: [number, number] = [end[0] + normal[0] * 10, end[1] + normal[1] * 10];
          const link: FlowLink = {
            selection: !operation,
            withdrawing,
            highlight:reveals.length||c.suppressFeedback||c.revealOutline?0:withdrawing?1-smooth((c.withdrawAge??0)/.5):arrived*c.fade,
            coordinator:id===s.plan?.primaryTargets[0],
            transport: operation?.transport.coverage ?? 0,
            transportProgress: operation?.transport.progress ?? 0,
            carrier: [r.left,r.top,r.width,r.height],
            side: operation?.edge==='left'?0:operation?.edge==='top'?2:operation?.edge==='bottom'?3:1,
            opacity: (withdrawal?withdrawal.opacity:1) * c.fade * (operation?.docked ? 1 : handoff.lift) * (operation||withdrawing?1:1-smooth((c.age-SELECTION_CONTACT-SELECTION_CRAWL)/.25)) * (operation?.primitive==='encapsulate'?1-smooth((operation.action-.86)/.14):1),
            landing: withdrawing ? 0 : motion.matches ? 1 : (operation && ['branch','merge'].includes(operation.primitive) && !operation.docked ? smooth((operation.action-.82)/.18) : operation?.docked ? 1 : smooth(((operation ? operation.contactAge : c.age-SELECTION_CONTACT)+.06)/.32)),
            birthTime: c.birthTime,
            birthFlow: c.birthFlow,
            poseBlend: operation && !operation.docked ? 1 : smooth(c.transitionAge/.65),
            previousPose: c.previousPose,
            previousSeed: c.previousSeed,
            impact: withdrawing || motion.matches || (operation && ["branch","merge"].includes(operation.primitive)) ? -1 : (operation ? operation.contactAge : c.age - SELECTION_CONTACT),
            budding: !operation?.departure,
            gesture: operation ? gestures[operation.concurrent && (w.props.agentView as AgentView | undefined)?.revealed ? operation.concurrent : operation.primitive] : 0,
            action: operation?.primitive==="branch" && operation.docked ? smooth(operation.elapsed/(operation.travelDuration+1.6)) : operation?.action ?? packet.crawl,
            seed: operation?.seed ?? c.root,
            extent: (Math.min(300, Math.max(180, w.rect.w * ((w.props.agentView as AgentView | undefined)?.extent ?? .32))) / w.rect.w) * ((w.props.agentView as AgentView | undefined)?.edge === "left" ? -1 : 1),
            from: withdrawing ? [bodyX,bodyY] : operation?.departure ? c.launch : [bodyX+(c.launch[0]-bodyX)*smooth(packet.sever),bodyY+(c.launch[1]-bodyY)*smooth(packet.sever)],
            layer: c.layer,
            to: withdrawing ? end : operation?.primitive === "merge" ? (() => {
              const target = rects.get((s.plan?.primaryTargets[0] ?? c.primaryId));
              return target ? [target.left + target.width * .5, target.top + target.height * .5] : inside;
            })() as [number, number] : inside,
            progress: c.progress,
            tail: c.tail,
            root: c.root,
            width: (11 + energy * 3) * (supporting ? .84 : 1),
            returning: c.return,
            phase: c.phase,
            feedback: c.kick,
            arrival: (withdrawing?1:arrived) * strength * (operation?.primitive === "merge" && id !== s.plan?.primaryTargets[0] ? 1 - operation.action : 1),
            crawl: operation ? operation.action : (s.plan ? 1 : packet.crawl),
            bound: operation ? operation.action : (s.plan ? 1 : packet.bound),
            beat: packet.beat,
            sever: packet.sever,
            bite,
            entry: c.entry,
            host: [r.left, r.top, r.width, r.height],
            impactHost: operation?.primitive === "merge" ? (() => {
              const target = rects.get((s.plan?.primaryTargets[0] ?? c.primaryId));
              return target ? [target.left, target.top, target.width, target.height] : [r.left, r.top, r.width, r.height];
            })() as [number, number, number, number] : [r.left, r.top, r.width, r.height],
            normal,
            occluders: occludersFor(id),
            impactOccluders: occludersFor(operation?.primitive === "merge" ? (s.plan?.primaryTargets[0] ?? c.primaryId) : id),
          };
          c.pose=[link.gesture,link.action,link.entry,link.extent];c.poseSeed=link.seed;
          const children = operation && ['branch','merge'].includes(operation.primitive) && id!==s.plan?.primaryTargets[0] ? operation.childCount : 1;
          for(let child=0;child<children;child++){
            const branchEntry=(link.entry+child*.035)%1,point=perimeterPoint(r.width,r.height,branchEntry);
            const copy: FlowLink={...link,seed:link.seed+child*2.13,previousSeed:link.previousSeed+child*2.13,entry:branchEntry};
            if(operation?.primitive==='branch')copy.to=[r.left+point.x-point.nx*10,r.top+point.y-point.ny*10];
            if(operation?.primitive==='merge' && child>0)copy.from=restingPoint(c.previousPose,c.previousSeed+child*2.13,r);
            links.push(copy);
          }
        }
      }
      const extracting = [...couplings.values()].some((c) => c.age < SELECTION_DURATION && subjects.length > 0);
      for (let layer = 0; layer < 3; layer++) depletion[layer] *= Math.exp(-dt * (extracting ? .018 : .2));
      for (let step = 0; step < 4; step++) {
        const h = dt / 4;
        pullVX += ((forceX - pullX) * 130 - pullVX * 22) * h;
        pullVY += ((forceY - pullY) * 130 - pullVY * 22) * h;
        pullX += pullVX * h;
        pullY += pullVY * h;
      }
      const burstAge = (now - s.burstAt) / 1000;
      const burst =
        active && s.plan && burstAge >= 0 ? Math.exp(-burstAge * 4) : 0;
      lastDrain = Math.min(1.4, drained);
      const scene: EnergyScene = {
        x: bodyX,
        y: bodyY,
        morph,
        energy,
        pull: [pullX, pullY],
        shellOffset: motion.matches ? [0,0] : [Math.max(-14,Math.min(14,shellX-bodyX))*morph,Math.max(-14,Math.min(14,shellY-bodyY))*morph],
        velocity: motion.matches
          ? [0, 0]
          : [
              Math.max(-1000, Math.min(1000, coreVX - vx * 0.2)),
              Math.max(-1000, Math.min(1000, coreVY - vy * 0.2)),
            ],
        burst,
        drain: lastDrain,
        depletion: [...depletion],
        roots: [...roots],
        transport,
        core: shown && (morph > .001 || pointer.kind === "arrow"),
        links,
      };
      if (import.meta.env.DEV && front.current)
        (
          front.current as HTMLCanvasElement & { __energy?: EnergyScene }
        ).__energy = scene;
      foreground?.render(scene, motion.matches ? 1 : clock, quality);
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      foreground?.dispose();
      document.documentElement.classList.remove("agent-cursor-enabled");
      for (const c of couplings.values()) {
        c.badge.remove();
        for (const property of ["warp-x", "warp-y", "load", "arrived", "contact-x", "contact-y", "stretch", "bite-mask"])
          c.element?.style.removeProperty(`--agent-${property}`);
      }
    };
  }, []);
  useEffect(() => {
    const update = () => {
      const s = adaptation.store.get();
      const reveals=s.plan?.steps.filter(step=>step.type==='peel')??[],revealTargets=new Set(reveals.flatMap(step=>step.targets));
      for (const el of document.querySelectorAll<HTMLElement>("[data-win]")) {
        const id = el.dataset.win!;
        el.classList.toggle(
          "agent-target",
          reveals.length?revealTargets.has(id):s.selectedIds.includes(id) || !!s.plan?.primaryTargets.includes(id),
        );
        el.classList.toggle(
          "agent-support",
          !reveals.length&&!!s.plan?.supportTargets.includes(id),
        );
      }
    };
    update();
    const off = kernel.subscribe(update);
    return () => {
      off();
    };
  }, [session.selectedIds, session.plan]);
  const text =
    session.phase==='applying'?'已接受，正在完成 · Esc 撤回':session.phase==='returning'?'正在收回 · 撤回方案':
    session.performing && session.operation
      ? `${PRIMITIVE_LABELS[session.operation as Primitive]} · ← → 切换，松开空格采用`
      : session.phase === "charging"
      ? "继续按住，让思绪展开"
      : session.phase === "hatching"
        ? session.selectedIds.length
          ? `已连接 ${session.selectedIds.length} 个窗口`
          : "点选窗口指定对象 · 未点选则超时全选"
        : session.phase === "waiting"
          ? status === "thinking"
            ? "正在更新这一刻的方案…"
            : statusMessages[status]
          : session.phase === "cycling"
            ? `方案 ${session.index + 1}/${session.plans.length} · ← → 切换，松开采用`
            : session.phase === "frozen"
              ? "松开采用 · Esc 撤回"
              : "";
  const operations = session.plan ? [...new Set(session.plan.steps.map(step=>step.type))].filter(step=>step!=='anchor') : [];
  return (
    <>
      <div className="agent-ambience" ref={ambience} aria-hidden="true" />
      <canvas
        className="agent-canvas agent-front"
        ref={front}
        aria-hidden="true"
      />
        {session.phase==='cycling'&&<div className="agent-candidate-tabs">{session.plans.map((plan,index)=><button key={plan.id} className={index===session.index?'selected':''} onPointerDown={e=>e.stopPropagation()} onClick={()=>adaptation.navigate(index-session.index)}>{index+1} {plan.title}</button>)}</div>}
      <div className="iridescent-cursor" ref={cursor} aria-hidden="true">
        <svg width="28" height="32" viewBox="0 0 28 32">
          <defs>
            <linearGradient id="cursor-pearl" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#872239" />
              <stop offset=".38" stopColor="#8c651e" />
              <stop offset=".58" stopColor="#872239" />
              <stop offset=".8" stopColor="#214980" />
              <stop offset="1" stopColor="#872239" />
              <animateTransform
                attributeName="gradientTransform"
                type="rotate"
                values="0 .5 .5;360 .5 .5"
                dur="3s"
                repeatCount="indefinite"
              />
            </linearGradient>
          </defs>
          <path
            className="cursor-arrow"
            d="M2 2 L3 24 L9 18 L13 27 L17 25 L12 17 L22 16 Z"
            fill="#fff"
            stroke="url(#cursor-pearl)"
            strokeWidth="1.6"
          />
          <path
            className="cursor-ibeam"
            d="M5 2H15M10 2V24M5 24H15"
            fill="none"
            stroke="url(#cursor-pearl)"
            strokeWidth="2.8"
          />
          <path
            className="cursor-resize"
            d="M2 14H25M2 14L7 9M2 14L7 19M25 14L20 9M25 14L20 19"
            fill="none"
            stroke="url(#cursor-pearl)"
            strokeWidth="2.5"
          />
          <path
            className="cursor-hand"
            d="M9 27C6 23 2 18 3 16C5 13 8 19 9 18V5C9 1 13 1 13 5V13C13 10 17 10 17 14C18 11 21 12 21 16C24 14 26 17 25 21L23 28Z"
            fill="#fff"
            stroke="url(#cursor-pearl)"
            strokeWidth="1.6"
          />
        </svg>
      </div>
      {fallback && session.phase !== "idle" && (
        <div
          className="agent-fallback"
          style={{ left: pointer.x, top: pointer.y }}
        />
      )}
      <div
        className={`agent-gesture-hint ${session.phase !== "idle" ? "visible" : ""}`}
        ref={hint}
        role="status"
        aria-live="polite"
      >
        <span>{text}</span>

        {session.plan && <b>{session.index+1}/{session.plans.length} · {session.plan.title}</b>}
        {operations.length>0 && <div className="agent-operation-track">{operations.map(operation=><span key={operation} className={session.operation===operation || (session.operation==='arrange' && operation==='peel')?"current":""}>{PRIMITIVE_LABELS[operation]}</span>)}</div>}
      </div>
    </>
  );
}

export const AgentScene=memo(AgentSceneImpl);
