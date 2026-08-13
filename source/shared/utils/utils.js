export const Utils = {
  id: () => {
    if (crypto?.randomUUID) return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  },
  round2: (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100,
  pct: (n) => `${Number(n || 0).toFixed(2)}%`,
  esc: (s) => String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
  escAttr: (s) => String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;'),
  safeNum: (v, d = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  },
  date: (d) => d ? new Date(d).toLocaleDateString('en-GB') : '—',
  dateTime: (d) => d ? new Date(d).toLocaleString('en-GB') : '—',
  timeAgo: (d) => {
    if (!d) return 'Never';
    const sec = Math.max(1, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
    const units = [
      ['year', 31536000],
      ['month', 2592000],
      ['week', 604800],
      ['day', 86400],
      ['hour', 3600],
      ['min', 60]
    ];
    for (const [label, size] of units) {
      if (sec >= size) {
        const n = Math.floor(sec / size);
        return `${n} ${label}${n !== 1 ? 's' : ''}`;
      }
    }
    return `${sec} sec${sec !== 1 ? 's' : ''}`;
  },
  weekdayName: (i) => ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][Number(i) || 0],
  clone: (v) => JSON.parse(JSON.stringify(v)),
  fullName: (user) => [user?.firstName || '', user?.lastName || ''].join(' ').trim() || user?.name || user?.username || 'Unknown user',
  parseName: (fullName) => {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { firstName: '', lastName: '' };
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
  },
  validPassword: (password) => /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(password || ''),
  validEmail: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim()),
  passwordInputAttrs: (autocomplete) => `minlength="8" pattern="(?=.*[A-Za-z])(?=.*\\d)(?=.*[^A-Za-z\\d]).{8,}" title="Use at least 8 characters including a letter, a number, and a symbol." autocomplete="${autocomplete}"`,
  money: (n, currency = '£') => `${currency}${Number(n || 0).toFixed(2)}`,
  weight: (n, fmt = 'lb') => `${Number(n || 0)}${fmt}`,
  setCookie(name, value, days) {
    const expires = new Date(Date.now() + (days * 86400000)).toUTCString();
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  },
  getCookie(name) {
    const key = `${encodeURIComponent(name)}=`;
    const row = document.cookie.split(';').map((x) => x.trim()).find((x) => x.startsWith(key));
    return row ? decodeURIComponent(row.slice(key.length)) : null;
  },
  clearCookie(name) {
    document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
  }
};
