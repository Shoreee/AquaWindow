import { createRoot } from 'react-dom/client';
import './styles/base.css';
import './styles/shell.css';
import './styles/apps.css';
import './styles/agent.css';
import { agent, kernel, ui } from './system';
import { loadScenario } from './scenarios/director';
import { bootDesktop } from './shell/SystemChrome';
import { adaptation, planBuffer } from './agent/adaptive/runtime';
import { Desktop } from './shell/Desktop';

if (import.meta.env.DEV) (window as unknown as { __aw: unknown }).__aw = { kernel, agent, ui, adaptation, planBuffer };

createRoot(document.getElementById('root')!).render(<Desktop />);

// ?s=glance&st=D deep-links a scenario × design (handy for studies and screenshots).
const q = new URLSearchParams(location.search);
if (import.meta.env.DEV && q.get('dev') === '1' && q.get('s')) loadScenario(q.get('s')!, q.get('st') ?? undefined);
else bootDesktop();
