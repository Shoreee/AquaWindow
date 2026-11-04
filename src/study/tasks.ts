import { createStore } from '../system/createStore';
import { kernel } from '../system/kernel';

export type StudyTaskId = 'comparison' | 'bilingual' | 'external' | 'answer';
export type StudyResource = { id: string; title: string; url: string; kind: 'pdf' | 'image' };
export type StudyAnswerExample = { question: string; sentences: string[]; requireImage?: boolean };

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
  bilingualPrompt?: {chinese:string;english:string};
}> = {
  comparison: {
    label: '图文对照',
    switchLabel: '图文对照',
    title: '图文对照',
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
  bilingual: {
    label: '中英对照',
    switchLabel: '中英对照',
    title: '临时中英对照',
    description: '根据下面的中文论述，在英文版论文中找到对应原文，将英文原文复制到答题框。',
    steps: ['从文件打开中文版和英文版论文，找到对应段落。', '复制对应的英文原文并提交。'],
    bilingualPrompt:{chinese:'编码器由 N = 6 个相同的层堆栈组成。每一层有两个子层。',english:'The encoder is composed of a stack of N = 6 identical layers. Each layer has two sub-layers.'},
    resources: [
      { id: 'chinese-pdf', title: 'Attention Is All You Need 中文版.pdf', url: attentionRoot + 'Attention-Is-All-You-Need-zh.pdf', kind: 'pdf' },
      { id: 'english-pdf', title: 'Attention Is All You Need 英文版.pdf', url: attentionRoot + 'Attention-Is-All-You-Need-en.pdf', kind: 'pdf' },
    ],
  },
  external: {
    label: '外部材料与引用来源',
    switchLabel: '外部材料与引用来源',
    title: '打开外部材料并返回引用来源',
    description: '阅读《Attention Is All You Need》时，查阅它的 arXiv 页面和正文引用的文献，随后回到主论文原来的阅读位置。',
    steps: ['从“文件”打开中文版论文，记住当前阅读位置。', '从 Dock 打开“浏览器”，自行搜索 Attention Is All You Need arXiv 并查看论文页面。', '回到主论文，在第 3.2 节找到加性注意力的引用 [2]，从参考文献确认完整篇名，再在“文件”中自行找到并打开该文献。', '阅读引用文献后，通过普通窗口切换回主论文原来的页码与页内位置，完成引用与论点连线。'],
    resources: [
      attentionZh,
      { id: 'bahdanau', title: 'Neural Machine Translation by Jointly Learning to Align and Translate.pdf', url: attentionRoot + 'Neural-Machine-Translation-by-Jointly-Learning-to-Align-and-Translate.pdf', kind: 'pdf' },
    ],
  },
  answer: {
    label: '回答核对',
    switchLabel: '回答核对',
    title: '图像问答与原文核对',
    description: '把论文中的 Transformer 架构图作为图片发给 AI 问答，对照图和正文核对实验示例回答。',
    steps: ['从“文件”打开中文版论文，找到第 3 页图 1 的 Transformer 架构图。', '截图并从“图库”打开，将图片拖入或粘贴到“AI 问答”输入区，附上问题后发送。', '对照架构图与正文，判断示例回答中不准确的论述并提交答案。'],
    resources: [attentionZh],
    // Researcher answer key: docs/research/task-06-answer-key.md.
    qaExample: {
      question: '请根据这张架构图说明编码器、解码器和输出层。',
      requireImage: true,
      sentences: [
        '图左侧是编码器，右侧是解码器。',
        '编码器和解码器都包含带掩码的多头注意力。',
        'Linear 后接 Softmax，输出词汇概率。',
      ],
    },
  },
};

export const studyTaskStore = createStore<{ current: StudyTaskId }>({ current: 'comparison' });

export function switchStudyTask(next: StudyTaskId) {
  if (studyTaskStore.get().current === next) return;
  for(const win of kernel.list())if(win.appId!=='experiment')kernel.close(win.id,'system');
  studyTaskStore.set({ current: next });
}
