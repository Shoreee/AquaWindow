import type { ComponentType } from 'react';
import type { Size } from '@aquawindow/wm-kernel';

export interface AppManifest {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  accent: string;
  semanticTags: string[];
  minSize: Size;
  defaultSize: Size;
  scenario: 'files' | 'papers' | 'meeting' | 'tutorial' | 'design' | 'system';
  component: ComponentType<{ windowId: string }>;
}

export interface AppHost {
  manifests(): AppManifest[];
  get(id: string): AppManifest | undefined;
}

export function createAppHost(apps: AppManifest[]): AppHost {
  const map = new Map(apps.map((a) => [a.id, a]));
  return {
    manifests: () => apps,
    get: (id) => map.get(id),
  };
}
