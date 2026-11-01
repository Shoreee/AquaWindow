import { createStore } from '../system/createStore';
import { kernel } from '../system/kernel';

export type StudyTaskId = 'comparison' | 'screenshot' | 'bilingual' | 'external' | 'citation' | 'answer';
export type StudyResource = { id: string; title: string; url: string; kind: 'pdf' | 'image' | 'web' };
export type StudyAnswerExample = { question: string; sentences: string[] };

const externalRoot = '/study/external/';
const bilibiliSnapshot = 'AutoUE_ Automated 3D Game Generation in Unreal Engine via Multi-Agent Systems_哔哩哔哩_bilibili.html';

export const studyTasks: Record<StudyTaskId, {
  label: string;
  switchLabel: string;
  title: string;
  description: string;
  steps: string[];
  resources: StudyResource[];
  qaExample?: StudyAnswerExample;
}> = {
  comparison: {
    label: '任务 01 · 内容对照',
    switchLabel: '任务 01',
    title: '阅读 AutoUE',
    description: '请完成两组内容对照：',
    steps: ['方法论中的系统说明与架构图。', '正文提到的附录内容与对应附录图。'],
    resources: [
      { id: 'pdf', title: 'AutoUE.pdf', url: '/study/auto-ue/AutoUE.pdf', kind: 'pdf' },
      { id: 'methodology', title: '方法论.png', url: '/study/auto-ue/methodology.png', kind: 'image' },
      { id: 'architecture', title: '架构图.png', url: '/study/auto-ue/architecture.png', kind: 'image' },
      { id: 'appendix-reference', title: '正文提及附录部分.png', url: '/study/auto-ue/appendix-reference.png', kind: 'image' },
      { id: 'appendix', title: '附录.png', url: '/study/auto-ue/appendix.png', kind: 'image' },
    ],
  },
  screenshot: {
    label: '任务 02 · 截图转移',
    switchLabel: '任务 02',
    title: '截图转移',
    description: '在论文中找到目标图像，截图并转移到 AI 问答窗口，再返回原来的阅读位置。',
    steps: ['从“文件”打开 AutoUE.pdf。', '将目标图像截图，粘贴或拖入 AI 问答窗口。'],
    resources: [
      { id: 'pdf', title: 'AutoUE.pdf', url: '/study/screenshot-transfer/AutoUE.pdf', kind: 'pdf' },
      { id: 'figure-reference', title: '目标图参考.png', url: '/study/screenshot-transfer/figure-reference.png', kind: 'image' },
    ],
  },
  bilingual: {
    label: '任务 03 · 临时中英对照',
    switchLabel: '任务 03',
    title: '临时中英对照',
    description: '阅读中文版论文时，遇到表达不清的地方，临时查看英文原文，再回到刚才的中文阅读位置。',
    steps: ['从“文件”打开中文版和英文版论文。', '在两个窗口之间切换或并排对照，保持各自的阅读位置。'],
    resources: [
      { id: 'chinese-pdf', title: 'Constraint Is All You Need 中文版.pdf', url: '/study/bilingual/constraint-zh.pdf', kind: 'pdf' },
      { id: 'english-pdf', title: 'Constraint Is All You Need.pdf', url: '/study/bilingual/constraint-en.pdf', kind: 'pdf' },
    ],
  },
  external: {
    label: '任务 04 · 外部材料与返回',
    switchLabel: '任务 04',
    title: '打开外部材料并返回',
    description: '阅读 AutoUE 时打开演示视频页或项目仓库，浏览后返回论文，继续刚才的位置。',
    steps: ['从“文件”打开 AutoUE.pdf，移动到需要查看外部材料的页面。', '通过论文窗口的“相关材料”打开离线网页存档。', '点击“返回论文”，确认页码和缩放保持不变。'],
    resources: [
      { id: 'pdf', title: 'AutoUE.pdf', url: externalRoot + 'AutoUE.pdf', kind: 'pdf' },
      { id: 'bilibili', title: 'AutoUE 演示视频页 · Bilibili', url: externalRoot + encodeURIComponent(bilibiliSnapshot), kind: 'web' },
      { id: 'github', title: 'AutoUE 项目仓库 · GitHub', url: externalRoot + 'Pluto156_AutoUE.html', kind: 'web' },
    ],
  },
  citation: {
    label: '任务 05 · 返回引用来源',
    switchLabel: '任务 05',
    title: '返回引用来源',
    description: '从 AutoUE 查看引用论文，再返回主论文原来的阅读位置。',
    steps: ['从“文件”打开 AutoUE.pdf，定位需要查阅的引用。', '通过论文窗口的“引用文献”打开 TexVerse 或 UnrealLLM。', '浏览后点击“返回 AutoUE”，继续原来的页码与页内位置。'],
    resources: [
      { id: 'pdf', title: 'AutoUE.pdf', url: externalRoot + 'AutoUE.pdf', kind: 'pdf' },
      { id: 'texverse', title: 'TexVerse.pdf', url: '/study/citations/TexVerse.pdf', kind: 'pdf' },
      { id: 'unrealllm', title: 'UnrealLLM.pdf', url: '/study/citations/UnrealLLM.pdf', kind: 'pdf' },
    ],
  },
  answer: {
    label: '任务 06 · AI 回答与原文',
    switchLabel: '任务 06',
    title: 'AI 回答与原文逐句对应',
    description: '对照 AI 问答窗口中的实验示例回答，逐句找到 AutoUE 原文中的依据。',
    steps: ['从“文件”打开 AutoUE.pdf，再从 Dock 打开“AI 问答”。', '逐句核对示例回答与论文原文；可在“笔记”记录对应位置或存疑之处。', '在两个窗口之间切换时，保持原文阅读位置。'],
    resources: [
      { id: 'pdf', title: 'AutoUE.pdf', url: externalRoot + 'AutoUE.pdf', kind: 'pdf' },
    ],
    // Researcher answer key: docs/research/task-06-answer-key.md.
    qaExample: {
      question: 'AutoUE 的游戏生成流程及评估方式是什么？',
      sentences: [
        '系统先把游戏描述拆分为场景描述和玩法描述。',
        '模型检索以 TexVerse 中超过 85.8 万个带文本描述的 3D 模型为基础，先按类别缩小范围，再依据相似度和重排选出模型。',
        '场景生成使用 UE 的 PCG 图构建布局，并针对大型物体和零散小物体采用不同的放置模式。',
        '玩法生成先规划功能模块，再生成对应的 UE C++ 代码，并结合代码模板和引擎约束提高稳定性。',
        '自动测试会在 UE 运行时执行生成的移动和交互命令，并使用截图与日志参与最终评估。',
      ],
    },
  },
};

export const studyTaskStore = createStore<{ current: StudyTaskId }>({ current: 'comparison' });

export function switchStudyTask(next: StudyTaskId) {
  if (studyTaskStore.get().current === next) return;
  kernel.closeAll();
  studyTaskStore.set({ current: next });
}
