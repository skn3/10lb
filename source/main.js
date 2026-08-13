import { App } from './app.js';

App.init().catch((e) => {
  const app = document.getElementById('app');
  app.innerHTML = `<div class="card"><p class="error">Failed to initialize app.</p><pre>${String(e.message || e)}</pre></div>`;
});
