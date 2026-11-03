import { createStore } from '../system/createStore';
import { kernel } from '../system/kernel';

export type StudyTaskId = 'comparison' | 'screenshot' | 'bilingual' | 'external' | 'citation' | 'answer';
export type StudyResource = { id: string; title: string; url: string; kind: 'pdf' | 'image' };
export type StudyAnswerExample = { question: string; sentences: string[] };

const studyRoot = `${import.meta.env.BASE_URL}study/`;
const attentionRoot = studyRoot + 'attention-zh/';
const attentionZh = { id: 'pdf', title: 'Attention Is All You Need 中文版.pdf', url: attentionRoot + 'Attention-Is-All-You-Need-zh.pdf', kind: 'pdf' } as const;

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
    title: '阅读 Attention Is All You Need 中文版',
    description: '请完成两组内容对照：',
    steps: ['第 3 节的模型架构说明与图 1 Transformer 架构图。', '第 4 节提到的附录注意力可视化与附录图 3。'],
    resources: [
      attentionZh,
      { id: 'methodology', title: '模型架构说明.png', url: studyRoot + 'attention-zh/model-description.png', kind: 'image' },
      { id: 'architecture', title: '图1 Transformer 架构图.png', url: studyRoot + 'attention-zh/architecture.png', kind: 'image' },
      { id: 'appendix-reference', title: '正文提及附录部分.png', url: studyRoot + 'attention-zh/appendix-reference.png', kind: 'image' },
      { id: 'appendix', title: '附录图3 注意力可视化.png', url: studyRoot + 'attention-zh/appendix-visualization.png', kind: 'image' },
    ],
  },
  screenshot: {
    label: '任务 02 · 截图转移',
    switchLabel: '任务 02',
    title: '截图转移',
    description: '目标图像是《Attention Is All You Need》中文版第 3 页的图 1：Transformer 模型架构图。',
    steps: ['从“文件”打开中文版论文，找到图 1。', '截取该图，粘贴或拖入 AI 问答窗口，再切回论文原来的阅读位置。'],
    resources: [attentionZh],
  },
  bilingual: {
    label: '任务 03 · 临时中英对照',
    switchLabel: '任务 03',
    title: '临时中英对照',
    description: '阅读中文版论文时，遇到表达不清的地方，临时查看英文原文，再回到刚才的中文阅读位置。',
    steps: ['从“文件”打开中文版和英文版论文。', '在两个窗口之间切换或并排对照，保持各自的阅读位置。'],
    resources: [
      { id: 'chinese-pdf', title: 'Attention Is All You Need 中文版.pdf', url: attentionRoot + 'Attention-Is-All-You-Need-zh.pdf', kind: 'pdf' },
      { id: 'english-pdf', title: 'Attention Is All You Need 英文版.pdf', url: attentionRoot + 'Attention-Is-All-You-Need-en.pdf', kind: 'pdf' },
    ],
  },
  external: {
    label: '任务 04 · 外部材料与返回',
    switchLabel: '任务 04',
    title: '打开外部材料并返回',
    description: '阅读《Attention Is All You Need》时，在浏览器中查找 Google Research 的 Transformer 介绍文章和该论文的 arXiv 页面，浏览后回到原来的阅读位置。',
    steps: ['从“文件”打开中文版论文，移动到需要查看外部材料的页面。', '从 Dock 打开“浏览器”，自行搜索 Transformer: A Novel Neural Network Architecture for Language Understanding 和 Attention Is All You Need arXiv。', '通过普通窗口切换回论文，继续刚才的页码和页内位置。'],
    resources: [attentionZh],
  },
  citation: {
    label: '任务 05 · 返回引用来源',
    switchLabel: '任务 05',
    title: '返回引用来源',
    description: '从《Attention Is All You Need》查找并阅读引用文献，再通过普通窗口切换回主论文原来的位置。',
    steps: ['从“文件”打开中文版论文，在第 3.2 节找到加性注意力相关的引用 [2]，并在参考文献中确认其篇名。', '在“文件”中自行找到 Neural Machine Translation by Jointly Learning to Align and Translate。', '打开引用论文阅读后，通过普通窗口切换回主论文，继续原来的页码与页内位置。'],
    resources: [
      attentionZh,
      { id: 'bahdanau', title: 'Neural Machine Translation by Jointly Learning to Align and Translate.pdf', url: attentionRoot + 'Neural-Machine-Translation-by-Jointly-Learning-to-Align-and-Translate.pdf', kind: 'pdf' },
    ],
  },
  answer: {
    label: '任务 06 · AI 回答与原文',
    switchLabel: '任务 06',
    title: 'AI 回答与原文逐句对应',
    description: '对照 AI 问答窗口中的实验示例回答，逐句找到《Attention Is All You Need》中文版原文中的依据。',
    steps: ['从“文件”打开中文版论文，再从 Dock 打开“AI 问答”。', '逐句核对示例回答与论文原文；可在“笔记”记录对应位置或存疑之处。', '在两个窗口之间切换时，保持原文阅读位置。'],
    resources: [attentionZh],
    // Researcher answer key: docs/research/task-06-answer-key.md.
    qaExample: {
      question: 'Transformer 的主要结构和注意力机制是怎样设计的？',
      sentences: [
        'Transformer 的编码器由六个相同的层堆叠而成，每层包含多头自注意力和逐位置前馈网络。',
        '解码器同样由六层堆叠而成，并额外通过一个注意力子层关注编码器的输出。',
        '缩放点积注意力先计算查询与键的点积，再除以键的维度平方根并经过 softmax，最后对值加权求和。',
        '多头注意力把查询、键和值投影到多个空间，并行计算各个注意力头后再拼接和投影。',
        '由于模型没有循环或卷积结构，编码器和解码器在输入嵌入中加入位置编码来提供序列顺序信息。',
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
