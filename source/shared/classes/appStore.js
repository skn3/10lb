const React = window.React;

export const AppStore = {
  _ctx: React ? React.createContext(null) : null,
  _forceUpdate: null,

  createProvider(app, children) {
    if (!React || !this._ctx) return children || null;
    const e = React.createElement;
    return e(AppStoreProvider, { app }, children);
  },

  useAppState() {
    if (!React || !this._ctx) return null;
    return React.useContext(this._ctx);
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
  const e = React.createElement;
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    AppStore._setForceUpdate(setTick);
    return () => AppStore._setForceUpdate(null);
  }, []);
  return e(AppStore._ctx.Provider, { value: app }, children);
}
