// =============================================================================
// APP STORE — React context wrapper around the app state.
//
// AppStore.createProvider(app, children)
//   Wraps children in a context Provider that makes `app` available via hook.
//
// AppStore.useAppState()
//   Hook: returns the `app` object from context.
//
// AppStore.dispatch(app, patch)
//   Merges `patch` into `app.state` and triggers a React re-render.
// =============================================================================

export const AppStore = {
  _ctx: null,
  _forceUpdate: null,

  _getCtx() {
    if (!this._ctx) {
      const React = window.React;
      if (React) this._ctx = React.createContext(null);
    }
    return this._ctx;
  },

  createProvider(app, children) {
    const React = window.React;
    const ctx = this._getCtx();
    if (!React || !ctx) return children || null;
    const e = React.createElement;
    return e(AppStoreProvider, { app }, children);
  },

  useAppState() {
    const React = window.React;
    const ctx = this._getCtx();
    if (!React || !ctx) return null;
    return React.useContext(ctx);
  },

  dispatch(app, patch) {
    Object.assign(app.state, patch || {});
    if (typeof this._forceUpdate === 'function') {
      this._forceUpdate((tick) => tick + 1);
    }
  },

  _setForceUpdate(fn) {
    this._forceUpdate = typeof fn === 'function' ? fn : null;
  }
};

function AppStoreProvider({ app, children }) {
  const React = window.React;
  const e = React.createElement;
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    AppStore._setForceUpdate(setTick);
    return () => AppStore._setForceUpdate(null);
  }, []);
  return e(AppStore._getCtx().Provider, { value: app }, children);
}
