import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Desktop } from '@aquawindow/ui-shell';
import '@aquawindow/ui-shell/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Desktop />
  </StrictMode>,
);
