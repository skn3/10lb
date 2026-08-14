import { Utils } from '../../../shared/utils/utils.js';

// =============================================================================
// MENU BAR — navigation bar component.
//
// render(items, activeRoute, buildHref) — returns the nav inner HTML string
//   (menu-track + menu-burger).
//
// renderReact(items, activeRoute, opts) — returns a React element tree for
//   use inside renderWithReact().  opts: { onNavigate, onBurgerClick }
//
// attachBurger(nav, callbacks) — wires up burger open/close behaviour.
//   callbacks: { onNavigate(route) }
// =============================================================================
export const MenuBar = {
  /**
   * Returns the innerHTML for the <nav> element.
   * @param {{ key: string, icon: string, label: string }[]} items
   * @param {string} activeRoute
   * @param {function(string): string} buildHref  e.g. (key) => `#/${key}`
   * @returns {string}
   */
  render(items, activeRoute, buildHref) {
    const links = items.map((item) => {
      const href = buildHref(item.key);
      const isActive = activeRoute === item.key;
      return `<a href="${Utils.escAttr(href)}" class="menu-item${isActive ? ' active' : ''}" role="menuitem" data-route="${Utils.escAttr(item.key)}" aria-current="${isActive ? 'page' : 'false'}">` +
        `<span class="material-symbols-rounded" aria-hidden="true">${Utils.esc(item.icon)}</span>` +
        `<span>${Utils.esc(item.label)}</span></a>`;
    }).join('');
    return `<div class="nav-inner">` +
      `<div class="menu-track" role="menubar">${links}</div>` +
      `<button class="menu-burger" type="button" aria-label="Open menu" aria-expanded="false">` +
      `<span class="material-symbols-rounded" aria-hidden="true">menu</span></button></div>`;
  },

  /**
   * Returns a React element tree for the nav inner content.
   * Requires window.React and window.ReactRouterDOM.
   * @param {{ key: string, icon: string, label: string }[]} items
   * @param {string} activeRoute
   * @param {{ onNavigate: function, onBurgerClick?: function }} opts
   * @returns {*} React element
   */
  renderReact(items, activeRoute, opts = {}) {
    const React = window.React;
    const Router = window.ReactRouterDOM;
    if (!React || !Router?.Link) return null;
    const { Link } = Router;
    const e = React.createElement;
    const { onNavigate, onBurgerClick } = opts;
    return e('div', { className: 'nav-inner' },
      e('div', { className: 'menu-track', role: 'menubar' },
        ...items.map((item) =>
          e(Link, {
            key: item.key,
            to: `/${item.key}`,
            className: `menu-item${activeRoute === item.key ? ' active' : ''}`,
            role: 'menuitem',
            'aria-current': activeRoute === item.key ? 'page' : 'false',
            onClick: (event) => { event.preventDefault(); if (onNavigate) onNavigate(item.key); }
          },
          e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, item.icon),
          e('span', null, item.label))
        )
      ),
      e('button', {
        className: 'menu-burger',
        type: 'button',
        'aria-label': 'Open menu',
        'aria-expanded': 'false',
        onClick: onBurgerClick || undefined
      },
      e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true' }, 'menu'))
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
