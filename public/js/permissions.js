export const roleLabels = {
  admin: "مدير النظام",
  supervisor: "مشرف",
  agent: "موظف دعم",
  viewer: "مشاهد"
};

export const permissions = {
  "dashboard:read": "عرض لوحة التحكم",
  "messages:read": "عرض الرسائل",
  "messages:send": "إرسال رسائل",
  "rules:manage": "إدارة الردود التلقائية",
  "users:read": "عرض المستخدمين",
  "users:manage": "إدارة المستخدمين",
  "settings:manage": "إدارة الربط"
};

export const rolePermissions = {
  admin: Object.keys(permissions),
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

export function can(user, permission) {
  if (!user || !permission) return false;
  return (user.permissions || rolePermissions[user.role] || []).includes(permission);
}

export function visiblePermissionsFor(role) {
  return rolePermissions[role] || [];
}
