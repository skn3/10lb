// =============================================================================
// DEVICE IDENTITY
// A stable per-browser clientId stored in localStorage.
// This is separate from userId (who is logged in) and sessionToken.
// =============================================================================
export const Device = {
  _id: null,
  getId() {
    if (this._id) return this._id;
    let id = localStorage.getItem('tenlb_clientId');
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('tenlb_clientId', id);
    }
    this._id = id;
    return id;
  }
};
