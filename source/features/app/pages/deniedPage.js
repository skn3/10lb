// =============================================================================
// DENIED PAGE
// =============================================================================
import { SubmitButton } from '../../../shared/components/submitButton.js';

export function renderDeniedPage() {
  return `<div class="card"><h2>Access denied</h2><p class="error">You do not have permission to view this page.</p>${SubmitButton.render({ text: 'Go back', icon: 'arrow_back', theme: 'secondary', attrs: { 'data-go': 'overview' } })}</div>`;
}

export function DeniedPage({ app }) {
  const e = window.React.createElement;
  return e('div', { className: 'card' },
    e('h2', null, 'Access denied'),
    e('p', { className: 'error' }, 'You do not have permission to view this page.'),
    e('button', { type: 'button', className: 'btn secondary', onClick: () => app.navigate('overview') },
      e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'arrow_back'),
      ' Go back'
    )
  );
}
