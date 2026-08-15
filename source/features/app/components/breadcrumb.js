import { Utils } from '../../../shared/utils/utils.js';

// =============================================================================
// BREADCRUMB — compact route trail component.
// =============================================================================
export const Breadcrumb = {
  render(items, buildHref) {
    if (!items?.length) return '';
    const crumbs = items.map((item, index) => {
      const href = buildHref(item.route, item.options || {});
      const separator = index ? '<span class="breadcrumb-separator" aria-hidden="true">/</span>' : '';
      return `${separator}<a href="${Utils.escAttr(href)}" class="breadcrumb-link">${Utils.esc(item.label)}</a>`;
    }).join('');
    return `<nav class="menu-breadcrumb" aria-label="Breadcrumb">${crumbs}</nav>`;
  },

  renderReact(items, opts = {}) {
    const React = window.React;
    if (!React || !items?.length) return null;
    const e = React.createElement;
    const { onNavigate, buildPath } = opts;
    const fallbackPath = (route) => `#/${route}`;
    const crumbs = [];
    items.forEach((item, index) => {
      if (index) crumbs.push(e('span', { key: `sep-${index}`, className: 'breadcrumb-separator', 'aria-hidden': 'true' }, '/'));
      crumbs.push(e('a', {
        key: `${item.route}-${index}`,
        href: buildPath ? buildPath(item.route, item.options || {}) : fallbackPath(item.route),
        className: 'breadcrumb-link',
        onClick: (event) => {
          if (!onNavigate) return;
          event.preventDefault();
          onNavigate(item.route, item.options || {});
        }
      }, item.label));
    });
    return e('nav', { className: 'menu-breadcrumb', 'aria-label': 'Breadcrumb' }, ...crumbs);
  }
};
