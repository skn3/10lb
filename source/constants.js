export const AppDb = Object.freeze({
  NAME: 'tenlb-challenge',
  VERSION: 4
});

export const ThemeOptions = Object.freeze([
  { key: 'teal', label: 'Teal Breeze' },
  { key: 'indigo', label: 'Indigo Glow' },
  { key: 'rose', label: 'Rose Quartz' },
  { key: 'slate', label: 'Slate Steel' },
  { key: 'emerald', label: 'Emerald Mist' },
  { key: 'system', label: 'System default (legacy)' },
  { key: 'light', label: 'Light (legacy)' },
  { key: 'dark', label: 'Dark (legacy)' }
]);

export const ThemeAlias = Object.freeze({
  system: 'teal',
  light: 'teal',
  dark: 'slate'
});

export const ROUTES = Object.freeze([
  'install',
  'denied',
  'login',
  'join',
  'overview',
  'rounds',
  'create',
  'create_participant',
  'edit',
  'delete',
  'submit',
  'users',
  'user',
  'invites',
  'settings',
  'invite-detail',
  'finish-week'
]);

export const UserType = Object.freeze({
  MASTER: 'master',
  ADMIN: 'admin',
  USER: 'user',
  PARTICIPANT: 'participant'
});

export const InviteType = Object.freeze({
  ADMIN: 'admin',
  USER: 'user'
});

export const UserTypeIcon = Object.freeze({
  [UserType.MASTER]: 'workspace_premium',
  [UserType.ADMIN]: 'admin_panel_settings',
  [UserType.USER]: 'person',
  [UserType.PARTICIPANT]: 'person_off',
  invite: 'mail'
});

export const RoundStatus = Object.freeze({
  ACTIVE: 'active',
  COMPLETED: 'completed',
  PENDING: 'pending'
});

export const SubmissionType = Object.freeze({
  WEIGHT: 'weight',
  HOLIDAY: 'holiday',
  FORFEIT: 'forfeit'
});

export const InviteCode = Object.freeze({
  CHARS: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
  LENGTH: 8
});

export const PrizeMedals = Object.freeze(['🏆', '🥈', '🥉', '🎖️', '🎗️', '⭐', '✨']);

export const SyncStatus = Object.freeze({
  IDLE: 'idle',
  SYNCING: 'syncing',
  SYNCED: 'synced',
  PENDING: 'pending',
  ERROR: 'error'
});

export const SyncStatusIcon = Object.freeze({
  [SyncStatus.IDLE]: '',
  [SyncStatus.SYNCING]: '<span class="sync-spin">↻</span>',
  [SyncStatus.SYNCED]: '✓',
  [SyncStatus.PENDING]: '⚠',
  [SyncStatus.ERROR]: '✗'
});

export const SyncStatusLabel = Object.freeze({
  [SyncStatus.IDLE]: '— Idle',
  [SyncStatus.SYNCING]: '↻ Syncing…',
  [SyncStatus.SYNCED]: '✓ Synced',
  [SyncStatus.PENDING]: '⚠ Changes pending',
  [SyncStatus.ERROR]: '✗ Error'
});

export const SyncStatusClass = Object.freeze({
  [SyncStatus.IDLE]: 'muted',
  [SyncStatus.SYNCING]: '',
  [SyncStatus.SYNCED]: 'ok',
  [SyncStatus.PENDING]: 'warn',
  [SyncStatus.ERROR]: 'error'
});

export const MenuState = Object.freeze({
  INLINE: 'inline',
  COLLAPSED: 'collapsed',
  EXPANDING: 'expanding',
  EXPANDED: 'expanded',
  COLLAPSING: 'collapsing'
});

export const MenuConfig = Object.freeze({
  HEIGHT_MS: 280,
  FADE_MS: 200,
  OVERFLOW_TOLERANCE: 8
});

export const NavigationItems = Object.freeze({
  primary: Object.freeze([
    { key: 'overview', label: 'Current Round', icon: 'dashboard' },
    { key: 'rounds', label: 'Rounds', icon: 'calendar_month' },
    { key: 'submit', label: 'Submit', icon: 'monitor_weight' }
  ]),
  admin: Object.freeze([
    { key: 'create', label: 'Create', icon: 'add_circle' },
    { key: 'users', label: 'Users', icon: 'group' }
  ]),
  secondary: Object.freeze([
    { key: 'settings', label: 'Settings', icon: 'settings' }
  ])
});
