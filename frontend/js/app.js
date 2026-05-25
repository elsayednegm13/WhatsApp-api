import { apiClient as api } from "./apiClient.js?v=20260525_no_304_retry_v5";
import { can, permissions, roleLabels, visiblePermissionsFor } from "./permissions.js?v=20260525_no_304_retry_v5";

const app = document.querySelector("#app");
const toast = document.querySelector("#toast");

const state = {
  token: window.localStorage.getItem("wa_token"),
  user: readStoredUser(),
  route: "dashboard",
  filters: { direction: "all", search: "" },
  selectedContact: null,
  editingRuleId: null,
  editingUserId: null,
  dashboard: null,
  messages: [],
  autoReplies: [],
  users: [],
  settings: null
};

const routes = [
  { id: "dashboard", label: "الرئيسية", icon: "▦", permission: "dashboard:read" },
  { id: "messages", label: "الرسائل", icon: "✉", permission: "messages:read" },
  { id: "autoReplies", label: "الردود التلقائية", icon: "↩", permission: "rules:manage" },
  { id: "users", label: "المستخدمون", icon: "◎", permission: "users:read" },
  { id: "settings", label: "إعدادات WhatsApp", icon: "⚙", permission: "settings:manage" }
];

const routePaths = {
  dashboard: "/dashboard",
  messages: "/messages",
  autoReplies: "/auto-replies",
  users: "/users",
  settings: "/settings/whatsapp"
};

const pathRoutes = {
  "/": "dashboard",
  "/index.html": "dashboard",
  "/dashboard": "dashboard",
  "/messages": "messages",
  "/auto-replies": "autoReplies",
  "/autoReplies": "autoReplies",
  "/users": "users",
  "/settings": "settings",
  "/settings/whatsapp": "settings",
  "/whatsapp": "settings"
};

function readStoredUser() {
  try {
    return JSON.parse(window.localStorage.getItem("wa_user"));
  } catch {
    return null;
  }
}

function storeSession(payload) {
  state.token = payload?.token;
  state.user = payload?.user;
  window.localStorage.setItem("wa_token", payload.token);
  window.localStorage.setItem("wa_user", JSON.stringify(payload.user));
}

function clearSession() {
  state.token = null;
  state.user = null;
  window.localStorage.removeItem("wa_token");
  window.localStorage.removeItem("wa_user");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "لم يتم";
  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function showToast(message, type = "success") {
  toast.textContent = message;
  toast.dataset.type = type;
  toast.classList.add("toast--visible");
  window.setTimeout(() => toast.classList.remove("toast--visible"), 2600);
}

function routeFromLocation() {
  const hashRoute = window.location.hash.replace("#/", "");
  if (routes.some((route) => route.id === hashRoute)) return hashRoute;
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  return pathRoutes[path] || "dashboard";
}

function updateBrowserPath(route, replace = false) {
  const path = routePaths[route] || routePaths.dashboard;
  if (window.location.pathname === path && !window.location.hash) return;
  const method = replace ? "replaceState" : "pushState";
  window.history[method]({}, "", path);
}

function legacyRouteFromHash() {
  const requested = window.location.hash.replace("#/", "") || "dashboard";
  return routes.some((route) => route.id === requested) ? requested : "dashboard";
}

function firstAllowedRoute() {
  return routes.find((route) => can(state.user, route.permission))?.id || "dashboard";
}

async function loadRouteData(route = state.route) {
  if (!state.user) return;
  if (route === "dashboard") {
    state.dashboard = await api.dashboard();
  }
  if (route === "messages") {
    const messagesResult = await api.listMessages(state.filters);
    state.messages = Array.isArray(messagesResult?.messages) ? messagesResult.messages : [];
    if (!state.selectedContact && state.messages.length > 0) {
      const first = state.messages[0];
      state.selectedContact = first.direction === "inbound" ? first.from : first.to;
    }
  }
  if (route === "autoReplies") {
    const result = await api.listAutoReplies();
    state.autoReplies = Array.isArray(result?.autoReplies) ? result.autoReplies : [];
  }
  if (route === "users") {
    const result = await api.listUsers();
    state.users = Array.isArray(result?.users) ? result.users : [];
  }
  if (route === "settings") {
    const result = await api.getSettings();
    state.settings = result?.settings || null;
  }
}

async function navigate(route, options = {}) {
  const target = routes.some((item) => item.id === route) ? route : "dashboard";
  state.route = can(state.user, routes.find((item) => item.id === target)?.permission)
    ? target
    : firstAllowedRoute();
  updateBrowserPath(state.route, Boolean(options.replace));

  // Render immediately so sidebar navigation always opens the requested page.
  // Then load the page data; if an API call fails, keep the page visible and show the real error.
  render();
  try {
    await loadRouteData(state.route);
    render();
  } catch (error) {
    showToast(error.message || "تعذر تحميل بيانات الصفحة.", "error");
  }
}

function navItems() {
  return routes
    .filter((route) => can(state.user, route.permission))
    .map(
      (route) => `
        <button class="nav-item ${state.route === route.id ? "nav-item--active" : ""}" data-route="${route.id}">
          <span class="nav-icon" aria-hidden="true">${route.icon}</span>
          <span>${route.label}</span>
        </button>
      `
    )
    .join("");
}

function renderShell(content) {
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <span class="brand-mark">WA</span>
          <div>
            <strong>WhatsApp API</strong>
            <span>${escapeHtml(state.settings?.businessName || "لوحة الإدارة")}</span>
          </div>
        </div>
        <nav class="nav">${navItems()}</nav>
        <div class="account-box">
          <div class="avatar">${escapeHtml(state.user.name.slice(0, 1))}</div>
          <div>
            <strong>${escapeHtml(state.user.name)}</strong>
            <span>${roleLabels[state.user.role] || state.user.role}</span>
          </div>
        </div>
      </aside>
      <main class="workspace">
        <header class="topbar">
          <div>
            <p class="eyebrow">${roleLabels[state.user.role] || state.user.role}</p>
            <h1>${routes.find((route) => route.id === state.route)?.label || "لوحة الإدارة"}</h1>
          </div>
          <button class="icon-button" data-action="logout" title="تسجيل الخروج" aria-label="تسجيل الخروج">⎋</button>
        </header>
        ${content}
      </main>
    </div>
  `;
}

function renderLogin() {
  app.innerHTML = `
    <main class="login-screen">
      <section class="login-panel">
        <div class="brand brand--login">
          <span class="brand-mark">WA</span>
          <div>
            <strong>WhatsApp API</strong>
            <span>إدارة الرسائل والردود</span>
          </div>
        </div>
        <form class="form stack" data-form="login">
          <div>
            <label for="email">البريد الإلكتروني</label>
            <input id="email" name="email" type="email" autocomplete="email" required />
          </div>
          <div>
            <label for="password">كلمة المرور</label>
            <input id="password" name="password" type="password" autocomplete="current-password" required />
          </div>
          <button class="primary-action" type="submit">دخول</button>
        </form>
      </section>
    </main>
  `;
}

function renderDashboard() {
  const stats = state.dashboard?.stats || {};
  const recent = state.dashboard?.recentMessages || [];
  return `
    <section class="metrics-grid">
      ${metric("الواردة", stats.inbound || 0, "رسائل العملاء", "inbound")}
      ${metric("الصادرة", stats.outbound || 0, "ردود الفريق والنظام", "outbound")}
      ${metric("الردود التلقائية", stats.autoReplies || 0, "رسائل مرسلة عبر القواعد", "auto")}
      ${metric("القواعد المفعّلة", stats.activeRules || 0, "قواعد جاهزة للرد", "rules")}
    </section>
    <section class="panel">
      <div class="section-header">
        <div>
          <p class="eyebrow">آخر النشاط</p>
          <h2>رسائل حديثة</h2>
        </div>
        <button class="secondary-action" data-route="messages">فتح الرسائل</button>
      </div>
      <div class="table">
        <div class="table-row table-row--head">
          <span>العميل</span>
          <span>الاتجاه</span>
          <span>النص</span>
          <span>الوقت</span>
        </div>
        ${recent
          .map(
            (message) => `
              <div class="table-row">
                <span>${escapeHtml(message.contactName)}</span>
                <span>${directionBadge(message.direction)}</span>
                <span class="truncate">${escapeHtml(message.text)}</span>
                <span>${formatDate(message.createdAt)}</span>
              </div>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function metric(label, value, hint, tone) {
  return `
    <article class="metric metric--${tone}">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${hint}</small>
    </article>
  `;
}

function groupConversations(messages) {
  const groups = new Map();
  messages.forEach((message) => {
    const contact = message.direction === "inbound" ? message.from : message.to;
    const existing = groups.get(contact) || {
      contact,
      contactName: message.contactName || contact,
      messages: [],
      lastAt: message.createdAt
    };
    existing.messages.push(message);
    if (Date.parse(message.createdAt) > Date.parse(existing.lastAt)) existing.lastAt = message.createdAt;
    groups.set(contact, existing);
  });
  return Array.from(groups.values()).sort((a, b) => Date.parse(b.lastAt) - Date.parse(a.lastAt));
}

function renderMessages() {
  if (!Array.isArray(state.messages)) state.messages = [];
  const conversations = groupConversations(state.messages);
  const selected = conversations.find((item) => item.contact === state.selectedContact) || conversations[0];
  if (selected) state.selectedContact = selected.contact;
  const thread = selected?.messages.slice().sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)) || [];

  return `
    <section class="toolbar">
      <div class="search-field">
        <span aria-hidden="true">⌕</span>
        <input name="messageSearch" value="${escapeHtml(state.filters.search)}" placeholder="بحث بالاسم أو النص أو الرقم" />
      </div>
      <select name="directionFilter" aria-label="فلترة الرسائل">
        <option value="all" ${state.filters.direction === "all" ? "selected" : ""}>كل الرسائل</option>
        <option value="inbound" ${state.filters.direction === "inbound" ? "selected" : ""}>الواردة</option>
        <option value="outbound" ${state.filters.direction === "outbound" ? "selected" : ""}>الصادرة</option>
      </select>
    </section>
    <section class="messages-layout ${can(state.user, "messages:send") ? "" : "messages-layout--read-only"}">
      <aside class="conversation-list">
        ${conversations.length === 0 ? emptyState("لا توجد رسائل مطابقة") : ""}
        ${conversations
          .map(
            (item) => `
              <button class="conversation ${item.contact === state.selectedContact ? "conversation--active" : ""}" data-contact="${escapeHtml(item.contact)}">
                <strong>${escapeHtml(item.contactName)}</strong>
                <span>${escapeHtml(item.contact)}</span>
                <small>${formatDate(item.lastAt)}</small>
              </button>
            `
          )
          .join("")}
      </aside>
      <section class="thread-panel">
        <div class="thread-header">
          <div>
            <h2>${escapeHtml(selected?.contactName || "اختر محادثة")}</h2>
            <span>${escapeHtml(selected?.contact || "")}</span>
          </div>
          <span class="pill">${thread.length} رسالة</span>
        </div>
        <div class="thread">
          ${thread
            .map(
              (message) => `
                <article class="message-bubble message-bubble--${message.direction}">
                  <p>${escapeHtml(message.text)}</p>
                  <footer>
                    ${directionBadge(message.direction)}
                    <span>${formatDate(message.createdAt)}</span>
                  </footer>
                </article>
              `
            )
            .join("")}
        </div>
        ${
          can(state.user, "messages:send") && selected
            ? `
              <form class="composer" data-form="sendMessage">
                <input type="hidden" name="to" value="${escapeHtml(selected.contact)}" />
                <input type="hidden" name="contactName" value="${escapeHtml(selected.contactName)}" />
                <textarea name="text" rows="2" placeholder="اكتب رسالة" required></textarea>
                <button class="primary-action" type="submit">إرسال</button>
              </form>
            `
            : ""
        }
      </section>
      ${
        can(state.user, "messages:send")
          ? `
            <aside class="panel simulator">
              <div class="section-header section-header--compact">
                <div>
                  <p class="eyebrow">Webhook Mock</p>
                  <h2>محاكاة رسالة واردة</h2>
                </div>
              </div>
              <form class="form stack" data-form="simulateIncoming">
                <div>
                  <label>رقم العميل</label>
                  <input name="from" value="+201009990000" required />
                </div>
                <div>
                  <label>اسم العميل</label>
                  <input name="contactName" value="عميل جديد" required />
                </div>
                <div>
                  <label>نص الرسالة</label>
                  <textarea name="text" rows="4" required>أريد معرفة حالة طلبي</textarea>
                </div>
                <button class="secondary-action" type="submit">استقبال</button>
              </form>
            </aside>
          `
          : ""
      }
    </section>
  `;
}

function renderAutoReplies() {
  if (!Array.isArray(state.autoReplies)) state.autoReplies = [];
  const editing = state.autoReplies.find((rule) => rule.id === state.editingRuleId);
  return `
    <section class="split-layout">
      <div class="panel">
        <div class="section-header">
          <div>
            <p class="eyebrow">القواعد</p>
            <h2>الردود التلقائية</h2>
          </div>
          <button class="secondary-action" data-action="newRule">قاعدة جديدة</button>
        </div>
        <div class="rule-list">
          ${state.autoReplies
            .map(
              (rule) => `
                <article class="rule-item">
                  <div>
                    <header>
                      <strong>${escapeHtml(rule.name)}</strong>
                      ${rule.enabled ? '<span class="badge badge--ok">مفعّلة</span>' : '<span class="badge">متوقفة</span>'}
                    </header>
                    <p>${escapeHtml(rule.keyword)} · ${matchTypeLabel(rule.matchType)}</p>
                    <small>${escapeHtml(rule.replyText)}</small>
                  </div>
                  <div class="row-actions">
                    <button class="icon-button" data-action="editRule" data-id="${rule.id}" title="تعديل" aria-label="تعديل">✎</button>
                    <button class="icon-button icon-button--danger" data-action="deleteRule" data-id="${rule.id}" title="حذف" aria-label="حذف">×</button>
                  </div>
                </article>
              `
            )
            .join("")}
        </div>
      </div>
      <div class="panel">
        <div class="section-header">
          <div>
            <p class="eyebrow">${editing ? "تعديل" : "إضافة"}</p>
            <h2>${editing ? escapeHtml(editing.name) : "قاعدة رد"}</h2>
          </div>
        </div>
        <form class="form grid-form" data-form="autoReply">
          <input type="hidden" name="id" value="${escapeHtml(editing?.id || "")}" />
          <div>
            <label>اسم القاعدة</label>
            <input name="name" value="${escapeHtml(editing?.name || "")}" required />
          </div>
          <div>
            <label>الكلمة أو الجملة</label>
            <input name="keyword" value="${escapeHtml(editing?.keyword || "")}" required />
          </div>
          <div>
            <label>نوع المطابقة</label>
            <select name="matchType">
              ${["contains", "exact", "startsWith", "regex"]
                .map((type) => `<option value="${type}" ${editing?.matchType === type ? "selected" : ""}>${matchTypeLabel(type)}</option>`)
                .join("")}
            </select>
          </div>
          <div>
            <label>الأولوية</label>
            <input name="priority" type="number" min="1" value="${editing?.priority || state.autoReplies.length + 1}" required />
          </div>
          <div class="form-wide">
            <label>نص الرد</label>
            <textarea name="replyText" rows="5" required>${escapeHtml(editing?.replyText || "")}</textarea>
          </div>
          <label class="check-line">
            <input type="checkbox" name="enabled" ${editing?.enabled ?? true ? "checked" : ""} />
            <span>مفعّلة</span>
          </label>
          <label class="check-line">
            <input type="checkbox" name="caseSensitive" ${editing?.caseSensitive ? "checked" : ""} />
            <span>مطابقة حساسة لحالة الأحرف</span>
          </label>
          <div class="form-actions">
            <button class="primary-action" type="submit">حفظ</button>
            <button class="secondary-action" type="button" data-action="newRule">إلغاء</button>
          </div>
        </form>
      </div>
    </section>
  `;
}

function renderUsers() {
  if (!Array.isArray(state.users)) state.users = [];
  const editing = state.users.find((user) => user.id === state.editingUserId);
  const canManage = can(state.user, "users:manage");
  return `
    <section class="split-layout split-layout--users">
      <div class="panel">
        <div class="section-header">
          <div>
            <p class="eyebrow">الفريق</p>
            <h2>المستخدمون والصلاحيات</h2>
          </div>
          ${canManage ? '<button class="secondary-action" data-action="newUser">مستخدم جديد</button>' : ""}
        </div>
        <div class="table users-table">
          <div class="table-row table-row--head">
            <span>الاسم</span>
            <span>الدور</span>
            <span>الحالة</span>
            <span>آخر دخول</span>
            <span></span>
          </div>
          ${state.users
            .map(
              (user) => `
                <div class="table-row">
                  <span>
                    <strong>${escapeHtml(user.name)}</strong>
                    <small>${escapeHtml(user.email)}</small>
                  </span>
                  <span>${roleLabels[user.role] || user.role}</span>
                  <span>${user.status === "active" ? '<span class="badge badge--ok">نشط</span>' : '<span class="badge">موقوف</span>'}</span>
                  <span>${formatDate(user.lastLoginAt)}</span>
                  <span class="row-actions">
                    ${
                      canManage
                        ? `
                          <button class="icon-button" data-action="editUser" data-id="${user.id}" title="تعديل" aria-label="تعديل">✎</button>
                          <button class="icon-button icon-button--danger" data-action="deleteUser" data-id="${user.id}" title="حذف" aria-label="حذف">×</button>
                        `
                        : ""
                    }
                  </span>
                </div>
              `
            )
            .join("")}
        </div>
      </div>
      <div class="panel">
        <div class="section-header">
          <div>
            <p class="eyebrow">${editing ? "تعديل" : "إضافة"}</p>
            <h2>${editing ? escapeHtml(editing.name) : "مستخدم"}</h2>
          </div>
        </div>
        ${
          canManage
            ? renderUserForm(editing)
            : `<div class="permission-view">${permissionList(state.user.role)}</div>`
        }
      </div>
    </section>
  `;
}

function renderUserForm(editing) {
  return `
    <form class="form stack" data-form="user">
      <input type="hidden" name="id" value="${escapeHtml(editing?.id || "")}" />
      <div>
        <label>الاسم</label>
        <input name="name" value="${escapeHtml(editing?.name || "")}" required />
      </div>
      <div>
        <label>البريد الإلكتروني</label>
        <input name="email" type="email" value="${escapeHtml(editing?.email || "")}" required />
      </div>
      <div>
        <label>كلمة المرور ${editing ? "(اتركها فارغة للإبقاء عليها)" : ""}</label>
        <input name="password" type="password" ${editing ? "" : "required"} />
      </div>
      <div>
        <label>الدور</label>
        <select name="role">
          ${Object.entries(roleLabels)
            .map(([role, label]) => `<option value="${role}" ${editing?.role === role ? "selected" : ""}>${label}</option>`)
            .join("")}
        </select>
      </div>
      <div>
        <label>الحالة</label>
        <select name="status">
          <option value="active" ${editing?.status !== "suspended" ? "selected" : ""}>نشط</option>
          <option value="suspended" ${editing?.status === "suspended" ? "selected" : ""}>موقوف</option>
        </select>
      </div>
      <div class="permission-view">${permissionList(editing?.role || "agent")}</div>
      <div class="form-actions">
        <button class="primary-action" type="submit">حفظ</button>
        <button class="secondary-action" type="button" data-action="newUser">إلغاء</button>
      </div>
    </form>
  `;
}

function permissionList(role) {
  return visiblePermissionsFor(role)
    .map((item) => `<span class="permission-chip">${permissions[item]}</span>`)
    .join("");
}

function renderSettings() {
  const settings = state.settings || {};
  return `
    <section class="panel settings-panel">
      <div class="section-header">
        <div>
          <p class="eyebrow">WhatsApp Cloud API</p>
          <h2>إعدادات الربط</h2>
        </div>
        <span class="badge ${settings.autoReplyEnabled ? "badge--ok" : ""}">
          ${settings.autoReplyEnabled ? "الرد التلقائي يعمل" : "الرد التلقائي متوقف"}
        </span>
      </div>
      <form class="form grid-form" data-form="settings">
        <div>
          <label>اسم النشاط</label>
          <input name="businessName" value="${escapeHtml(settings.businessName || "")}" required />
        </div>
        <div>
          <label>رقم WhatsApp</label>
          <input name="businessPhone" value="${escapeHtml(settings.businessPhone || "")}" required />
        </div>
        <div>
          <label>Phone Number ID</label>
          <input name="phoneNumberId" value="${escapeHtml(settings.phoneNumberId || "")}" required />
        </div>
        <div>
          <label>وضع الإرسال</label>
          <select name="sendMode">
            <option value="mock" ${settings.sendMode === "mock" ? "selected" : ""}>Mock</option>
            <option value="cloud" ${settings.sendMode === "cloud" ? "selected" : ""}>Cloud API</option>
          </select>
        </div>
        <div>
          <label>Verify Token ${settings.verifyTokenSet ? "(محفوظ)" : ""}</label>
          <input name="verifyToken" type="password" placeholder="${settings.verifyTokenSet ? "اتركه فارغًا للإبقاء عليه" : ""}" />
        </div>
        <div>
          <label>Access Token ${settings.accessTokenSet ? "(محفوظ)" : ""}</label>
          <input name="accessToken" type="password" placeholder="${settings.accessTokenSet ? "اتركه فارغًا للإبقاء عليه" : ""}" />
        </div>
        <div>
          <label>App Secret ${settings.appSecretSet ? "(محفوظ)" : ""}</label>
          <input name="appSecret" type="password" placeholder="${settings.appSecretSet ? "اتركه فارغًا للإبقاء عليه" : ""}" />
        </div>
        <div>
          <label>Webhook URL</label>
          <input name="webhookUrl" value="${escapeHtml(settings.webhookUrl || "/api/webhooks/whatsapp")}" required />
        </div>
        <label class="check-line form-wide">
          <input type="checkbox" name="autoReplyEnabled" ${settings.autoReplyEnabled ? "checked" : ""} />
          <span>تفعيل الردود التلقائية عند استقبال الرسائل</span>
        </label>
        <div class="form-actions form-wide">
          <button class="primary-action" type="submit">حفظ الإعدادات</button>
        </div>
      </form>
    </section>
  `;
}

function emptyState(text) {
  return `<div class="empty-state">${text}</div>`;
}

function directionBadge(direction) {
  return direction === "inbound"
    ? '<span class="badge badge--in">واردة</span>'
    : '<span class="badge badge--out">صادرة</span>';
}

function matchTypeLabel(type) {
  return (
    {
      contains: "تحتوي على",
      exact: "مطابقة كاملة",
      startsWith: "تبدأ بـ",
      regex: "Regex"
    }[type] || type
  );
}

function render() {
  if (!state.user) {
    renderLogin();
    return;
  }

  if (!can(state.user, routes.find((route) => route.id === state.route)?.permission)) {
    state.route = firstAllowedRoute();
  }

  const pages = {
    dashboard: renderDashboard,
    messages: renderMessages,
    autoReplies: renderAutoReplies,
    users: renderUsers,
    settings: renderSettings
  };

  renderShell(pages[state.route]?.() || renderDashboard());
}

async function refresh() {
  await loadRouteData(state.route);
  render();
}

app.addEventListener("click", async (event) => {
  const routeButton = event.target.closest("[data-route]");
  if (routeButton) {
    await navigate(routeButton.dataset.route);
    return;
  }

  const conversation = event.target.closest("[data-contact]");
  if (conversation) {
    state.selectedContact = conversation.dataset.contact;
    render();
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;

  const { action, id } = actionButton.dataset;
  if (action === "logout") {
    await api.logout();
    clearSession();
    render();
  }
  if (action === "newRule") {
    state.editingRuleId = null;
    render();
  }
  if (action === "editRule") {
    state.editingRuleId = id;
    render();
  }
  if (action === "deleteRule" && window.confirm("حذف قاعدة الرد؟")) {
    await api.deleteAutoReply(id);
    showToast("تم حذف القاعدة.");
    await refresh();
  }
  if (action === "newUser") {
    state.editingUserId = null;
    render();
  }
  if (action === "editUser") {
    state.editingUserId = id;
    render();
  }
  if (action === "deleteUser" && window.confirm("حذف المستخدم؟")) {
    await api.deleteUser(id);
    showToast("تم حذف المستخدم.");
    await refresh();
  }
});

app.addEventListener("input", async (event) => {
  if (event.target.name === "messageSearch") {
    state.filters.search = event.target.value;
    await loadRouteData("messages");
    render();
  }
});

app.addEventListener("change", async (event) => {
  if (event.target.name === "directionFilter") {
    state.filters.direction = event.target.value;
    await refresh();
  }
  if (event.target.name === "role") {
    const wrapper = event.target.closest("form")?.querySelector(".permission-view");
    if (wrapper) wrapper.innerHTML = permissionList(event.target.value);
  }
});

app.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target.closest("form");
  if (!form) return;
  const formData = new FormData(form);
  const formName = form.dataset.form;

  try {
    if (formName === "login") {
      const result = await api.login(Object.fromEntries(formData));
      storeSession(result);
      state.route = routeFromLocation();
      await navigate(state.route, { replace: true });
      showToast("تم تسجيل الدخول.");
    }

    if (formName === "sendMessage") {
      await api.sendMessage(Object.fromEntries(formData));
      form.reset();
      showToast("تم إرسال الرسالة.");
      await refresh();
    }

    if (formName === "simulateIncoming") {
      const result = await api.simulateIncoming(Object.fromEntries(formData));
      state.selectedContact = result.inbound.from;
      showToast(result.reply ? "تم استقبال الرسالة وإرسال رد تلقائي." : "تم استقبال الرسالة.");
      await refresh();
    }

    if (formName === "autoReply") {
      const payload = Object.fromEntries(formData);
      payload.priority = Number(payload.priority);
      payload.enabled = formData.has("enabled");
      payload.caseSensitive = formData.has("caseSensitive");
      if (!payload.id) delete payload.id;
      await api.saveAutoReply(payload);
      state.editingRuleId = null;
      showToast("تم حفظ قاعدة الرد.");
      await refresh();
    }

    if (formName === "user") {
      const payload = Object.fromEntries(formData);
      if (!payload.id) delete payload.id;
      if (!payload.password) delete payload.password;
      await api.saveUser(payload);
      state.editingUserId = null;
      showToast("تم حفظ المستخدم.");
      await refresh();
    }

    if (formName === "settings") {
      const payload = Object.fromEntries(formData);
      payload.autoReplyEnabled = formData.has("autoReplyEnabled");
      if (!payload.accessToken) delete payload.accessToken;
      if (!payload.appSecret) delete payload.appSecret;
      await api.updateSettings(payload);
      showToast("تم حفظ الإعدادات.");
      await refresh();
    }
  } catch (error) {
    showToast(error.message || "حدث خطأ غير متوقع.", "error");
  }
});

window.addEventListener("hashchange", async () => {
  const nextRoute = legacyRouteFromHash();
  if (state.user && nextRoute !== state.route) {
    await navigate(nextRoute, { replace: true });
  }
});

window.addEventListener("popstate", async () => {
  const nextRoute = routeFromLocation();
  if (state.user && nextRoute !== state.route) {
    await navigate(nextRoute, { replace: true });
  }
});

async function init() {
  if (state.token) {
    try {
      const result = await api.me();
      state.user = result.user;
      window.localStorage.setItem("wa_user", JSON.stringify(result.user));
    } catch {
      clearSession();
    }
  }

  if (!state.user) {
    render();
    return;
  }
  state.route = routeFromLocation();
  await navigate(state.route, { replace: true });
}

init();
