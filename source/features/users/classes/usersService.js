import { UsersController } from './usersController.js';

// =============================================================================
// USERS SERVICE — Public API for the users feature.
// =============================================================================
export const UsersService = {
  listUsers: () => UsersController.listUsers(),
  getUserById: (id) => UsersController.getUserById(id),
  getUserByUsername: (username) => UsersController.getUserByUsername(username),
  createUser: (userData) => UsersController.createUser(userData),
  updateUser: (userData) => UsersController.updateUser(userData),
  deleteUser: (id) => UsersController.deleteUser(id),
  roleLabel: (user) => UsersController.roleLabel(user),
  userLoginLabel: (user) => UsersController.userLoginLabel(user),
  managedUserTypeOptions: (user) => UsersController.managedUserTypeOptions(user)
};
