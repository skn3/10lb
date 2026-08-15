import { AppService } from './features/app/classes/appService.js';

AppService.init().catch((e) => {
  const app = document.getElementById('app');
  const msg = String(e.message || e).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  app.innerHTML = `<div class="card"><p class="error">Failed to initialize app.</p><pre>${msg}</pre></div>`;
});
