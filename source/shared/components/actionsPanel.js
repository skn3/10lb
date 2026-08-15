import { Utils } from '../utils/utils.js';

// =============================================================================
// ACTIONS PANEL — renders a row of action buttons from a descriptor list.
//
// ActionsPanel.render(actions)
//   actions: { icon, title, route, disabled, color }[]
//     icon    — material symbol name
//     title   — button label
//     route   — value for data-go attribute (used by app's [data-go] handler)
//     disabled — boolean
//     color   — optional CSS class suffix for btn theme, e.g. 'danger', 'secondary'
// =============================================================================
export const ActionsPanel = {
  render(actions = []) {
    if (!actions.length) return '';
    const buttons = actions.map((a) => {
      const theme = a.color ? ` ${Utils.esc(a.color)}` : '';
      const disabled = a.disabled ? ' disabled' : '';
      const dataGo = a.route ? ` data-go="${Utils.escAttr(a.route)}"` : '';
      return `<button type="button" class="btn${theme}"${disabled}${dataGo}>` +
        `<span class="material-symbols-rounded" aria-hidden="true">${Utils.esc(a.icon)}</span>` +
        `${Utils.esc(a.title)}</button>`;
    }).join('');
    return `<div class="card" style="margin-top:10px"><h3 style="margin-top:0">Actions</h3><div class="row" style="flex-wrap:wrap;gap:8px">${buttons}</div></div>`;
  }
};
