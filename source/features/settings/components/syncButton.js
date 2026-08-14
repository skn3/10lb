// =============================================================================
// SYNC BUTTON — retry-sync button component for the sync settings page.
//
// render()
//   Returns the HTML string for the sync retry button.
//
// bind(button, isSyncingFn, onRetry)
//   Attaches click handler and wires up tenlb:syncstate events to reflect the
//   current sync state on the button.
//   isSyncingFn — zero-argument function that returns true when syncing
//   onRetry     — async function called when the button is clicked
// =============================================================================
export const SyncButton = {
  BUTTON_ID: 'btn-sync-retry',

  /** Returns the retry-sync button HTML. */
  render() {
    return `<button class="btn secondary" id="${this.BUTTON_ID}">` +
      `<span class="btn-icon material-symbols-rounded" aria-hidden="true">sync</span>` +
      `<span class="btn-label">Retry sync</span></button>`;
  },

  /**
   * Wire up the sync button to reflect sync state and trigger retries.
   * @param {HTMLElement|null} button
   * @param {function(): boolean} isSyncingFn
   * @param {function(): Promise<void>} onRetry
   */
  bind(button, isSyncingFn, onRetry) {
    if (!button) return;

    const update = () => {
      const syncing = isSyncingFn();
      const iconEl = button.querySelector('.btn-icon');
      const labelEl = button.querySelector('.btn-label');
      button.disabled = syncing;
      if (iconEl) {
        if (syncing) {
          iconEl.classList.remove('material-symbols-rounded');
          iconEl.textContent = '';
          iconEl.classList.add('btn-spinner');
        } else {
          iconEl.classList.remove('btn-spinner');
          iconEl.classList.add('material-symbols-rounded');
          iconEl.textContent = 'sync';
        }
      }
      if (labelEl) labelEl.textContent = syncing ? 'Syncing…' : 'Retry sync';
    };

    update();

    const onSyncState = () => update();
    window.addEventListener('tenlb:syncstate', onSyncState);

    button.onclick = async () => {
      if (isSyncingFn()) return;
      try {
        button.disabled = true;
        await onRetry();
      } finally {
        update();
      }
    };

    // Store cleanup function on the button so callers can detach if needed
    button._syncStateListener = onSyncState;
  },

  /**
   * Removes the tenlb:syncstate listener previously attached by bind().
   * @param {HTMLElement|null} button
   */
  unbind(button) {
    if (button?._syncStateListener) {
      window.removeEventListener('tenlb:syncstate', button._syncStateListener);
      button._syncStateListener = null;
    }
  }
};
