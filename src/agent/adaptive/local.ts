import type { AgentContext, AgentPlan, Artifact, PrimitiveStep } from "./types";

/** Deterministic visual rehearsal. This module never requests a model or fabricates evidence. */
export function localPlans(ctx: AgentContext): AgentPlan[] {
  if (!ctx.windows.length) return [];
  const preferred = ctx.windows.find((w) => w.app === (ctx.task === "files" ? "finder" : "writer"));
  const primary = ctx.selectedIds.length ? ctx.selectedIds : [preferred?.id ?? ctx.focusedId ?? ctx.windows[0].id];
  const referenceApp = ctx.task === "files" ? "finder" : "preview";
  const supports = ctx.windows.filter((w) => !primary.includes(w.id))
    .sort((a, b) => (b.app === referenceApp ? 2 : b.app === "writer" ? 1 : 0) - (a.app === referenceApp ? 2 : a.app === "writer" ? 1 : 0)).map((w) => w.id);
  const targets = [...primary, ...supports];
  const relevantSources = ctx.sources.filter((source) => ctx.task === "files" ? source.kind === "file" : source.kind === "paper" || source.kind === "table");
  const sources = [...(relevantSources.length ? relevantSources : ctx.sources)].sort((a, b) => Number(primary.includes(a.windowId)) - Number(primary.includes(b.windowId))).slice(0, 2);
  const artifacts: Artifact[] = sources.map((source, i) => ({
    id: `local-source-${i}`,
    kind: ctx.task === "files" ? "files" : "evidence",
    title: source.title.slice(0, 110),
    body: `本地读取 · ${source.text.slice(0, 420)}`,
    sourceIds: [source.id],
  }));
  const allSources=[...new Set(artifacts.flatMap(a=>a.sourceIds))];
  const summary:Artifact={id:'local-comparison',kind:'comparison',title:'来源汇合',body:sources.map(s=>`${s.title}：${s.text.slice(0,150)}`).join('\n'),sourceIds:allSources};
  const make=(id:string,title:string,rationale:string,steps:PrimitiveStep[],results=artifacts):AgentPlan=>({id,title,rationale,priority:1,confidence:1,primaryTargets:primary,supportTargets:supports,steps,artifacts:results});
  return [
    make('local-hole','中央揭示','从上层空白处镂空，让下层重要内容透出。',[{type:'peel',mode:'hole',targets:[ctx.windows.filter(w=>primary.includes(w.id)).at(-1)!.id],edge:'right',extent:.32,artifactIds:[]}],[]),
    make('local-peel','边缘揭示','从边缘蚕食出空隙，透出下层与光流。',[{type:'peel',mode:'edge',targets:[ctx.windows.filter(w=>primary.includes(w.id)).at(-1)!.id],edge:'right',extent:.32,artifactIds:[]}],[]),
    make('local-yield','让界','牵动一侧边界，为协作腾出空间。',[{type:'yield',targets:primary,direction:'left',amount:.4}]),
    make('local-carry','包裹','把窗口依次收进可编辑的会话胶囊。',[{type:'encapsulate',targets,edge:'right'}],[]),
    make('local-branch','分生','从同一窗口分出独立的来源分支。',[{type:'branch',targets:primary,branches:artifacts.map((a,i)=>({id:`local-read-${i}`,targetId:primary[0],sourceIds:a.sourceIds,artifactId:a.id}))}]),
    make('local-merge','汇合','关联窗口的依据汇入当前工作面。',[{type:'merge',targets:primary,artifactIds:artifacts.map(a=>a.id),resultId:summary.id}],[...artifacts,summary]),
    make('local-layer','渗层','让当前窗口与协作层穿行、浮现。',[{type:'permeate',targets:primary,depth:.28,artifactIds:artifacts.map(a=>a.id)}]),
  ];
}
