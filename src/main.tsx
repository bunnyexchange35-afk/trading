/** Application entry. Fresh frontend — the previous App.tsx tree is retired. */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './app/router';

import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';
import './styles/shell.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root container in index.html');

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  </StrictMode>,
);
