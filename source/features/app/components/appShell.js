import { ThemeAlias } from '../../../constants.js';
import { AppStore } from '../../../shared/classes/appStore.js';
import { MenuBar } from './menuBar.js';
import { SiteHeader } from './siteHeader.js';
import { SiteFooterReact } from './siteFooter.js';
import { Snackbar } from './snackbar.js';
import { PageOutlet } from './pageOutlet.js';

const React = window.React;

export function AppShell({ app: initialApp }) {
  const e = React.createElement;
  const app = AppStore.useAppState() || initialApp;
  const [, setSnackTick] = React.useState(0);
  const navModel = app.attachNav();

  React.useEffect(() => {
    const userTheme = app.state.currentUser?.theme;
    const serverTheme = app.state.appSettings?.theme;
    const configTheme = window.__RuntimeConfig?.theme;
    const theme = userTheme || serverTheme || configTheme || 'teal';
    document.body.setAttribute('data-theme', ThemeAlias[theme] || theme);
  }, [app.state.currentUser?.theme, app.state.appSettings?.theme]);

  // bindScreenEvents and _setupNavBurger use .onclick property assignment, which is
  // idempotent (each call overwrites the previous handler). _setupNavBurger also has
  // an identity guard. We must re-run after every render so that newly rendered HTML
  // elements (in non-React page fallback) get their click handlers wired up.
  React.useEffect(() => {
    document.body.classList.toggle('is-syncing', app._isSyncing());
    app.updateStickyOffsets();
    app._setupNavBurger();
    app.bindScreenEvents();
  });

  React.useEffect(() => {
    Snackbar.setOnChange(() => setSnackTick((tick) => tick + 1));
    return () => Snackbar.setOnChange(null);
  }, []);

  return e(React.Fragment, null,
    e('header', null,
      e('div', { className: 'header-row' },
        e('h1', { id: 'server-title' }, app.state.appSettings?.serverName || '10lb Challenge'),
        e('div', { className: 'row small', id: 'auth-chip' },
          SiteHeader.renderReact(
            navModel.authName,
            navModel.authRole,
            navModel.authUserType,
            navModel.authUserId,
            (userId) => app.navigate('user', { userId })
          )
        )
      ),
      e('div', {
        id: 'sync-bar',
        style: {
          display: navModel.syncVisible ? 'block' : 'none',
          fontSize: '.75rem',
          padding: '2px 0 4px',
          opacity: '.85'
        }
      }, navModel.syncVisible ? e('span', null,
        navModel.syncSpinning ? e('span', { className: 'sync-spin' }, '↻') : null,
        navModel.syncSpinning ? ' ' : null,
        navModel.syncLabel
      ) : null)
    ),
    e('nav', { id: 'nav', className: navModel.items.length ? 'has-items' : '' },
      navModel.items.length
        ? MenuBar.renderReact(navModel.items, navModel.breadcrumbs, app.state.route, {
          onNavigate: (key, options = {}) => app.navigate(key, options),
          onBurgerClick: () => app._navBurger?.onBurgerClick?.(),
          buildPath: (key, options = {}) => app._buildHashRoute(key, options)
        })
        : null
    ),
    e('div', { id: 'snackbar-root', className: 'snackbar-host', 'aria-live': 'polite', 'aria-atomic': 'true' },
      ...Snackbar._items.map((item) => e('div', {
        key: item.id,
        className: `snackbar ${item.kind}`,
        role: 'status',
        'data-snack-id': item.id
      },
      e('span', { className: 'snackbar-text' }, item.text),
      e('button', {
        className: 'snackbar-close',
        'aria-label': 'Dismiss',
        type: 'button',
        onClick: () => Snackbar.remove(item.id)
      }, '✕')))
    ),
    e('main', { id: 'app' }, e(PageOutlet, { app })),
    e('div', { id: 'site-footer' }, e(SiteFooterReact, { app }))
  );
}
