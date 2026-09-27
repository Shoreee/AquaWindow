import type { ComponentType } from 'react';
import type { WindowRole, WindowState } from '../kernel/types';
import Browser from './Browser';
import Chat from './Chat';
import { Canvas, RefImage } from './Design';
import Finder from './Finder';
import Guide from './Guide';
import LayoutLab from './LayoutLab';
import Meeting, { Share, Tile } from './Meeting';
import Preview from './Preview';
import Sculpt from './Sculpt';
import Terminal, { Code } from './Terminal';
import Tutorial from './Tutorial';
import Writer from './Writer';

export interface AppDef {
  id: string;
  name: string;
  Component: ComponentType<{ win: WindowState; peripheral?: boolean }>;
  size: { w: number; h: number };
  role: WindowRole;
  dock?: boolean;
  defaultProps?: Record<string, unknown>;
  /** Has a meaningful low-fidelity peripheral (capsule) rendering. */
  peripheral?: boolean;
  bare?: boolean;
}

export const APPS: Record<string, AppDef> = {
  guide: { id: 'guide', name: 'AquaWindow Guide', Component: Guide, size: { w: 760, h: 600 }, role: 'system', dock: true },
  finder: { id: 'finder', name: 'Finder', Component: Finder, size: { w: 760, h: 460 }, role: 'tool', dock: true, defaultProps: { path: 'Downloads' } },
  preview: { id: 'preview', name: 'Preview', Component: Preview, size: { w: 600, h: 720 }, role: 'reference', dock: true, defaultProps: { paperId: '2403.11872' }, peripheral: true },
  writer: { id: 'writer', name: 'Pages', Component: Writer, size: { w: 760, h: 700 }, role: 'primary', dock: true, defaultProps: { docId: 'draft' } },
  browser: { id: 'browser', name: 'Wiki', Component: Browser, size: { w: 560, h: 620 }, role: 'reference', dock: true, defaultProps: { pageId: 'window-management' }, peripheral: true },
  chat: { id: 'chat', name: 'Messages', Component: Chat, size: { w: 480, h: 420 }, role: 'scratch', dock: true, peripheral: true },
  meeting: { id: 'meeting', name: 'Meet', Component: Meeting, size: { w: 600, h: 420 }, role: 'awareness', dock: true, peripheral: true },
  share: { id: 'share', name: 'Shared Screen', Component: Share, size: { w: 700, h: 440 }, role: 'awareness', peripheral: true, defaultProps: { presenter: 'Lin' } },
  tile: { id: 'tile', name: 'Camera', Component: Tile, size: { w: 220, h: 170 }, role: 'awareness', defaultProps: { person: 'Lin' } },
  tutorial: { id: 'tutorial', name: 'Tutorial', Component: Tutorial, size: { w: 580, h: 420 }, role: 'reference', dock: true },
  sculpt: { id: 'sculpt', name: 'Sculpt', Component: Sculpt, size: { w: 1100, h: 720 }, role: 'primary', dock: true },
  canvas: { id: 'canvas', name: 'Canvas', Component: Canvas, size: { w: 900, h: 700 }, role: 'primary', dock: true },
  refimage: { id: 'refimage', name: 'Reference', Component: RefImage, size: { w: 260, h: 180 }, role: 'reference', defaultProps: { tag: 'light', seed: 9 }, bare: true },
  terminal: { id: 'terminal', name: 'Terminal', Component: Terminal, size: { w: 680, h: 440 }, role: 'tool', dock: true },
  code: { id: 'code', name: 'Code', Component: Code, size: { w: 560, h: 440 }, role: 'reference' },
  lab: { id: 'lab', name: 'Layout Lab', Component: LayoutLab, size: { w: 820, h: 620 }, role: 'system', dock: true },
};

export const appName = (id: string) => APPS[id]?.name ?? id;
