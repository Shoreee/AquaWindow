import type { AutonomyLevel } from '@aquawindow/agent-sdk';
import { useShell } from '../hooks/useShell.js';
import { setAutonomy } from '../runtime.js';

const LEVELS: AutonomyLevel[] = ['off', 'suggest', 'preview', 'auto-with-undo'];

export function AutonomyDial() {
  const { autonomy, condition } = useShell();
  const disabled = condition !== 'fluid-agent';
  const index = LEVELS.indexOf(autonomy);

  return (
    <aside className="aw-dial">
      <strong>Autonomy</strong>
      <p>{disabled ? 'Agent gated (change condition)' : autonomy}</p>
      <input
        type="range"
        min={0}
        max={3}
        value={index}
        disabled={disabled}
        onChange={(e) => setAutonomy(LEVELS[Number(e.target.value)] ?? 'off')}
      />
      <small>off · suggest · preview · auto+undo</small>
    </aside>
  );
}
