// =============================================================================
// SUBMIT BUTTON — universal button component for all pages.
//
// render(options) — returns an HTML string for a button that already has the
//   canonical enhanced structure (`.btn-icon` + `.btn-label`) so that
//   enhanceButtons() does not need to post-process it.
//
// options:
//   text    {string}  — button label (required)
//   icon    {string}  — material symbol name (optional; omitted → no icon span)
//   theme   {string}  — extra CSS class(es) e.g. 'secondary', 'danger', 'small'
//   type    {string}  — button type attribute (default: 'button')
//   id      {string}  — id attribute (optional)
//   attrs   {object}  — extra HTML attributes as { name: value } (optional)
//   submit  {boolean} — shorthand for type='submit'
// =============================================================================
export const SubmitButton = {
  /**
   * Returns an HTML string for a fully-structured button element.
   * @param {{ text: string, icon?: string, theme?: string, type?: string, id?: string, attrs?: object, submit?: boolean }} options
   * @returns {string}
   */
  render({ text = '', icon = '', theme = '', type, id, attrs = {}, submit = false } = {}) {
    const btnType = type || (submit ? 'submit' : 'button');
    const classes = ['btn', ...theme.split(' ').filter(Boolean)].join(' ');
    const idAttr = id ? ` id="${_escAttr(id)}"` : '';
    const extraAttrs = Object.entries(attrs)
      .map(([k, v]) => ` ${k}="${_escAttr(String(v))}"`)
      .join('');
    const iconHtml = icon
      ? `<span class="btn-icon material-symbols-rounded" aria-hidden="true">${_esc(icon)}</span>`
      : '';
    const labelHtml = `<span class="btn-label">${_esc(text)}</span>`;
    return `<button class="${classes}" type="${btnType}"${idAttr}${extraAttrs} data-icon-skip="1">${iconHtml}${labelHtml}</button>`;
  },

  /**
   * Transitions a button element into or out of a "syncing" visual state.
   * @param {HTMLElement|null} button
   * @param {boolean} syncing
   */
  setSyncing(button, syncing) {
    if (!button) return;
    const iconEl = button.querySelector('.btn-icon');
    const labelEl = button.querySelector('.btn-label');
    if (syncing) {
      button.disabled = true;
      if (labelEl) labelEl.textContent = 'Syncing…';
      if (iconEl) {
        iconEl.classList.remove('material-symbols-rounded');
        iconEl.textContent = '';
        iconEl.classList.add('btn-spinner');
      }
    } else {
      button.disabled = false;
      if (labelEl) labelEl.textContent = button.dataset.origLabel || labelEl.textContent;
      if (iconEl) {
        iconEl.classList.remove('btn-spinner');
        iconEl.classList.add('material-symbols-rounded');
        iconEl.textContent = button.dataset.iconDefault || '';
      }
    }
  }
};

// ---------------------------------------------------------------------------
// Internal helpers (not exported)
// ---------------------------------------------------------------------------
function _esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _escAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
