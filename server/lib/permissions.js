export const rolePermissions = {
  admin: [
    "dashboard:read",
    "messages:read",
    "messages:send",
    "rules:manage",
    "users:read",
    "users:manage",
    "settings:manage"
  ],
  supervisor: [
    "dashboard:read",
    "messages:read",
    "messages:send",
    "rules:manage",
    "users:read",
    "settings:manage"
  ],
  agent: ["dashboard:read", "messages:read", "messages:send"],
  viewer: ["dashboard:read", "messages:read"]
};

export function hasPermission(user, permission) {
  return Boolean(user && (rolePermissions[user.role] || []).includes(permission));
}
