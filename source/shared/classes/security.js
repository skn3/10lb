export const Security = {
  encoder: new TextEncoder(),
  toB64(bytes) {
    let binary = '';
    bytes.forEach((b) => { binary += String.fromCharCode(b); });
    return btoa(binary);
  },
  fromB64(base64) {
    const raw = atob(base64);
    return Uint8Array.from(raw, (x) => x.charCodeAt(0));
  },
  async hashPassword(password, saltBytes, iterations = 150000) {
    const key = await crypto.subtle.importKey('raw', this.encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' }, key, 256);
    return this.toB64(new Uint8Array(bits));
  },
  async createPasswordRecord(password) {
    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    const iterations = 150000;
    const hash = await this.hashPassword(password, saltBytes, iterations);
    return { algorithm: 'PBKDF2-SHA256', iterations, salt: this.toB64(saltBytes), hash };
  },
  async verifyPassword(password, record) {
    if (!record?.salt || !record?.hash || !record?.iterations) return false;
    const hash = await this.hashPassword(password, this.fromB64(record.salt), record.iterations);
    return hash === record.hash;
  },
  sessionToken() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return this.toB64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
};
