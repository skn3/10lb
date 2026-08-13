// =============================================================================
// CONFIG
// DB_VERSION history:
//   1 – initial schema
//   2 – added weeklySnapshots
//   3 – added syncQueue, deviceMeta key; added version/createdBy/updatedBy/
//       clientId/deletedAt to users, rounds, submissions; added updatedAt to
//       submissions
//   4 – added invites store (for invite-code-based registration)
// =============================================================================
export const Config = { DB_NAME: 'tenlb-challenge', DB_VERSION: 4, RUNTIME_CONFIG_PATH: './config.json' };

export let RuntimeConfig = {
  serverMode: 'offline', // 'offline' | 'firebase'
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  }
};

export async function loadRuntimeConfig() {
  try {
    const res = await fetch(Config.RUNTIME_CONFIG_PATH, { cache: 'no-store' }).catch(() => null);
    if (!res?.ok) return RuntimeConfig;
    const raw = await res.json();
    const mode = raw?.serverMode === 'firebase' ? 'firebase' : 'offline';
    RuntimeConfig = {
      serverMode: mode,
      firebase: {
        apiKey: String(raw?.firebase?.apiKey || ''),
        authDomain: String(raw?.firebase?.authDomain || ''),
        projectId: String(raw?.firebase?.projectId || ''),
        storageBucket: String(raw?.firebase?.storageBucket || ''),
        messagingSenderId: String(raw?.firebase?.messagingSenderId || ''),
        appId: String(raw?.firebase?.appId || '')
      }
    };
  } catch {
    RuntimeConfig = { ...RuntimeConfig, serverMode: 'offline' };
  }
  return RuntimeConfig;
}
