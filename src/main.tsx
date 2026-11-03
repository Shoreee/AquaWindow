import {agentDiagnostics} from './agent/adaptive/diagnostics';
import { createRoot } from 'react-dom/client';
import './styles/base.css';
import './styles/shell.css';
import './styles/apps.css';
import './styles/agent.css';
import './styles/system.css';
import { agent, kernel, ui } from './system';
import { loadScenario } from './scenarios/director';
import { bootDesktop } from './shell/SystemChrome';
import { adaptation, planBuffer,workspaceModel } from './agent/adaptive/runtime';
import { Desktop } from './shell/Desktop';
import {selectStudyMode} from './study/conditions';

if (import.meta.env.DEV) (window as unknown as { __aw: unknown }).__aw = { kernel, agent, ui, adaptation, planBuffer,workspaceModel,agentDiagnostics,selectStudyMode };

createRoot(document.getElementById('root')!).render(<Desktop />);

// ?s=glance&st=D deep-links a scenario × design (handy for studies and screenshots).
const q = new URLSearchParams(location.search);
if (import.meta.env.DEV && q.get('dev') === '1' && q.get('s')) loadScenario(q.get('s')!, q.get('st') ?? undefined);
else bootDesktop();
