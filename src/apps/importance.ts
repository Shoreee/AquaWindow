import type { ImportanceRegion } from '../kernel/types';

/**
 * Default importance regions per app, normalised to the content box.
 * They mirror each app's actual layout so cut-outs, the agent and metrics agree.
 */
export function defaultImportance(appId: string): ImportanceRegion[] {
  switch (appId) {
    case 'preview':
      return [
        { id: 'figure', x: 0.07, y: 0.43, w: 0.86, h: 0.26, weight: 0.8, label: 'Figure 3' },
        { id: 'table', x: 0.07, y: 0.72, w: 0.86, h: 0.24, weight: 1, label: 'Table 2' },
      ];
    case 'writer':
      return [{ id: 'caret', x: 0.08, y: 0.34, w: 0.84, h: 0.26, weight: 1, label: 'paragraph you are writing' }];
    case 'meeting':
      return [{ id: 'speaker', x: 0.02, y: 0.04, w: 0.96, h: 0.62, weight: 0.9, label: 'speaker' }];
    case 'share':
      return [{ id: 'slide', x: 0.04, y: 0.05, w: 0.92, h: 0.9, weight: 0.9, label: 'current slide' }];
    case 'tile':
      return [{ id: 'face', x: 0.1, y: 0.05, w: 0.8, h: 0.9, weight: 0.7, label: 'presenter' }];
    case 'tutorial':
      return [{ id: 'video', x: 0, y: 0, w: 1, h: 0.78, weight: 0.9, label: 'video' }];
    case 'canvas':
      return [{ id: 'drawing', x: 0.12, y: 0.12, w: 0.76, h: 0.74, weight: 1, label: 'drawing area' }];
    case 'refimage':
      return [{ id: 'image', x: 0, y: 0, w: 1, h: 1, weight: 0.6, label: 'reference' }];
    case 'browser':
      return [{ id: 'article', x: 0.06, y: 0.14, w: 0.88, h: 0.5, weight: 0.7, label: 'article' }];
    case 'terminal':
      return [{ id: 'tail', x: 0, y: 0.55, w: 1, h: 0.45, weight: 0.7, label: 'latest output' }];
    default:
      return [];
  }
}
