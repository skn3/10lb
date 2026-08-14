// =============================================================================
// INVITE QR CODE — QR code component for the invite-detail page.
//
// renderPlaceholder(containerId, statusId)
//   Returns the HTML string for the QR code container div and status paragraph.
//
// attach(containerId, statusId, text)
//   Lazily loads the qrcodejs library and renders a QR code into the element
//   identified by containerId.  Updates the status element (statusId) with
//   feedback.  Handles network failures gracefully.
// =============================================================================
export const InviteQRCode = {
  CONTAINER_ID: 'qr-code-container',
  STATUS_ID: 'qr-status',
  LIB_URL: 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',

  /**
   * Returns the placeholder HTML to embed in a page.
   * @param {string} [containerId]
   * @param {string} [statusId]
   * @returns {string}
   */
  renderPlaceholder(containerId = this.CONTAINER_ID, statusId = this.STATUS_ID) {
    return `<div id="${containerId}" style="display:inline-block;padding:12px;background:#fff;border:1px solid var(--border);border-radius:12px"></div>` +
      `<p class="small muted" id="${statusId}" style="margin:6px 0 0">Loading QR code…</p>`;
  },

  /**
   * Loads the QR library (if needed) and renders the QR code into the container.
   * @param {string} text           The URL / text to encode
   * @param {string} [containerId]
   * @param {string} [statusId]
   * @returns {Promise<void>}
   */
  async attach(text, containerId = this.CONTAINER_ID, statusId = this.STATUS_ID) {
    const container = document.getElementById(containerId);
    const status = document.getElementById(statusId);
    if (!container || !text) return;
    try {
      if (!window.QRCode) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = this.LIB_URL;
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      container.innerHTML = '';
      // eslint-disable-next-line no-new
      new window.QRCode(container, {
        text,
        width: 200,
        height: 200,
        correctLevel: window.QRCode.CorrectLevel.M
      });
      if (status) status.textContent = 'Scan to open invite link';
    } catch {
      container.innerHTML = '<span class="muted small">QR code unavailable (no internet connection)</span>';
      if (status) status.textContent = '';
    }
  }
};
