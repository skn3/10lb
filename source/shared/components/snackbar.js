// =============================================================================
// SNACKBAR — toast notification component.
//
// push(text, kind)  — adds a notification ('success' | 'error'); success items
//                     auto-dismiss after 7 s.
// remove(id)        — dismisses a specific notification.
// render(hostEl)    — (re-)renders all active notifications into hostEl.
// =============================================================================
export const Snackbar = {
  _counter: 0,
  _items: [],

  /**
   * Add a new snack notification.
   * @param {string} text
   * @param {'success'|'error'} kind
   */
  push(text, kind = 'success') {
    if (!text) return;
    const id = ++this._counter;
    const item = { id, text, kind };
    this._items.push(item);
    if (kind === 'success') {
      item._timer = setTimeout(() => this.remove(id), 7000);
    }
    this._notify();
  },

  /**
   * Remove a snack by id.
   * @param {number} id
   */
  remove(id) {
    const item = this._items.find((s) => s.id === id);
    if (item?._timer) clearTimeout(item._timer);
    this._items = this._items.filter((s) => s.id !== id);
    this._notify();
  },

  /**
   * Render current snacks into the provided host element.
   * @param {HTMLElement|null} hostEl
   */
  render(hostEl) {
    if (!hostEl) return;
    hostEl.innerHTML = '';
    for (const item of this._items) {
      const bar = document.createElement('div');
      bar.className = `snackbar ${item.kind}`;
      bar.setAttribute('role', 'status');
      bar.dataset.snackId = item.id;

      const txt = document.createElement('span');
      txt.className = 'snackbar-text';
      txt.textContent = item.text;
      bar.appendChild(txt);

      const closeBtn = document.createElement('button');
      closeBtn.className = 'snackbar-close';
      closeBtn.setAttribute('aria-label', 'Dismiss');
      closeBtn.textContent = '✕';
      closeBtn.addEventListener('click', () => this.remove(item.id));
      bar.appendChild(closeBtn);

      hostEl.appendChild(bar);
    }
  },

  /** @type {function|null} Called whenever the snack list changes. */
  _onChange: null,

  /** @param {function} fn */
  setOnChange(fn) {
    this._onChange = fn;
  },

  _notify() {
    if (typeof this._onChange === 'function') this._onChange();
  }
};
