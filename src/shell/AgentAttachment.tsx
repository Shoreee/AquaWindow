import type { AgentMotion } from "../agent/adaptive/choreography";
import { memo, useState } from "react";
import type { AgentView } from "../agent/adaptive/types";

import { kernel } from "../system/kernel";

function AgentAttachmentImpl({
  view,
  expanded,
  onToggle,
  motion,
}: {
  view: AgentView;
  expanded: boolean;
  onToggle(): void;
  motion?: AgentMotion;
}) {
  const [source, setSource] = useState<string | null>(null);
  const ready = motion && ["branch", "merge"].includes(motion.primitive)
    ? (motion.action > .7 ? 2 : motion.action > .2 ? 1 : 0) : 2;
  const result = view.merged
    ? view.artifacts.find((a) => a.id === view.merged)
    : undefined;
  return (
    <>
      <div
        className={`agent-underlay edge-${view.edge} ${expanded ? "expanded" : ""} ${view.layer ? "from-depth" : ""}`}
        data-agent-result
      >
        <div className="agent-result-head">
          <span className="agent-knot" />
          <b>{view.layer ? "后台结果" : "来源预览"} · {view.title}</b>
          <button onClick={onToggle} aria-label="收起协作结果">
            −
          </button>
        </div>
        <div className="agent-result-scroll">

          {view.branches.length > 0 && (
            <div className="agent-branches">
              {view.branches.map((b, i) => (
                <div
                  className={`agent-branch ${ready ? "done" : ""}`}
                  key={b.id}
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  <i />
                  <span>{b.title}</span>
                  <small>
                    {ready ? `${b.sourceIds.length} 处依据` : "读取来源"}
                  </small>
                </div>
              ))}
            </div>
          )}
          {view.artifacts
            .filter((a) => !view.merged || ready >= 2 || a.id !== view.merged)
            .map((a) => (
              <article
                key={a.id}
                className={`agent-artifact ${result?.id === a.id ? "merged-result" : ""}`}
              >
                <h4>{a.title}</h4>
                <p>{a.body}</p>
                <div className="agent-sources">
                  {a.sourceIds.map((id, i) => (
                    <button
                      key={id}
                      onClick={() => setSource(source === id ? null : id)}
                      title={view.sources.find((s) => s.id === id)?.title}
                    >
                      依据 {i + 1}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          {source && (
            <div className="source-excerpt">
              <button onClick={() => setSource(null)} aria-label="关闭来源">
                ×
              </button>
              <b>{view.sources.find((s) => s.id === source)?.title}</b>
              <pre>{view.sources.find((s) => s.id === source)?.text}</pre>
              <button
                onClick={() => {
                  const id = view.sources.find(
                    (s) => s.id === source,
                  )?.windowId;
                  if (id) kernel.focus(id);
                }}
              >
                打开来源窗口
              </button>
            </div>
          )}

        </div>
      </div>
      <div
        className={`agent-fold edge-${view.edge} ${expanded ? "expanded" : ""}`}
      />

    </>
  );
}

/** Kept beside the window shell so its resize hit areas cannot cover the energy entry. */
function AgentAnchorImpl({view,expanded,onToggle}:{view:AgentView;expanded:boolean;onToggle():void}) {
  if(!view.anchored)return null;
  return <button
    className={`agent-anchor edge-${view.edge} ${view.supporting ? "support" : ""}`}
    title={`挂起协作：${view.title}`}
    onClick={onToggle}
    aria-label={expanded ? "收起协作结果" : "展开协作结果"}
  ><span className="agent-knot" /></button>;
}

export {SessionCapsule} from './SessionCapsule';

const resultStage=(motion?:AgentMotion)=>motion&&['branch','merge'].includes(motion.primitive)?(motion.action>.7?2:motion.action>.2?1:0):2;
export const AgentAttachment=memo(AgentAttachmentImpl,(a,b)=>a.view===b.view&&a.expanded===b.expanded&&a.onToggle===b.onToggle&&resultStage(a.motion)===resultStage(b.motion));
export const AgentAnchor=memo(AgentAnchorImpl);
