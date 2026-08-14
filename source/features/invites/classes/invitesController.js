import { Data } from '../../storage/models/data.js';
import { StorageService } from '../../storage/classes/storageService.js';
import { RuntimeConfig } from '../../../config.js';
import { AuthService } from '../../authentication/classes/authService.js';

// =============================================================================
// INVITES CONTROLLER — Private business logic for invite management.
// =============================================================================
export const InvitesController = {
  async listInvites() {
    return Data.adapter.listInvites();
  },

  async listVisibleInvites(isFirebaseMode, isAdmin, currentUser) {
    if (!isFirebaseMode) return Data.adapter.listInvites();
    if (!currentUser || !isAdmin || !StorageService.isFirestoreReady()) return [];
    const invites = await StorageService.downloadAll('invites');
    return invites
      .filter((invite) => invite && !invite.deletedAt)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  },

  async createInvite(invite) {
    await Data.adapter.createInvite(invite);
    if (RuntimeConfig.serverMode === 'firebase') {
      await AuthService.saveFirebaseInvite(invite);
    }
    return invite;
  },

  async deleteInvite(inviteId) {
    await Data.adapter.deleteInvite(inviteId);
    if (RuntimeConfig.serverMode === 'firebase') {
      await AuthService.deleteFirebaseInvite(inviteId);
    }
  },

  async deleteAllPendingInvites(invites) {
    const pending = invites.filter((i) => !i.usedAt);
    await Promise.all(pending.map(async (inv) => {
      await Data.adapter.deleteInvite(inv.id);
      if (RuntimeConfig.serverMode === 'firebase') {
        await AuthService.deleteFirebaseInvite(inv.id);
      }
    }));
  },

  async getFirebaseInvite(code) {
    if (RuntimeConfig.serverMode !== 'firebase') return null;
    return AuthService.getFirebaseInvite(code);
  },

  async saveFirebaseInvite(invite) {
    if (RuntimeConfig.serverMode !== 'firebase') return;
    return AuthService.saveFirebaseInvite(invite);
  },

  async listVisibleSessions(isFirebaseMode, isAdmin, currentUser) {
    if (!isFirebaseMode || !currentUser || !isAdmin || !StorageService.isFirestoreReady()) return [];
    const sessions = await StorageService.downloadAll('sessions');
    return sessions
      .filter((session) => session && !session.deletedAt)
      .sort((a, b) => new Date(b.lastSeenAt || b.startedAt || 0).getTime() - new Date(a.lastSeenAt || a.startedAt || 0).getTime());
  }
};
