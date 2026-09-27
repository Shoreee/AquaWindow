import { area, intersectionArea, rectsIntersect } from './geometry.js';
import type { OcclusionInfo, WindowState } from './types.js';

/** Visible ratio of each normal/maximized window, considering higher-z occluders. */
export function computeOcclusion(windows: WindowState[]): OcclusionInfo[] {
  const visible = windows.filter((w) => w.status !== 'minimized');
  const sorted = [...visible].sort((a, b) => a.z - b.z);

  return sorted.map((win, index) => {
    const selfArea = area(win.rect);
    if (selfArea <= 0) {
      return { id: win.id, visibleRatio: 0, occludedBy: [] };
    }

    const above = sorted.slice(index + 1).filter((other) => rectsIntersect(win.rect, other.rect));
    let covered = 0;
    const occludedBy: string[] = [];
    for (const other of above) {
      const overlap = intersectionArea(win.rect, other.rect);
      if (overlap > 0) {
        covered += overlap;
        occludedBy.push(other.id);
      }
    }

    return {
      id: win.id,
      visibleRatio: Math.max(0, 1 - covered / selfArea),
      occludedBy,
    };
  });
}

export function isFullyOccluded(info: OcclusionInfo, epsilon = 0.02): boolean {
  return info.visibleRatio <= epsilon;
}
