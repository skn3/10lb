import { renderDeniedPage } from '../pages/deniedPage.js';
import { renderInstallPage } from '../pages/installPage.js';
import { renderLoginPage } from '../pages/loginPage.js';
import { renderJoinPage } from '../pages/joinPage.js';
import { renderRoundListPage } from '../../challenges/pages/roundListPage.js';
import { renderCreateRoundPage } from '../../challenges/pages/createRoundPage.js';
import { renderEditRoundPage } from '../../challenges/pages/editRoundPage.js';
import { renderDeleteRoundPage } from '../../challenges/pages/deleteRoundPage.js';
import { renderFinishWeekPage } from '../../challenges/pages/finishWeekPage.js';
import { renderSotdImagePage } from '../../challenges/pages/sotdImagePage.js';
import { renderOverviewPage, OverviewPage } from '../../submission/pages/overviewPage.js';
import { renderSubmitPage, SubmitPage } from '../../submission/pages/submitPage.js';
import { renderUsersPage, UsersPage } from '../../users/pages/usersPage.js';
import { renderUserAdminPage, UserAdminPage } from '../../users/pages/userAdminPage.js';
import { renderCreateParticipantPage } from '../../users/pages/createParticipantPage.js';
import { renderInvitesPage } from '../../invites/pages/invitesPage.js';
import { renderInviteDetailPage } from '../../invites/pages/inviteDetailPage.js';
import { renderSettingsPage, SettingsPage } from '../../settings/pages/settingsPage.js';

const React = window.React;

function resolveScreen(app) {
  if (app.state.route === 'install') return renderInstallPage(app);
  if (!app.isInstalled()) {
    if (app.state.route === 'denied') return renderDeniedPage();
    return renderJoinPage(app);
  }
  if (!app.isAuthenticated()) {
    if (app.state.route === 'join') return renderJoinPage(app);
    return renderLoginPage(app);
  }
  const routeScreens = {
    denied: () => renderDeniedPage(),
    overview: () => renderOverviewPage(app),
    rounds: () => renderRoundListPage(app),
    create: () => renderCreateRoundPage(app),
    create_participant: () => renderCreateParticipantPage(app),
    edit: () => renderEditRoundPage(app),
    delete: () => renderDeleteRoundPage(app),
    submit: () => renderSubmitPage(app),
    users: () => renderUsersPage(app),
    user: () => renderUserAdminPage(app),
    settings: () => renderSettingsPage(app),
    invites: () => renderInvitesPage(app),
    'invite-detail': () => renderInviteDetailPage(app),
    'finish-week': () => renderFinishWeekPage(app),
    'sotd-image': () => renderSotdImagePage(app)
  };
  return routeScreens[app.state.route]?.() || '';
}

export function PageOutlet({ app }) {
  const e = React.createElement;
  const route = app.state.route;
  if (route === 'overview') return e(OverviewPage, { key: route, app });
  if (route === 'settings') return e(SettingsPage, { key: route, app });
  if (route === 'submit') return e(SubmitPage, { key: route, app });
  if (route === 'user') return e(UserAdminPage, { key: route, app });
  if (route === 'users') return e(UsersPage, { key: route, app });
  const syncBanner = (app.isAuthenticated() && app.isInstalled()) ? app._syncWarnBanner() : '';
  const screen = `${syncBanner}${resolveScreen(app)}`;
  return e('div', {
    key: route,
    'data-route': route,
    dangerouslySetInnerHTML: { __html: screen }
  });
}
