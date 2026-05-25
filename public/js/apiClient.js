const API_BASE = "/api";
const BUILD_VERSION = "20260525_no_304_retry_v5";

function endpoint(path) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`;
}

function token() {
  return window.localStorage.getItem("wa_token");
}

async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    ...(options.headers || {})
  };
  const authToken = token();
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const method = (options.method || "GET").toUpperCase();
  const url = buildUrl(path, method);
  const response = await fetchJson(url, { ...options, method, headers });

  if (response.status === 304 && method === "GET") {
    const retryUrl = buildUrl(path, method, true);
    return parseResponse(await fetchJson(retryUrl, { ...options, method, headers, cache: "reload" }));
  }

  return parseResponse(response);
}

function buildUrl(path, method, retry = false) {
  const url = new URL(endpoint(path), window.location.origin);
  if (method === "GET") {
    url.searchParams.set("_cb", `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    url.searchParams.set("_v", BUILD_VERSION);
    if (retry) url.searchParams.set("_retry", "1");
  }
  return `${url.pathname}${url.search}`;
}

function fetchJson(url, options) {
  return fetch(url, {
    ...options,
    cache: options.cache || "no-store",
    credentials: "same-origin"
  });
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json().catch(() => ({})) : await response.text();

  if (!response.ok) {
    const message = payload?.error?.message || payload || "تعذر تنفيذ الطلب.";
    throw new Error(message);
  }

  if (!isJson) {
    throw new Error("مسار API رجّع صفحة HTML بدل JSON. تأكد أن الطلب يبدأ بـ /api وأنه تم رفع آخر نسخة بدون Cache.");
  }

  return payload;
}

function query(params) {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, value);
  });
  const text = search.toString();
  return text ? `?${text}` : "";
}

export const apiClient = {
  login(payload) {
    return request("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  logout() {
    return request("/auth/logout", { method: "POST" });
  },

  me() {
    return request("/auth/me");
  },

  dashboard() {
    return request("/dashboard");
  },

  listMessages(filters) {
    return request(`/messages${query(filters)}`);
  },

  sendMessage(payload) {
    return request("/messages/send", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  simulateIncoming(payload) {
    return request("/webhooks/whatsapp/simulate", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  listAutoReplies() {
    return request("/auto-replies");
  },

  saveAutoReply(payload) {
    const method = payload.id ? "PATCH" : "POST";
    const path = payload.id ? `/auto-replies/${encodeURIComponent(payload.id)}` : "/auto-replies";
    return request(path, {
      method,
      body: JSON.stringify(payload)
    });
  },

  deleteAutoReply(id) {
    return request(`/auto-replies/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  listUsers() {
    return request("/users");
  },

  saveUser(payload) {
    const method = payload.id ? "PATCH" : "POST";
    const path = payload.id ? `/users/${encodeURIComponent(payload.id)}` : "/users";
    return request(path, {
      method,
      body: JSON.stringify(payload)
    });
  },

  deleteUser(id) {
    return request(`/users/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  getSettings() {
    return request("/settings/whatsapp");
  },

  updateSettings(payload) {
    return request("/settings/whatsapp", {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  }
};
