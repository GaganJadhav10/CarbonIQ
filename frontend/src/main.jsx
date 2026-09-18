import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// Self-hosted per DESIGN.md §3.2 — not loaded from a CDN at runtime.
import '@fontsource-variable/source-serif-4';
import '@fontsource-variable/public-sans';

import App from './App';
import Toaster from './components/Toaster';
import { AuthProvider } from './lib/auth';
import { ThemeProvider } from './lib/theme';

import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Toaster>
            <App />
          </Toaster>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
