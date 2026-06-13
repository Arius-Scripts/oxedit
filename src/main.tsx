import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { TooltipProvider } from './components/ui/tooltip';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TooltipProvider delayDuration={150} skipDelayDuration={300}>
      <App />
    </TooltipProvider>
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: 'hsl(222 20% 14%)',
          color: 'hsl(210 20% 96%)',
          border: '1px solid hsl(222 16% 22%)',
        },
      }}
    />
    <Analytics />
    <SpeedInsights />
  </React.StrictMode>
);


// If you want to start measuring performance in your app, pass a function