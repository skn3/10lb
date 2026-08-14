// =============================================================================
// USER TYPE ENUM — owned by the users feature; may be imported by other
// features (authentication, invites) that need to reference user type values.
// =============================================================================
export const UserType = Object.freeze({
  MASTER: 'master',
  ADMIN: 'admin',
  USER: 'user',
  PARTICIPANT: 'participant'
});
