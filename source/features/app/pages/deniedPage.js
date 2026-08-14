// =============================================================================
// DENIED PAGE
// =============================================================================
import { SubmitButton } from '../../../shared/components/submitButton.js';

export function renderDeniedPage() {
  return `<div class="card"><h2>Access denied</h2><p class="error">You do not have permission to view this page.</p>${SubmitButton.render({ text: 'Go back', icon: 'arrow_back', theme: 'secondary', attrs: { 'data-go': 'overview' } })}</div>`;
}
