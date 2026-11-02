import { AGENT_FILES, FS } from "../../apps/data/fs";
import { paperById } from "../../apps/data/papers";
import {isStudyTaskId,studyCandidates,studyDocument as task1Document} from '../../apps/data/studies';
import {
  documentContent,
  documentSeed,
  readingProgress,
} from "../../apps/content";
import type { KernelState, Rect } from "../../kernel/types";
import type { BusEvent } from "../../system/bus";
import type { AgentContext, Source } from "./types";

export function hash(value: unknown): string {
  const s = JSON.stringify(value);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++)
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}
export function makeContext(
  state: KernelState,
  work: Rect,
  selectedIds: string[],
  events: BusEvent[],
  feedback: AgentContext["feedback"],
): AgentContext {
  const sources: Source[] = [];
  const studyHost = Object.values(state.windows).find(w=>w.appId==='task1'&&!w.props.agentBranch&&isStudyTaskId(w.props.pool));
  const studyTaskId=studyHost&&isStudyTaskId(studyHost.props.pool)?studyHost.props.pool:undefined;
  const studyMode = studyHost ? String(studyHost.props.studyMode??'parallel') : undefined;
  const studySeen = new Set<string>();
  const focused = state.windows[state.focusedId ?? ""];
  const chosen = selectedIds.map((id) => state.windows[id]).filter(Boolean);
  const task = studyHost ? 'papers' : (
    chosen.length
      ? chosen.every((w) => w.appId === "finder" || w.appId === "code")
      : focused?.appId === "finder" || focused?.appId === "code"
  )
    ? "files"
    : "papers";
  let remaining = 11000;
  const windows = state.order
    .map((id) => state.windows[id])
    .filter((w) => !w.minimized && !w.props.agentCapsule)
    .filter(w=>!studyHost || (w.props.pool===studyTaskId && (!w.props.studyDocumentId || task1Document(String(w.props.studyDocumentId))?.candidate)))
    .slice(-8)
    .map((w) => {
      const local: Source[] = [];
      if (studyHost && w.props.studyDocumentId) {
        const doc=task1Document(String(w.props.studyDocumentId));
        if(doc?.candidate&&!studySeen.has(doc.id)){
          studySeen.add(doc.id);
          local.push({id:`study:${doc.id}`,windowId:w.id,title:doc.file,text:`${doc.title}\n${doc.abstract}`,kind:'paper',studyDocumentId:doc.id});
        }
      } else if (w.appId === "preview") {
        const p = paperById(String(w.props.paperId ?? ""));
        local.push({
          id: `${w.id}:abstract`,
          windowId: w.id,
          title: p.title,
          text: p.abstract,
          kind: "paper",
        });
        local.push({
          id: `${w.id}:table`,
          windowId: w.id,
          title: `${p.title} · ${p.table.caption}`,
          text: [
            p.table.head.join(" | "),
            ...p.table.rows.map((r) => r.join(" | ")),
          ].join("\n"),
          kind: "table",
        });
      } else if (w.appId === "writer") {
        const id = String(w.props.docId ?? "draft");
        local.push({
          id: `${w.id}:note`,
          windowId: w.id,
          title: w.title,
          text: (documentContent.get(id) ?? documentSeed[id] ?? "").slice(
            0,
            1300,
          ),
          kind: "note",
        });
      } else if (w.appId === "finder") {
        if(studyHost){
          for(const doc of studyCandidates(studyTaskId!)){
            if(studySeen.has(doc.id))continue;
            const preview=Object.values(state.windows).find(other=>other.props.studyDocumentId===doc.id&&!other.minimized&&!other.props.agentBranch);
            if(preview)continue;
            studySeen.add(doc.id);
            local.push({id:`study:${doc.id}`,windowId:w.id,title:doc.file,text:`${doc.title}\n${doc.abstract}`,kind:'paper',studyDocumentId:doc.id});
          }
        } else {
        const path = String(w.props.path ?? "Downloads");
        const query = String(w.props.query ?? "").toLowerCase();
        const files = [...FS, ...AGENT_FILES].filter(
          (f) => f.dir === path || (query && f.dir.startsWith(path + "/")),
        );
        for (const f of files
          .filter(
            (f) =>
              f.agentEligible !== false && (!query ||
              `${f.name} ${f.paperId ? paperById(f.paperId).title : ""} ${f.provenance?.task ?? ""}`
                .toLowerCase()
                .includes(query)),
          )
          .slice(0, 14)) {
          local.push({
            id: `${w.id}:file:${f.name}`,
            windowId: w.id,
            title: f.name,
            text: `${f.dir}/${f.name}\n${f.paperId ? paperById(f.paperId).title : f.kind}\n${f.provenance?.context ?? f.agent?.note ?? ""}\n任务：${f.provenance?.task ?? "待归类"}`,
            kind: "file",
          });
        }
        }
      }
      for (const s of local) {
        s.text = s.text.slice(0, Math.max(0, remaining));
        remaining -= s.text.length + s.title.length;
        if (s.text) sources.push(s);
      }
      return {
        id: w.id,
        app: w.appId,
        title: w.title,
        role: w.role,
        rect: w.rect,
        depth: w.depth,
        focused: state.focusedId === w.id,
        sourceIds: local.filter((s) => sources.includes(s)).map((s) => s.id),
        selection: String(w.props.selected ?? w.props.query ?? ""),
        scroll: readingProgress.get(w.id) ?? 0,
      };
    });
  const semanticKey = hash({
    studyMode,
    task,
    windows: [...windows]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((w) => [w.id, w.sourceIds, w.selection]),
    sources: [...sources].sort((a, b) => a.id.localeCompare(b.id)),
    feedback,
    behaviour: events
      .filter((e) =>
        ["window.focus", "files.search", "files.open"].includes(e.type),
      )
      .slice(-5)
      .map((e) => [e.type, e.windowId, e.data]),
  });
  return {
    studyMode,
    version: 1,
    key: hash([semanticKey, [...selectedIds].sort()]),
    semanticKey,
    task,
    selectedIds: [...selectedIds].sort(),
    focusedId: state.focusedId,
    work,
    windows,
    sources,
    activity: events
      .filter((e) => !e.type.endsWith("hover"))
      .slice(-10)
      .map((e) => ({
        type: e.type,
        windowId: e.windowId,
        detail: JSON.stringify(e.data ?? {}).slice(0, 100),
      })),
    feedback,
  };
}
