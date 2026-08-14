import { Utils } from '../utils/utils.js';

// =============================================================================
// SITE HEADER — auth chip component.
//
// renderHTML(authName, authRole, onLogoutId)
//   Returns the HTML string for the auth chip area (plain-HTML path).
//   onLogoutId — the id attribute to assign to the logout button.
//
// renderReact(authName, authRole, onLogout)
//   Returns a React element for the auth chip (React path).
// =============================================================================
export const SiteHeader = {
  /**
   * Returns auth-chip HTML for the non-React render path.
   * @param {string} authName
   * @param {string} authRole
   * @param {string} [logoutBtnId='btn-logout']
   * @returns {string}
   */
  renderHTML(authName, authRole, logoutBtnId = 'btn-logout') {
    if (!authName) return '';
    return `${Utils.esc(authName)} <span class="tag">${Utils.esc(authRole)}</span> ` +
      `<button class="btn secondary small" id="${Utils.escAttr(logoutBtnId)}">Logout</button>`;
  },

  /**
   * Returns a React element for the auth chip.
   * @param {string} authName
   * @param {string} authRole
   * @param {function} onLogout
   * @returns {*} React element or null
   */
  renderReact(authName, authRole, onLogout) {
    const React = window.React;
    if (!React) return null;
    if (!authName) return null;
    const e = React.createElement;
    return e(React.Fragment, null,
      authName,
      ' ',
      e('span', { className: 'tag' }, authRole),
      ' ',
      e('button', { className: 'btn secondary small', type: 'button', onClick: onLogout }, 'Logout')
    );
  }
};
