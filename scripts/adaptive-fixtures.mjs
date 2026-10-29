// Deterministic test server response, never imported by the shipped application.
export function fixturePlans(context) {
  const primary = context.selectedIds.length
    ? context.selectedIds
    : [
        context.windows.find(
          (w) => w.app === (context.task === "files" ? "finder" : "writer"),
        )?.id ?? context.windows[0].id,
      ];
  const supports = context.windows
    .filter((w) => !primary.includes(w.id))
    .map((w) => w.id)
    .slice(0, 2);
  const sources = context.sources.filter((s) =>
    context.task === "files"
      ? s.kind === "file"
      : s.kind === "paper" || s.kind === "table",
  );
  if (!sources.length) return [];
  const a = sources[0],
    b = sources[1] ?? a;
  const artifact = (id, source, title) => ({
    id,
    kind: context.task === "files" ? "files" : "evidence",
    title,
    body:
      context.task === "files"
        ? `候选文件：${source.title}\n${source.text}`
        : `${source.text}\n（内置论文演示数据）`,
    sourceIds: [source.id],
  });
  const one = artifact(
    "a",
    a,
    context.task === "files" ? "按来源整理候选" : "摘要依据",
  );
  const two = artifact(
    "b",
    b,
    context.task === "files" ? "另一条文件线索" : "表格对照",
  );
  const merged = {
    id: "c",
    kind: "summary",
    title: "合并判断",
    body:
      context.task === "files"
        ? `两条线索来自 ${a.title} 与 ${b.title}，保留路径和任务来源供核对。`
        : "两处依据来自同一篇演示论文：对照摘要与表格，保留表格中的 41.2 s 与 57.9 s，后续写入笔记前可核对来源。",
    sourceIds: [...new Set([a.id, b.id])],
  };
  return [
    {
      id: "local-evidence",
      title:
        context.task === "files" ? "把文件线索放在手边" : "把证据留在段落旁",
      rationale: "保留主窗口，沿边缘展开有来源的结果，相关窗口轻量让位。",
      priority: 0.95,
      confidence: 0.95,
      primaryTargets: primary,
      supportTargets: supports,
      steps: [
        { type: "yield", targets: primary, direction: "left", amount: 0.2 },
        {
          type: "peel",
          targets: primary,
          edge: "right",
          extent: 0.4,
          artifactIds: ["a"],
        },
        { type: "anchor", targets: primary, edge: "right", artifactIds: ["a"] },
      ],
      artifacts: [one],
    },
    {
      id: "compare-and-merge",
      title: "并行对照，再汇成结论",
      rationale: "分别读取两处来源，汇合后保留可追溯的判断。",
      priority: 0.8,
      confidence: 0.9,
      primaryTargets: primary,
      supportTargets: supports,
      steps: [
        {
          type: "branch",
          targets: primary,
          branches: [
            {
              id: "read-a",
              targetId: primary[0],
              sourceIds: [a.id],
              artifactId: "a",
            },
            {
              id: "read-b",
              targetId: primary[0],
              sourceIds: [b.id],
              artifactId: "b",
            },
          ],
        },
        {
          type: "merge",
          targets: primary,
          artifactIds: ["a", "b"],
          resultId: "c",
        },
        {
          type: "permeate",
          targets: primary,
          depth: 0,
          artifactIds: ["a", "b", "c"],
        },
      ],
      artifacts: [one, two, merged],
    },
    {
      id: "carry-session",
      title: "收起这一段思绪",
      rationale: "把相关窗口与阅读位置收成一个可恢复的会话。",
      priority: 0.65,
      confidence: 0.9,
      primaryTargets: primary,
      supportTargets: supports,
      steps: [
        {
          type: "encapsulate",
          targets: [...primary, ...supports],
          edge: "right",
        },
      ],
      artifacts: [],
    },
  ];
}
