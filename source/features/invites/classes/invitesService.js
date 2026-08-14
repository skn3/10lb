import { InvitesController } from './invitesController.js';

// =============================================================================
// INVITES SERVICE — Public API for the invites feature.
// =============================================================================
export const InvitesService = {
  listInvites: () => InvitesController.listInvites(),
  listVisibleInvites: (isFirebaseMode, isAdmin, currentUser) => InvitesController.listVisibleInvites(isFirebaseMode, isAdmin, currentUser),
  createInvite: (invite) => InvitesController.createInvite(invite),
  deleteInvite: (inviteId) => InvitesController.deleteInvite(inviteId),
  deleteAllPendingInvites: (invites) => InvitesController.deleteAllPendingInvites(invites),
  getFirebaseInvite: (code) => InvitesController.getFirebaseInvite(code),
  saveFirebaseInvite: (invite) => InvitesController.saveFirebaseInvite(invite),
  listVisibleSessions: (isFirebaseMode, isAdmin, currentUser) => InvitesController.listVisibleSessions(isFirebaseMode, isAdmin, currentUser)
};
