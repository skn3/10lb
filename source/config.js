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
export const Config = { DB_NAME: 'tenlb-challenge', DB_VERSION: 4 };

export let RuntimeConfig = {
  serverMode: 'firebase', // 'offline' | 'firebase'
  firebase: {
    apiKey: 'AIzaSyA_7hRQBxeQXki4PKjZaeF_dudmwgxrOo8',
    authDomain: 'lb-c8f25.firebaseapp.com',
    projectId: 'lb-c8f25',
    storageBucket: 'lb-c8f25.firebasestorage.app',
    messagingSenderId: '112321058734',
    appId: '1:112321058734:web:b348538b988a0a45001a3f'
  }
};

export async function loadRuntimeConfig() {
  return RuntimeConfig;
}
