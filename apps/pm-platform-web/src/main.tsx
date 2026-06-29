import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showBootError(title: string, message: unknown, stack?: unknown) {
  const root = document.getElementById('root') ?? document.body;
  root.innerHTML = `
    <div style="min-height:100vh;display:grid;place-items:center;background:#f8fafc;color:#0f172a;font-family:Inter,ui-sans-serif,system-ui,sans-serif;padding:24px">
      <div style="max-width:960px;width:100%;border:1px solid #fecaca;background:#fff1f2;border-radius:16px;padding:24px;box-shadow:0 16px 40px rgba(15,23,42,.12)">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#be123c;font-weight:700">PM Platform frontend error</div>
        <h1 style="font-size:24px;margin:8px 0 12px 0">${escapeHtml(title)}</h1>
        <pre style="white-space:pre-wrap;word-break:break-word;background:white;border:1px solid #fecaca;border-radius:12px;padding:16px;color:#991b1b;font-size:13px;line-height:1.5">${escapeHtml(message)}\n\n${escapeHtml(stack)}</pre>
        <p style="font-size:13px;color:#64748b;margin-top:12px">Open DevTools → Console for the complete stack trace. This screen is intentionally shown instead of a blank white page.</p>
      </div>
    </div>
  `;
}

window.addEventListener('error', (event) => {
  showBootError('Runtime error', event.error?.message ?? event.message, event.error?.stack);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason as any;
  showBootError('Unhandled promise rejection', reason?.message ?? reason, reason?.stack);
});

const theme = localStorage.getItem('theme');
if (theme === 'dark') document.documentElement.classList.add('dark');

const rootElement = document.getElementById('root');
if (!rootElement) {
  showBootError('Missing root element', 'index.html does not contain #root');
} else {
  import('./App')
    .then(({ default: App }) => {
      ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
    })
    .catch((error) => {
      showBootError('Application module failed to load', error?.message ?? error, error?.stack);
    });
}
