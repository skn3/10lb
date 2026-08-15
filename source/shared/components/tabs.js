import { Utils } from '../utils/utils.js';

// =============================================================================
// TABS — generic tab-strip component inspired by react-tabs.
//
// render(tabs, activeKey)
//   tabs: Array<{ key: string, label: string, content: string }>
//   activeKey: key of the currently selected tab (falls back to tabs[0])
//   Returns an HTML string with a .tab-list and a .tab-panel.
//
// bind(container, onTabChange)
//   Attaches click events to every [data-tab] button inside container.
//   onTabChange(key: string) is called when a tab button is clicked.
//
// readTabFromUrl()
//   Returns the value of the `tab` query parameter from the current hash,
//   e.g. `#/settings?tab=server` → 'server'.  Returns null if absent.
//
// pushTabToUrl(route, tabKey)
//   Pushes `#/<route>?tab=<tabKey>` into the browser hash via replaceState
//   without triggering a hashchange re-render.  Pass null / '' to clear.
// =============================================================================
export const Tabs = {
  /**
   * Renders a tab strip and the panel for the active tab.
   * @param {Array<{key: string, label: string, content: string}>} tabs
   * @param {string} activeKey
   * @returns {string}
   */
  render(tabs, activeKey) {
    if (!tabs || !tabs.length) return '';
    const active = tabs.find((t) => t.key === activeKey) || tabs[0];
    const tabButtons = tabs.map((t) =>
      `<button type="button" class="tab-btn${t.key === active.key ? ' active' : ''}" ` +
      `role="tab" aria-selected="${t.key === active.key ? 'true' : 'false'}" ` +
      `data-tab="${Utils.escAttr(t.key)}" data-icon-skip="1">` +
      `<span class="btn-label">${Utils.esc(t.label)}</span></button>`
    ).join('');
    return `<div class="tabs-component">` +
      `<div class="tab-list" role="tablist">${tabButtons}</div>` +
      `<div class="tab-panel" role="tabpanel">${active.content}</div>` +
      `</div>`;
  },

  /**
   * Binds click events to tab buttons inside the given container.
   * @param {HTMLElement} container
   * @param {function(key: string): void} onTabChange
   */
  bind(container, onTabChange) {
    if (!container) return;
    container.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.onclick = () => {
        const key = btn.dataset.tab;
        if (key && onTabChange) onTabChange(key);
      };
    });
  },

  /**
   * Reads the `tab` query parameter from the current URL hash.
   * e.g. `#/settings?tab=server` → 'server'
   * @returns {string|null}
   */
  readTabFromUrl() {
    const rawHash = String(window.location.hash || '').replace(/^#\/?/, '');
    const [, queryPart = ''] = rawHash.split('?');
    return new URLSearchParams(queryPart).get('tab') || null;
  },

  /**
   * Updates the URL hash to reflect the active tab without triggering a
   * hashchange event (uses history.replaceState).
   * @param {string} route  — current app route, e.g. 'settings'
   * @param {string|null} tabKey  — tab key, or null to clear
   */
  pushTabToUrl(route, tabKey) {
    const base = `#/${route}`;
    const hash = tabKey ? `${base}?tab=${encodeURIComponent(tabKey)}` : base;
    history.replaceState(null, '', window.location.pathname + hash);
  }
};
