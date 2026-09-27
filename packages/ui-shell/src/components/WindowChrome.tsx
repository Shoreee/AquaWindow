import { useRef, type CSSProperties, type PointerEvent } from 'react';
import type { WindowState } from '@aquawindow/wm-kernel';
import { appHost } from '@aquawindow/apps';
import { localClipPath } from '@aquawindow/fluid-field';
import { setInteracting, store } from '../runtime.js';
import { useShell } from '../hooks/useShell.js';

const HANDLES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const;

interface Props {
  window: WindowState;
  fluid: boolean;
  depthEnabled: boolean;
  peek: { x: number; y: number };
}

export function WindowChrome({ window: win, fluid, depthEnabled, peek }: Props) {
  const shell = useShell();
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const resize = useRef<{ dir: string; sx: number; sy: number; rect: WindowState['rect'] } | null>(null);
  const app = appHost.get(win.appId);
  const Body = app?.component;

  if (win.status === 'minimized') return null;

  const depthScale = depthEnabled ? 1 - win.depth * 0.12 : 1;
  const blur = depthEnabled ? win.depth * 3 : 0;
  const sat = depthEnabled ? 1 - win.depth * 0.28 : 1;
  const parallax = depthEnabled && win.depth > 0 ? (peek.x - 0.5) * 18 * win.depth : 0;
  const parY = depthEnabled && win.depth > 0 ? (peek.y - 0.5) * 10 * win.depth : 0;

  const style: CSSProperties = {
    left: win.rect.x,
    top: win.rect.y,
    width: win.rect.width,
    height: win.rect.height,
    zIndex: 10 + win.z,
    transform: `translate(${parallax}px, ${parY}px) scale(${depthScale})`,
    transformOrigin: 'center center',
    filter: `blur(${blur}px) saturate(${sat})`,
    clipPath: fluid ? localClipPath({ x: 0, y: 0, width: win.rect.width, height: win.rect.height }) : undefined,
    borderRadius: fluid ? 0 : 12,
  };

  function onDragStart(e: PointerEvent) {
    if ((e.target as HTMLElement).closest('.aw-traffic, .aw-pin')) return;
    store.dispatch({ type: 'focus', id: win.id });
    drag.current = { x: e.clientX, y: e.clientY, ox: win.rect.x, oy: win.rect.y };
    setInteracting(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onDragMove(e: PointerEvent) {
    if (!drag.current) return;
    store.dispatch({
      type: 'move',
      id: win.id,
      x: drag.current.ox + e.clientX - drag.current.x,
      y: drag.current.oy + e.clientY - drag.current.y,
    });
  }

  function onResizeStart(dir: string, e: PointerEvent) {
    e.stopPropagation();
    store.dispatch({ type: 'focus', id: win.id });
    resize.current = { dir, sx: e.clientX, sy: e.clientY, rect: { ...win.rect } };
    setInteracting(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onResizeMove(e: PointerEvent) {
    const r = resize.current;
    if (!r) return;
    const dx = e.clientX - r.sx;
    const dy = e.clientY - r.sy;
    let { x, y, width, height } = r.rect;
    if (r.dir.includes('e')) width += dx;
    if (r.dir.includes('s')) height += dy;
    if (r.dir.includes('w')) {
      x += dx;
      width -= dx;
    }
    if (r.dir.includes('n')) {
      y += dy;
      height -= dy;
    }
    store.dispatch({ type: 'resize', id: win.id, rect: { x, y, width, height } });
  }

  return (
    <article
      className={`aw-window ${win.focused ? 'focused' : ''} ${win.pinned ? 'ice' : ''}`}
      style={style}
      onPointerDown={() => {
        if (shell.focusId !== win.id) store.dispatch({ type: 'focus', id: win.id });
      }}
    >
      <header
        className="aw-chrome"
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={() => {
          drag.current = null;
          setInteracting(false);
        }}
        onDoubleClick={() =>
          store.dispatch({ type: win.status === 'maximized' ? 'restore' : 'maximize', id: win.id })
        }
      >
        <div className="aw-traffic">
          <i className="close" onClick={() => store.dispatch({ type: 'close', id: win.id })} />
          <i className="min" onClick={() => store.dispatch({ type: 'minimize', id: win.id })} />
          <i
            className="max"
            onClick={() => store.dispatch({ type: win.status === 'maximized' ? 'restore' : 'maximize', id: win.id })}
          />
        </div>
        <div className="aw-title">
          {app?.icon} {win.title}
        </div>
        <button
          className="aw-pin"
          title={win.pinned ? 'Unpin (melt ice)' : 'Pin as ice'}
          onClick={() => store.dispatch({ type: 'pin', id: win.id, pinned: !win.pinned })}
        >
          {win.pinned ? '❄' : '💧'}
        </button>
      </header>
      <div className="aw-body">{Body ? <Body windowId={win.id} /> : <p className="aw-app">Unknown app</p>}</div>
      {HANDLES.map((dir) => (
        <div
          key={dir}
          className={`aw-handle ${dir}`}
          onPointerDown={(e) => onResizeStart(dir, e)}
          onPointerMove={onResizeMove}
          onPointerUp={() => {
            resize.current = null;
            setInteracting(false);
          }}
        />
      ))}
    </article>
  );
}
