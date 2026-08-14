// =============================================================================
// SERVER PLUGIN — Abstract base class.
//
// A ServerPlugin encapsulates all behaviour that differs between offline
// (IndexedDB-only) and firebase (Firestore-backed) server modes.  The App
// object holds a single `plugin` instance and delegates the following
// concerns to it:
//
//   • isInstalled()    — whether the app has been provisioned
//   • defaultRoute()   — where to send the user when no specific route exists
//   • guardRoute()     — resolve the safe route for a requested route
//   • canAccess()      — whether a route is accessible in current state
//   • restoreSession() — restore an existing session on page load
//   • onLogin(user)    — called after a successful login (creates session/token)
//   • onLogout()       — called before logout (clears session/token)
//   • canInstall()     — returns true when installation is permitted
//   • onInit()         — called at the end of App.init() for async side effects
// =============================================================================
export class ServerPlugin {
  constructor(app) { this._app = app; }
  isInstalled()           { throw new Error('ServerPlugin.isInstalled is abstract'); }
  defaultRoute()          { throw new Error('ServerPlugin.defaultRoute is abstract'); }
  guardRoute(requested)   { throw new Error('ServerPlugin.guardRoute is abstract'); }
  canAccess(route)        { throw new Error('ServerPlugin.canAccess is abstract'); }
  async restoreSession()  { throw new Error('ServerPlugin.restoreSession is abstract'); }
  async onLogin(user)     { throw new Error('ServerPlugin.onLogin is abstract'); }
  async onLogout()        { throw new Error('ServerPlugin.onLogout is abstract'); }
  async canInstall()      { throw new Error('ServerPlugin.canInstall is abstract'); }
  async onInit()          {}
}
