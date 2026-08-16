import { Utils } from '../../../shared/utils/utils.js';
import { PageMenuMap } from '../../../constants.js';

// =============================================================================
// MENU BAR — navigation bar component.
// =============================================================================

function activeMenuKey(route) {
  return PageMenuMap[route] || route;
}

export const MenuBar = {
  /**
   * Returns the innerHTML for the <nav> element.
   * @param {{ key: string, icon: string, label: string }[]} items
   * @param {string} activeRoute
   * @param {function(string, object=): string} buildHref  e.g. (key) => `#/${key}`
   * @returns {string}
   */
  render(items, activeRoute, buildHref) {
    const activeKey = activeMenuKey(activeRoute);
    const links = items.map((item) => {
      const href = buildHref(item.key);
      const isActive = activeKey === item.key;
      return `<a href="${Utils.escAttr(href)}" class="menu-item${isActive ? ' active' : ''}" role="menuitem" data-route="${Utils.escAttr(item.key)}" aria-current="${isActive ? 'page' : 'false'}">` +
        `<span class="material-symbols-rounded" aria-hidden="true">${Utils.esc(item.icon)}</span>` +
        `<span class="menu-item-label">${Utils.esc(item.label)}</span></a>`;
    }).join('');
    return `<div class="nav-inner">` +
      `<div class="menu-header">` +
      `<button class="menu-burger" type="button" aria-label="Expand menu" aria-expanded="false" title="Expand menu" data-icon-skip="1">` +
      `<span class="material-symbols-rounded menu-burger-glyph" aria-hidden="true">menu</span><span class="menu-burger-label">Menu</span></button>` +
      `</div>` +
      `<div class="menu-track" role="menubar">${links}</div>` +
      `</div>`;
  },

  /**
   * Returns a React element tree for the nav inner content.
   * @param {{ key: string, icon: string, label: string }[]} items
   * @param {string} activeRoute
   * @param {{ onNavigate: function, onBurgerClick?: function, buildPath?: function }} opts
   * @returns {*} React element
   */
  renderReact(items, activeRoute, opts = {}) {
    const React = window.React;
    if (!React) return null;
    const e = React.createElement;
    const { onNavigate, onBurgerClick, buildPath } = opts;
    const activeKey = activeMenuKey(activeRoute);
    return e('div', { className: 'nav-inner' },
      e('div', { className: 'menu-header' },
        e('button', {
          className: 'menu-burger',
          type: 'button',
          'aria-label': 'Expand menu',
          'aria-expanded': 'false',
          title: 'Expand menu',
          'data-icon-skip': '1',
          onClick: onBurgerClick || undefined
        },
        e('span', { className: 'material-symbols-rounded menu-burger-glyph', 'aria-hidden': 'true' }, 'menu'),
        e('span', { className: 'menu-burger-label' }, 'Menu'))
      ),
      e('div', { className: 'menu-track', role: 'menubar' },
        ...items.map((item) =>
          e('a', {
            key: item.key,
            href: `#/${item.key}`,
            className: `menu-item${activeKey === item.key ? ' active' : ''}`,
            role: 'menuitem',
            'aria-current': activeKey === item.key ? 'page' : 'false',
            onClick: (event) => { event.preventDefault(); if (onNavigate) onNavigate(item.key); }
          },
          e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, item.icon),
          e('span', { className: 'menu-item-label' }, item.label))
        )
      )
    );
  },

  /**
   * Attach click handler to the nav element so that data-route links call
   * the provided navigate function.
   * @param {HTMLElement} nav
   * @param {function(string): void} onNavigate
   */
  attachClickHandler(nav, onNavigate) {
    if (!nav) return;
    nav.onclick = (e) => {
      const b = e.target.closest('[data-route]');
      if (!b) return;
      e.preventDefault();
      onNavigate(b.dataset.route);
    };
  }
};
