import { Data } from '../../storage/models/data.js';
import { Utils } from '../../../shared/utils/utils.js';

// =============================================================================
// USERS CONTROLLER — Private business logic for user management.
// =============================================================================
export const UsersController = {
  async listUsers() { return Data.adapter.listUsers(); },

  async getUserById(id) { return Data.adapter.getUserById(id); },

  async getUserByUsername(username) { return Data.adapter.getUserByUsername(username); },

  async createUser(userData) { return Data.adapter.createUser(userData); },

  async updateUser(userData) { return Data.adapter.updateUser(userData); },

  async deleteUser(id) { return Data.adapter.deleteUser(id); },

  roleLabel(user) {
    const type = user?.userType || (user?.isMaster ? 'master' : (user?.isAdmin ? 'admin' : 'user'));
    return type[0].toUpperCase() + type.slice(1);
  },

  userLoginLabel(user) {
    if (!user) return '';
    if (user.username) return user.username;
    return user.canLogin !== false ? 'No login email' : 'Participant only';
  },

  managedUserTypeOptions(user) {
    if (!user) return [];
    if (user.isMaster || user.userType === 'master') return [{ value: 'master', label: 'Master' }];
    const hasLocalLogin = !!user.password && Utils.validEmail(user.username || '');
    const hasFirebaseLogin = !!user.firebaseUid;
    const canPromote = user.userType !== 'participant' || hasLocalLogin || hasFirebaseLogin;
    const options = [{ value: 'participant', label: 'Participant' }];
    if (canPromote) options.push({ value: 'user', label: 'User' }, { value: 'admin', label: 'Admin' });
    return options;
  }
};
