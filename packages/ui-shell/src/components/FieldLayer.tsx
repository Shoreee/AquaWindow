import { useEffect, useRef } from 'react';
import { FieldRenderer, type FieldWindow } from '@aquawindow/fluid-field';

interface Props {
  windows: FieldWindow[];
  enabled: boolean;
}

export function FieldLayer({ windows, enabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<FieldRenderer | null>(null);
  const frame = useRef(0);

  useEffect(() => {
    if (!canvasRef.current) return;
    try {
      renderer.current = new FieldRenderer(canvasRef.current);
    } catch {
      renderer.current = null;
    }
    return () => {
      renderer.current?.dispose();
      renderer.current = null;
    };
  }, []);

  useEffect(() => {
    const loop = () => {
      const canvas = canvasRef.current;
      const r = renderer.current;
      if (canvas && r) {
        const parent = canvas.parentElement;
        const w = parent?.clientWidth ?? window.innerWidth;
        const h = parent?.clientHeight ?? window.innerHeight;
        r.draw(windows, enabled, w, h);
      }
      frame.current = requestAnimationFrame(loop);
    };
    frame.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame.current);
  }, [windows, enabled]);

  return <canvas ref={canvasRef} className="aw-field" />;
}
