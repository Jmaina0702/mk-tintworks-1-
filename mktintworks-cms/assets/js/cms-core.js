(function bootstrapCmsCore(window) {
  const TOKEN_KEY = "cms_token";
  const TOKEN_EXPIRY_KEY = "cms_token_expiry";
  const DEFAULT_WORKER_API_BASE =
    "https://mktintworks-cms-api.mktintworks.workers.dev";
  const defaultConfig = {
    apiBase: window.API_BASE,
    autoAuth: true,
    loginPath: "/index.html",
  };
  const config = Object.assign({}, defaultConfig, window.MKT_CMS_CONFIG || {});
  const shouldUseSameOriginApi = () => {
    const hostname = String(window.location.hostname || "").toLowerCase();
    return (
      hostname === "admin.mktintworks.com" ||
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".pages.dev")
    );
  };
  const API_BASE = String(
    config.apiBase ||
      (shouldUseSameOriginApi()
        ? window.location.origin
        : DEFAULT_WORKER_API_BASE)
  ).replace(/\/$/, "");
  const loginPath = String(config.loginPath || "/index.html");
  const memorySession = new Map();

  const createSessionStorageAdapter = () => {
    try {
      const probeKey = "__mkt_cms_session_probe__";
      window.sessionStorage.setItem(probeKey, "1");
      window.sessionStorage.removeItem(probeKey);

      return {
        setItem(key, value) {
          window.sessionStorage.setItem(key, value);
        },
        getItem(key) {
          return window.sessionStorage.getItem(key);
        },
        removeItem(key) {
          window.sessionStorage.removeItem(key);
        },
      };
    } catch {
      return {
        setItem(key, value) {
          memorySession.set(key, String(value));
        },
        getItem(key) {
          return memorySession.has(key) ? memorySession.get(key) : null;
        },
        removeItem(key) {
          memorySession.delete(key);
        },
      };
    }
  };

  let authInFlight = null;
  const tokenStorage = createSessionStorageAdapter();

  const getCurrentPath = () =>
    `${window.location.pathname}${window.location.search}${window.location.hash}`;

  const buildLoginUrl = () => {
    const next = encodeURIComponent(getCurrentPath());
    const separator = loginPath.includes("?") ? "&" : "?";
    return `${loginPath}${separator}next=${next}`;
  };

  const storeToken = (token, expiresAt) => {
    if (!token || !expiresAt) {
      return;
    }

    tokenStorage.setItem(TOKEN_KEY, token);
    tokenStorage.setItem(TOKEN_EXPIRY_KEY, String(expiresAt));
  };

  const getToken = () => tokenStorage.getItem(TOKEN_KEY);

  const getTokenExpiry = () =>
    parseInt(tokenStorage.getItem(TOKEN_EXPIRY_KEY) || "0", 10);

  const clearToken = () => {
    tokenStorage.removeItem(TOKEN_KEY);
    tokenStorage.removeItem(TOKEN_EXPIRY_KEY);
  };

  const nowInSeconds = () => Math.floor(Date.now() / 1000);

  const isTokenValid = () => getTokenExpiry() > nowInSeconds();

  const tokenNeedsRefresh = () => getTokenExpiry() - nowInSeconds() < 1800;

  const redirectToLogin = () => {
    const target = buildLoginUrl();

    if (getCurrentPath() === target) {
      return;
    }

    window.location.assign(target);
  };

  const parseResponse = async (response) => {
    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return response.json();
    }

    const text = await response.text();
    return text ? { message: text } : null;
  };

  const requestToken = async () => {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      credentials: "include",
    });
    const data = await parseResponse(response);

    if (!response.ok) {
      const message =
        (data && (data.error || data.message)) ||
        `Auth exchange failed: ${response.status}`;
      throw new Error(message);
    }

    return data;
  };

  const runAuthFailure = (error) => {
    if (typeof config.onAuthFailure === "function") {
      config.onAuthFailure(error);
      return;
    }

    redirectToLogin();
  };

  const ensureToken = async () => {
    if (isTokenValid()) {
      if (tokenNeedsRefresh()) {
        requestToken()
          .then((data) => storeToken(data.token, data.expires))
          .catch(() => {});
      }

      return getToken();
    }

    if (!authInFlight) {
      authInFlight = requestToken()
        .then((data) => {
          storeToken(data.token, data.expires);
          return data.token;
        })
        .finally(() => {
          authInFlight = null;
        });
    }

    return authInFlight;
  };

  const checkAuthOnLoad = async () => {
    try {
      await ensureToken();
    } catch (error) {
      clearToken();
      runAuthFailure(error);
      throw error;
    }
  };

  const buildHeaders = (token, body, extraHeaders) => {
    const headers = new Headers(extraHeaders || {});

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    if (body && !(body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    return headers;
  };

  const api = async (method, endpoint, body = null, options = {}) => {
    const requestOptions = Object.assign(
      {
        headers: {},
        allowAnonymous: false,
        skipRedirectOn401: false,
      },
      options
    );

    let token = null;
    if (!requestOptions.allowAnonymous) {
      try {
        token = await ensureToken();
      } catch (error) {
        clearToken();
        if (!requestOptions.skipRedirectOn401) {
          runAuthFailure(error);
        }
        throw error;
      }
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: buildHeaders(token, body, requestOptions.headers),
      body:
        method === "GET" || method === "DELETE"
          ? undefined
          : body instanceof FormData
            ? body
            : body
              ? JSON.stringify(body)
              : undefined,
      credentials: requestOptions.credentials,
    });
    const data = await parseResponse(response);

    if (response.status === 401 && !requestOptions.allowAnonymous) {
      clearToken();
      if (!requestOptions.skipRedirectOn401) {
        runAuthFailure(new Error("Session expired"));
      }
      throw new Error("Session expired");
    }

    if (!response.ok) {
      throw new Error(
        (data && (data.error || data.message)) || `HTTP ${response.status}`
      );
    }

    return data;
  };

  const ready =
    config.autoAuth === false ? Promise.resolve(null) : checkAuthOnLoad();

  const authApi = {
    API_BASE,
    TOKEN_KEY,
    TOKEN_EXPIRY_KEY,
    ready,
    storeToken,
    getToken,
    getTokenExpiry,
    isTokenValid,
    tokenNeedsRefresh,
    clearToken,
    redirectToLogin,
    requestToken,
    ensureToken,
    checkAuthOnLoad,
    api,
    GET: (endpoint, options) => api("GET", endpoint, null, options),
    POST: (endpoint, body, options) => api("POST", endpoint, body, options),
    PUT: (endpoint, body, options) => api("PUT", endpoint, body, options),
    DELETE: (endpoint, options) => api("DELETE", endpoint, null, options),
  };

  window.MKT_CMS_AUTH = authApi;
  window.GET = authApi.GET;
  window.POST = authApi.POST;
  window.PUT = authApi.PUT;
  window.DELETE = authApi.DELETE;
})(window);
