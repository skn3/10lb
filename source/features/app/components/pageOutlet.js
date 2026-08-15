import { DeniedPage, renderDeniedPage } from '../pages/deniedPage.js';
import { InstallPage, renderInstallPage } from '../pages/installPage.js';
import { LoginPage, renderLoginPage } from '../pages/loginPage.js';
import { JoinPage, renderJoinPage } from '../pages/joinPage.js';
import { RoundListPage, renderRoundListPage } from '../../challenges/pages/roundListPage.js';
import { CreateRoundPage, renderCreateRoundPage } from '../../challenges/pages/createRoundPage.js';
import { EditRoundPage, renderEditRoundPage } from '../../challenges/pages/editRoundPage.js';
import { DeleteRoundPage, renderDeleteRoundPage } from '../../challenges/pages/deleteRoundPage.js';
import { FinishWeekPage, renderFinishWeekPage } from '../../challenges/pages/finishWeekPage.js';
import { SotdImagePage, renderSotdImagePage } from '../../challenges/pages/sotdImagePage.js';
import { OverviewPage, renderOverviewPage } from '../../submission/pages/overviewPage.js';
import { SubmitPage, renderSubmitPage } from '../../submission/pages/submitPage.js';
import { UsersPage, renderUsersPage } from '../../users/pages/usersPage.js';
import { UserAdminPage, renderUserAdminPage } from '../../users/pages/userAdminPage.js';
import { CreateParticipantPage, renderCreateParticipantPage } from '../../users/pages/createParticipantPage.js';
import { InvitesPage, renderInvitesPage } from '../../invites/pages/invitesPage.js';
import { InviteDetailPage, renderInviteDetailPage } from '../../invites/pages/inviteDetailPage.js';
import { SettingsPage, renderSettingsPage } from '../../settings/pages/settingsPage.js';

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

  // Not-installed / unauthenticated routes
  if (route === 'install') return e(InstallPage, { key: route, app });
  if (!app.isInstalled()) {
    if (route === 'denied') return e(DeniedPage, { key: route, app });
    return e(JoinPage, { key: route, app });
  }
  if (!app.isAuthenticated()) {
    if (route === 'join') return e(JoinPage, { key: route, app });
    return e(LoginPage, { key: route, app });
  }

  // Authenticated routes
  const components = {
    denied: DeniedPage,
    overview: OverviewPage,
    rounds: RoundListPage,
    create: CreateRoundPage,
    create_participant: CreateParticipantPage,
    edit: EditRoundPage,
    delete: DeleteRoundPage,
    submit: SubmitPage,
    users: UsersPage,
    user: UserAdminPage,
    settings: SettingsPage,
    invites: InvitesPage,
    'invite-detail': InviteDetailPage,
    'finish-week': FinishWeekPage,
    'sotd-image': SotdImagePage
  };

  const Component = components[route];
  if (Component) return e(Component, { key: route, app });

  // Fallback for any unhandled routes (should not happen in practice)
  const syncBanner = app._syncWarnBanner ? app._syncWarnBanner() : '';
  const screen = `${syncBanner}${resolveScreen(app)}`;
  return e('div', {
    key: route,
    'data-route': route,
    dangerouslySetInnerHTML: { __html: screen }
  });
}

