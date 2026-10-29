// Shared semantic state; editors keep their DOM and undo history when layouts change.
export const documentContent = new Map<string, string>();
export const readingProgress = new Map<string, number>();
export const documentSeed: Record<string, string> = {
  draft:
    "正在撰写多窗口知识工作的相关研究。需要对照论文中的实验表格，比较遮挡处理、空间记忆与布局协商，保留证据来源。",
  notes:
    "研究笔记：比较窗口自适应方法的目标、结果与适用条件。哪些证据支持保留阅读主窗口？",
};
