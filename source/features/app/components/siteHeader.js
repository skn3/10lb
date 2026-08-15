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
    return `<button type="button" class="btn secondary small auth-chip" id="btn-auth-chip" data-icon-skip="1" data-icon-default="${Utils.escAttr(icon)}" data-user-id="${Utils.escAttr(authUserId)}">` +
      `<span class="btn-icon material-symbols-rounded" aria-hidden="true">${Utils.esc(icon)}</span>` +
      `<span class="btn-label">${Utils.esc(authName)}</span>` +
      ` <span class="tag">${Utils.esc(authRole)}</span>` +
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
      className: 'btn secondary small auth-chip',
      id: 'btn-auth-chip',
      'data-icon-skip': '1',
      onClick: () => onNavigate && onNavigate(authUserId)
    },
      e('span', { className: 'btn-icon material-symbols-rounded', 'aria-hidden': 'true' }, icon),
      e('span', { className: 'btn-label' }, authName),
      ' ',
      e('span', { className: 'tag' }, authRole)
    );
  }
};

