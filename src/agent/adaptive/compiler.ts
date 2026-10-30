import {fusionPlacement,surfaceBonds} from '../../shell/surfaceBondGeometry';
import {visualRect} from "../../techniques/depth";
import {capsuleSize} from "./capsuleGeometry";
import type { KernelState, Rect, WindowState } from "../../kernel/types";
import type {
  AgentContext,
  AgentPlan,
  AgentView,
  CapsuleSnapshot,
  CompiledPlan,
} from "./types";

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export function bounded(r: Rect, work: Rect): Rect {
  const w = clamp(r.w, Math.min(280, work.w), work.w),
    h = clamp(r.h, Math.min(190, work.h), work.h);
  return {
    x: clamp(r.x, work.x, work.x + work.w - w),
    y: clamp(r.y, work.y, work.y + work.h - h),
    w,
    h,
  };
}

/** Every candidate compiles against the immutable invocation snapshot. */
export function compilePlan(
  base: KernelState,
  plan: AgentPlan,
  context: AgentContext,
): CompiledPlan {
  const windows = { ...base.windows };
  const targets = [
    ...new Set([...plan.primaryTargets, ...plan.supportTargets]),
  ];
  const W = context.work;
  const patch = (id: string, p: Partial<WindowState>) => {
    if (windows[id]) windows[id] = { ...windows[id], ...p };
  };
  for (const id of targets) {
    const w = windows[id];
    if (!w) continue;
    const steps = plan.steps.filter((s) => s.targets.includes(id));
    if (!steps.length) continue;
    const peel = steps.find((s) => s.type === "peel");
    const attachment = steps.find(
      (s) =>
        s.type === "anchor" || s.type === "peel" || s.type === "encapsulate",
    );
    const artifactIds = new Set(
      steps.flatMap((s) =>
        "artifactIds" in s
          ? s.artifactIds
          : s.type === "branch"
            ? s.branches.map((b) => b.artifactId)
            : [],
      ),
    );
    const merged = steps.find((s) => s.type === "merge");
    if (merged?.type === "merge") artifactIds.add(merged.resultId);
    const artifacts = plan.artifacts.filter((a) => artifactIds.has(a.id));
    const branch = steps.find((s) => s.type === "branch");
    const view: AgentView = {
      planId: plan.id,
      title: plan.title,
      rationale: plan.rationale,
      steps: steps.map((s) => s.type),
      edge: attachment && "edge" in attachment ? attachment.edge : "right",
      extent: peel?.type === "peel" ? peel.extent : 0.32,
      revealMode: peel?.type === "peel" ? peel.mode ?? "edge" : undefined,
      artifacts,
      sources: context.sources.filter((s) =>
        artifacts.some((a) => a.sourceIds.includes(s.id)),
      ),
      branches:
        branch?.type === "branch"
          ? branch.branches.map((b) => ({
              ...b,
              title:
                plan.artifacts.find((a) => a.id === b.artifactId)?.title ??
                b.id,
            }))
          : [],
      merged: merged?.type === "merge" ? merged.resultId : undefined,
      anchored: steps.some((s) => s.type === "anchor") || (artifacts.length > 0 && steps.some((s) => ["branch", "merge", "permeate"].includes(s.type))),
      revealed: steps.some(
        (s) => s.type === "peel",
      ),
      layer: steps.some((s) => s.type === "permeate"),
      supporting: !plan.primaryTargets.includes(id),
    };
    patch(id, {
      props: {
        ...w.props,
        agentView: view,
        agentRevealClosure: 0,
        ...(w.appId === "finder" && artifacts.some((a) => a.kind === "files")
          ? { agentGrouping: true }
          : {}),
      },
    });
  }
  for (const step of plan.steps) {
    if(step.type==='peel'&&step.mode==='hole')for(const id of step.targets){
      const host=windows[id];if(!host)continue;
      const lower=base.order.slice(0,base.order.indexOf(id)).map(key=>base.windows[key]).filter(w=>w.form==='normal'&&!w.minimized);
      let best:{score:number;rect:Rect;region:Rect;source:string}|undefined;
      const width=Math.min(270,host.rect.w*.46),height=Math.min(185,host.rect.h*.35);
      for(const under of lower)for(const important of under.importance){
        const underRect=visualRect(under,base.screen);
        const cx=underRect.x+(important.x+important.w*.5)*underRect.w;
        const cy=underRect.y+(important.y+important.h*.5)*underRect.h;
        const blocked=lower.slice(lower.indexOf(under)+1).some(other=>{const r=visualRect(other,base.screen);return cx>r.x&&cx<r.x+r.w&&cy>r.y&&cy<r.y+r.h;});
        if(blocked)continue;
        for(const x of [.3,.5,.7])for(const y of [.35,.55,.73]){
          const rect=bounded({...host.rect,x:cx-host.rect.w*x,y:cy-host.rect.h*y},W);
          const region={x:(cx-rect.x-width/2)/rect.w,y:(cy-rect.y-height/2)/rect.h,w:width/rect.w,h:height/rect.h};
          if(region.x<.06||region.x+region.w>.94||region.y<.15||region.y+region.h>.94)continue;
          const interference=host.importance.reduce((sum,r)=>sum+Math.max(0,Math.min(region.x+region.w,r.x+r.w)-Math.max(region.x,r.x))*Math.max(0,Math.min(region.y+region.h,r.y+r.h)-Math.max(region.y,r.y))*r.weight,0);
          const distance=Math.hypot(rect.x-host.rect.x,rect.y-host.rect.y);
          const score=important.weight*8-interference*300-distance*.012+base.order.indexOf(under.id)*.5;
          if(!best||score>best.score)best={score,rect,region,source:under.id};
        }
      }
      const view=host.props.agentView as AgentView;
      patch(id,{...(best?{rect:best.rect,depth:0}:{}),props:{...host.props,agentView:{...view,revealRegion:best?.region??{x:.27,y:.33,w:.46,h:.34},revealSource:best?.source}}});
    }

    if (step.type === "arrange") {
      const subjects = plan.primaryTargets.filter((id) => step.targets.includes(id));
      const references = step.targets.filter((id) => !subjects.includes(id));
      const gap = Math.min(24, W.w * .025);
      if (step.layout === "compare") {
        const ordered = references.length ? [references[0], ...subjects] : subjects;
        const columns = W.w < 680 ? 1 : Math.min(ordered.length, 3);
        const rows = Math.ceil(ordered.length / columns);
        ordered.forEach((id, index) => {
          const w = windows[id];
          if (!w) return;
          const cellW = (W.w - gap * (columns + 1)) / columns;
          const cellH = (W.h - gap * (rows + 1)) / rows;
          patch(id, { rect: bounded({ x: W.x + gap + (index % columns) * (cellW + gap), y: W.y + gap + Math.floor(index / columns) * (cellH + gap), w: Math.min(w.rect.w, cellW), h: Math.min(w.rect.h, cellH) }, W), depth: 0 });
        });
        references.slice(1).forEach((id, index) => {
          const w = windows[id];
          patch(id, { rect: bounded({ ...w.rect, x: W.x + gap + index * 32, y: W.y + W.h - Math.min(w.rect.h, W.h * .5) - gap, h: Math.min(w.rect.h, W.h * .5) }, W), depth: .18 });
        });
      } else {
        subjects.forEach((id, index) => {
          const w = windows[id];
          patch(id, { rect: bounded({ ...w.rect, x: W.x + (W.w - w.rect.w) * .5 + index * 32, y: W.y + gap + index * 24 }, W), depth: 0 });
        });
        references.forEach((id, index) => {
          const w = windows[id];
          patch(id, { rect: bounded({ ...w.rect, x: index % 2 ? W.x + W.w - Math.min(w.rect.w, W.w * .32) - gap : W.x + gap, y: W.y + gap + index * 42, w: Math.min(w.rect.w, W.w * .32), h: Math.min(w.rect.h, W.h * .82) }, W), depth: .16 });
        });
      }
    }
    if (step.type === "yield") {
      // Pull exactly one side. Its opposite side and both perpendicular coordinates stay fixed.
      for (const id of step.targets) {
        const w=windows[id];if(!w)continue;
        const r={...w.rect},horizontal=step.direction==='left'||step.direction==='right';
        const amount=Math.min(.38,Math.max(.06,step.amount*.6));
        if(horizontal){const delta=Math.min(r.w-280,r.w*amount);r.w-=Math.max(0,delta);if(step.direction==='left')r.x+=Math.max(0,delta);}
        else {const delta=Math.min(r.h-190,r.h*amount);r.h-=Math.max(0,delta);if(step.direction==='top')r.y+=Math.max(0,delta);}
        patch(id,{rect:r});
      }
    }
    if (step.type === "branch") {
      step.branches.forEach((branch,index)=>{
        const parent=windows[branch.targetId]??windows[step.targets[0]];
        const artifact=plan.artifacts.find(a=>a.id===branch.artifactId);
        if(!parent||!artifact)return;
        const id=`agent-branch:${plan.id}:${branch.id}`;
        const w=Math.min(330,W.w*.32),h=Math.min(235,(W.h-60)/Math.max(2,step.branches.length));
        const side=parent.rect.x+parent.rect.w*.5>W.x+W.w*.5?-1:1;
        const rect=bounded({x:side<0?parent.rect.x-w-30:parent.rect.x+parent.rect.w+30,y:W.y+24+index*(h+24),w,h},W);
        windows[id]={...parent,id,title:artifact.title,rect,depth:0,form:'normal',minimized:false,maximized:false,group:undefined,
          openedFrom:parent.id,props:{agentBranch:{artifact,parentId:parent.id,planId:plan.id,ordinal:index,parentSnapshot:parent},agentBond:plan.id}};
      });
    }
    if (step.type === "merge") {
      // The actual result windows return to their parent, then cease to be separate windows.
      for(const [id,w] of Object.entries(windows)){
        const branch=w.props.agentBranch as {planId:string}|undefined;
        if(branch?.planId===plan.id)delete windows[id];
      }
      const members=new Set([...step.targets,...context.sources.filter(source=>plan.artifacts.some(a=>step.artifactIds.includes(a.id)&&a.sourceIds.includes(source.id))).map(source=>source.windowId)]);
      for(const id of members){const w=windows[id];if(w)patch(id,{depth:0,props:{...w.props,agentBond:plan.id}});}
      const hostId=step.targets.find(id=>windows[id]?.appId==='writer')??step.targets[0];
      const peerId=[...members].find(id=>id!==hostId&&windows[id]?.appId==='preview')??[...members].find(id=>id!==hostId&&windows[id]?.form==='normal');
      if(hostId&&peerId&&windows[hostId]&&windows[peerId]){
       const host=windows[hostId],peer=windows[peerId],placement=fusionPlacement(host.rect,peer.rect,W);
       const first=placement.axis==='x'?placement.rect.x<peer.rect.x:placement.rect.y<peer.rect.y;
       const bond={id:`bond:${plan.id}:${hostId}:${peerId}`,a:first?hostId:peerId,b:first?peerId:hostId,axis:placement.axis,createdAt:0};
       const group=`surface:${plan.id}`;
       patch(hostId,{rect:placement.rect,group,props:{...host.props,surfaceBonds:[...surfaceBonds(host).filter(b=>b.id!==bond.id),bond]}});
       patch(peerId,{group,props:{...peer.props,surfaceBonds:[...surfaceBonds(peer).filter(b=>b.id!==bond.id),bond]}});
      }
    }
    if (step.type === "permeate")
      for (const id of step.targets) patch(id, { depth: step.depth });
    if (step.type === "encapsulate") {
      const members = step.targets
        .map((id) => base.windows[id])
        .filter(Boolean);
      const host = members[0];
      if (!host) continue;
      const snapshot: CapsuleSnapshot = {
        title: plan.title,
        members,
        order: base.order,
        focusedId: base.focusedId,
        scroll: Object.fromEntries(
          context.windows.map((w) => [w.id, w.scroll]),
        ),
      };
      const count = Object.values(base.windows).filter(
        (w) => !!w.props.agentCapsule,
      ).length;
      const natural=capsuleSize(members.length),cw=Math.min(natural.w,W.w),ch=natural.h;
      const x = step.edge === "left" ? W.x + 12 : W.x + W.w - cw - 12;
      const y =
        step.edge === "bottom" ? W.y + W.h - ch - 12 : W.y + 16 + count * 126;
      patch(host.id, {
        form: "capsule",
        depth: 0,
        minimized: false,
        capsuleRect: {
          x: clamp(x, W.x, W.x + W.w - cw),
          y: clamp(y, W.y, W.y + W.h - ch),
          w: cw,
          h: ch,
        },
        props: { ...windows[host.id].props, agentCapsule: snapshot },
      });
      for (const member of members.slice(1))
        patch(member.id, { minimized: true });
    }
  }
  return { state: { ...base, windows, order:[...base.order.filter(id=>windows[id]),...Object.keys(windows).filter(id=>!base.order.includes(id))] }, plan };
}
