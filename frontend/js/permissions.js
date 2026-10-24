// js/permissions.js
import { getUser } from './auth.js';

const ROLE_PERMISSIONS = {
  ADMIN: ['manage_users', 'manage_medicines', 'manage_inventory', 'manage_purchases',
          'manage_customers', 'manage_doctors', 'manage_suppliers', 'create_bills', 'edit_bills',
          'view_reports', 'view_financial', 'manage_expenses', 'view_margins', 'manage_settings',
          'manage_old_stock', 'view_audit_logs'],
  OWNER: ['manage_users', 'manage_medicines', 'manage_inventory', 'manage_purchases',
          'manage_customers', 'manage_doctors', 'manage_suppliers', 'create_bills', 'edit_bills',
          'view_reports', 'view_financial', 'manage_expenses', 'view_margins', 'manage_settings',
          'manage_old_stock', 'view_audit_logs'],
  STAFF: ['create_bills', 'view_inventory', 'manage_customers', 'view_doctors', 'view_settings'],
};

export function can(permission) {
  const user = getUser();
  if (!user) return false;
  const perms = ROLE_PERMISSIONS[user.role] || [];
  return perms.includes(permission);
}

export function getRole() {
  const user = getUser();
  return user ? user.role : null;
}

export function isAtLeast(role) {
  const hierarchy = { STAFF: 1, OWNER: 2, ADMIN: 3 };
  return (hierarchy[getRole()] || 0) >= (hierarchy[role] || 0);
}
