import { createRoot } from 'react-dom/client';
import './styles/base.css';
import './styles/shell.css';
import './styles/apps.css';
import { agent, kernel, ui } from './system';
import { loadScenario } from './scenarios/director';
import { boot } from './shell/Chrome';
import { Desktop } from './shell/Desktop';

if (import.meta.env.DEV) (window as unknown as { __aw: unknown }).__aw = { kernel, agent, ui };

createRoot(document.getElementById('root')!).render(<Desktop />);

// ?s=glance&st=D deep-links a scenario × design (handy for studies and screenshots).
const q = new URLSearchParams(location.search);
if (q.get('s')) loadScenario(q.get('s')!, q.get('st') ?? undefined);
else boot();
