// js/services/authService.js
import { getUser } from '../auth.js';
import { can, getRole, isAtLeast } from '../permissions.js';

export const authService = {
  getUser,
  getRole,
  can,
  isAtLeast,
  hasPermission: (permission) => can(permission),
};
