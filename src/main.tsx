import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Register the service worker (autoUpdate): a new build silently takes over on
// the next load, so the offline-capable app shell stays current. This lives in
// main.tsx only — no test imports main.tsx, so the virtual module never needs a
// mock in the unit suite.
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Theme-locked to dark (html.dark). forcedTheme keeps sonner + any
        next-themes consumer rendering the dark palette. */}
    <ThemeProvider attribute="class" forcedTheme="dark" enableSystem={false}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
