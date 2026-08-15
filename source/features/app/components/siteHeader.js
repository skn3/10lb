import { Utils } from '../../../shared/utils/utils.js';
import { UserTypeIcon } from '../../../constants.js';

// =============================================================================
// SITE HEADER — auth chip component.
//
// renderHTML(authName, authRole, authUserType, authUserId)
//   Returns the HTML string for the auth chip area (plain-HTML path).
//   Renders a button with a user icon, name, and role pill that navigates
//   to the user's own edit page. No logout button — logout is on the edit page.
//
// renderReact(authName, authRole, authUserType, authUserId, onNavigate)
//   Returns a React element for the auth chip (React path).
// =============================================================================
export const SiteHeader = {
  /**
   * Returns auth-chip HTML for the non-React render path.
   * @param {string} authName
   * @param {string} authRole
   * @param {string} authUserType
   * @param {string} authUserId
   * @returns {string}
   */
  renderHTML(authName, authRole, authUserType, authUserId) {
    if (!authName) return '';
    const icon = UserTypeIcon[authUserType] || UserTypeIcon['user'];
    return `<button type="button" class="btn secondary small" id="btn-auth-chip" data-user-id="${Utils.escAttr(authUserId)}">` +
      `<span class="material-symbols-rounded" aria-hidden="true" style="font-size:1em;vertical-align:middle">${Utils.esc(icon)}</span>` +
      ` ${Utils.esc(authName)} <span class="tag">${Utils.esc(authRole)}</span>` +
      `</button>`;
  },

  /**
   * Returns a React element for the auth chip.
   * @param {string} authName
   * @param {string} authRole
   * @param {string} authUserType
   * @param {string} authUserId
   * @param {function} onNavigate
   * @returns {*} React element or null
   */
  renderReact(authName, authRole, authUserType, authUserId, onNavigate) {
    const React = window.React;
    if (!React) return null;
    if (!authName) return null;
    const e = React.createElement;
    const icon = UserTypeIcon[authUserType] || UserTypeIcon['user'];
    return e('button', {
      type: 'button',
      className: 'btn secondary small',
      id: 'btn-auth-chip',
      onClick: () => onNavigate && onNavigate(authUserId)
    },
      e('span', { className: 'material-symbols-rounded', 'aria-hidden': 'true', style: { fontSize: '1em', verticalAlign: 'middle' } }, icon),
      ' ',
      authName,
      ' ',
      e('span', { className: 'tag' }, authRole)
    );
  }
};

