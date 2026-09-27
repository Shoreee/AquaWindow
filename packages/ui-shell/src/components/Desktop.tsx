import { useEffect, useMemo, useState } from 'react';
import type { FieldWindow } from '@aquawindow/fluid-field';
import { stepSolver } from '@aquawindow/fluid-field';
import { useShell } from '../hooks/useShell.js';
import { isInteracting, setMenu, solverConfigFor, store, toggleConsole } from '../runtime.js';
import { AutonomyDial } from './AutonomyDial.js';
import { Dock } from './Dock.js';
import { FieldLayer } from './FieldLayer.js';
import { GhostLayer } from './GhostLayer.js';
import { MenuBar } from './MenuBar.js';
import { ResearcherConsole } from './ResearcherConsole.js';
import { Timeline } from './Timeline.js';
import { WindowChrome } from './WindowChrome.js';

export function Desktop() {
  const shell = useShell();
  const [peek, setPeek] = useState({ x: 0.5, y: 0.5 });
  const [pressure, setPressure] = useState<Record<string, number>>({});

  useEffect(() => {
    const onResize = () => {
      store.setBounds({
        x: 0,
        y: 28,
        width: window.innerWidth,
        height: window.innerHeight - 28 - 78,
      });
    };
    onResize();
    window.addEventListener('resize', onResize);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '`') {
        e.preventDefault();
        toggleConsole();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    const config = solverConfigFor(shell.condition);
    if (!config.enabled) return;
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      if (t - last > 80) {
        last = t;
        const windows = store.getWindows();
        const result = stepSolver(windows, store.getBounds(), config);
        setPressure(result.pressure);
        if (!isInteracting()) {
          for (const [id, rect] of Object.entries(result.rects)) {
            const live = windows.find((w) => w.id === id);
            if (!live || live.pinned || live.status !== 'normal') continue;
            const dx = Math.abs(live.rect.x - rect.x) + Math.abs(live.rect.y - rect.y);
            const ds = Math.abs(live.rect.width - rect.width) + Math.abs(live.rect.height - rect.height);
            if (dx + ds > 6) {
              store.dispatch({ type: 'resize', id, rect }, 'system');
            }
          }
          for (const pair of result.fuse) {
            store.dispatch({ type: 'fuse', ids: pair }, 'system');
          }
          for (const id of result.split) {
            store.dispatch({ type: 'split', id }, 'system');
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [shell.condition]);

  const fieldWindows: FieldWindow[] = useMemo(
    () =>
      shell.windows
        .filter((w) => w.status !== 'minimized')
        .map((w) => ({
          id: w.id,
          rect: w.rect,
          groupId: w.groupId,
          pinned: w.pinned,
          depth: w.depth,
          pressure: pressure[w.id] ?? 0,
        })),
    [shell.windows, pressure],
  );

  const fluid = shell.condition === 'fluid' || shell.condition === 'fluid-agent';

  return (
    <div
      className="aw-desktop"
      onPointerMove={(e) => setPeek({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight })}
      onPointerDown={(e) => {
        const el = e.target as HTMLElement;
        if (el.classList.contains('aw-desktop') || el.classList.contains('aw-wallpaper-grain')) {
          setMenu(null);
        }
      }}
    >
      <div className="aw-wallpaper-grain" />
      <FieldLayer windows={fieldWindows} enabled={fluid} />
      <MenuBar />
      {shell.windows.length === 0 && (
        <div className="aw-ghostbar" style={{ bottom: 'auto', top: '28%' }}>
          <strong>AquaWindow · Fluid Territories</strong>
          <p>A research desktop for agent-negotiated window boundaries. Open a scenario from the menu, or click the Dock.</p>
          <small>Press ` for the researcher console · ⌘Z undo</small>
        </div>
      )}
      {shell.windows.map((w) => (
        <WindowChrome key={w.id} window={w} fluid={fluid} depthEnabled={shell.depthEnabled} peek={peek} />
      ))}
      <GhostLayer proposal={shell.proposal} windows={shell.windows} autonomy={shell.autonomy} />
      <AutonomyDial />
      <Timeline />
      <Dock />
      <ResearcherConsole />
    </div>
  );
}
