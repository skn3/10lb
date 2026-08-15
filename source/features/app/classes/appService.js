import { App } from './appController.js';

// =============================================================================
// APP SERVICE — Public API for the app feature.
// =============================================================================
export const AppService = {
  createBreadcrumb: (label, route, options) => App.createBreadcrumb(label, route, options),
  getBreadcrumbs: (route) => App.getBreadcrumbs(route)
};

export { App };
