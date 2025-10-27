import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initCustomAlerts } from './lib/customAlerts'

// Initialize custom alert/confirm dialogs
initCustomAlerts()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register service worker for PWA functionality
const ENABLE_SERVICE_WORKER = false; // Temporary flag to disable for testing
if (ENABLE_SERVICE_WORKER && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration);
      })
      .catch((error) => {
        console.log('SW registration failed:', error);
      });
  });
}
