(function bootstrapCmsUi(window, document) {
  const body = document.body;
  const navGroups = [
    {
      title: "Content",
      items: [
        { href: "/pages/visual-editor.html", label: "Visual Editor" },
        { href: "/pages/products.html", label: "Products" },
        { href: "/pages/gallery.html", label: "Gallery" },
        { href: "/pages/blog.html", label: "Blog" },
        { href: "/pages/blog-editor.html", label: "Blog Editor" },
        {
          href: "/pages/testimonials.html",
          label: "Testimonials",
          badgeId: "pending-count",
        },
      ],
    },
    {
      title: "Marketing",
      items: [
        { href: "/pages/promotions.html", label: "Promotions" },
        { href: "/pages/seo.html", label: "SEO" },
        { href: "/pages/analytics.html", label: "Analytics" },
      ],
    },
    {
      title: "Business",
      items: [
        { href: "/pages/invoices.html", label: "Invoices" },
        { href: "/pages/warranty.html", label: "Warranty" },
        { href: "/pages/records.html", label: "Records" },
        { href: "/pages/sales.html", label: "Sales" },
      ],
    },
    {
      title: "System",
      items: [{ href: "/pages/media.html", label: "Media Library" }],
    },
  ];

  let modalRoot = null;
  let toastRoot = null;

  const escapeHtml = (value) =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const textOnly = (cell) => {
    if (cell == null) {
      return "";
    }

    if (typeof cell === "object") {
      return String(cell.value || cell.label || "");
    }

    return String(cell);
  };

  const renderActionButton = (action, index) =>
    `<button class="btn btn-${escapeHtml(
      action.variant || "primary"
    )}" data-action-id="${index}">${escapeHtml(action.label)}</button>`;

  const renderSidebarLink = (item) => {
    const badge =
      item.badgeId === "pending-count"
        ? '<span class="sidebar-badge" id="pending-count" style="display:none">0</span>'
        : "";

    return `
      <a class="sidebar-link" href="${item.href}">
        <span class="sidebar-link-label">
          <span class="sidebar-link-glyph" aria-hidden="true"></span>
          <span>${escapeHtml(item.label)}</span>
        </span>
        ${badge}
      </a>
    `;
  };

  const renderSidebar = () => `
    <div class="sidebar-brand">
      <a href="/dashboard.html" aria-label="Open dashboard">
        <img src="/assets/images/cms-logo-dark.png" alt="MK Tintworks CMS logo">
      </a>
      <div class="sidebar-brand-copy">
        <strong>MK Tintworks CMS</strong>
        <small>Dark-mode command center for content, sales, and operations.</small>
      </div>
      <div class="sidebar-overview">
        <div>
          <span>Workspace</span>
          <strong>Section 19 live</strong>
        </div>
        <span class="badge badge-gold">Live</span>
      </div>
    </div>
    <nav class="sidebar-nav" aria-label="CMS navigation">
      <div class="sidebar-group">
        <span class="sidebar-group-title">Overview</span>
        <div class="sidebar-links">
          <a class="sidebar-link" href="/dashboard.html">
            <span class="sidebar-link-label">
              <span class="sidebar-link-glyph" aria-hidden="true"></span>
              <span>Dashboard</span>
            </span>
          </a>
        </div>
      </div>
      ${navGroups
        .map(
          (group) => `
            <div class="sidebar-group">
              <span class="sidebar-group-title">${escapeHtml(group.title)}</span>
              <div class="sidebar-links">
                ${group.items.map(renderSidebarLink).join("")}
              </div>
            </div>
          `
        )
        .join("")}
    </nav>
    <div class="sidebar-footer">
      <div class="sidebar-note">
        <strong>Security</strong>
        Cloudflare Access opens the door. JWT keeps API access locked after entry.
      </div>
      <button class="btn btn-secondary btn-sm" id="logout-btn" type="button">Log Out</button>
    </div>
  `;

  const renderTopbar = () => {
    const title = body.dataset.pageTitle || "CMS";
    const description =
      body.dataset.pageDescription ||
      "Manage MK Tintworks content, promotions, documents, and reporting.";

    return `
      <div class="cms-topbar-copy">
        <span class="cms-kicker">MK Tintworks Admin</span>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(description)}</p>
      </div>
      <div class="cms-topbar-actions">
        <button class="btn btn-secondary btn-sm mobile-only" id="sidebar-toggle" type="button">Menu</button>
        <div class="cms-user-pill">
          <strong>Access Guarded</strong>
          <span>JWT session active</span>
        </div>
      </div>
    `;
  };

  const normalizePath = (value) =>
    String(value || "/")
      .replace(/\/index\.html$/, "/")
      .replace(/\/$/, "") || "/";

  const markActiveLink = () => {
    const currentPath = normalizePath(window.location.pathname);

    document.querySelectorAll(".sidebar-link").forEach((link) => {
      const targetPath = normalizePath(new URL(link.href, window.location.origin).pathname);
      link.classList.toggle("is-active", currentPath === targetPath);
    });
  };

  const closeSidebar = () => {
    body.classList.remove("sidebar-open");
  };

  const bindSidebarControls = () => {
    const toggle = document.getElementById("sidebar-toggle");
    const backdrop = document.getElementById("sidebar-backdrop");

    toggle?.addEventListener("click", () => {
      body.classList.toggle("sidebar-open");
    });

    backdrop?.addEventListener("click", closeSidebar);

    window.addEventListener("resize", () => {
      if (window.innerWidth > 1024) {
        closeSidebar();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeSidebar();
        closeModal();
      }
    });
  };

  const bindLogout = () => {
    const logoutButton = document.getElementById("logout-btn");

    logoutButton?.addEventListener("click", () => {
      window.MKT_CMS_AUTH?.clearToken();
      window.location.assign("/index.html");
    });
  };

  const ensureToastRoot = () => {
    if (toastRoot) {
      return toastRoot;
    }

    toastRoot = document.createElement("div");
    toastRoot.className = "cms-toast-stack";
    document.body.appendChild(toastRoot);
    return toastRoot;
  };

  const showToast = (message, type = "success", duration = 3500) => {
    const root = ensureToastRoot();
    const toast = document.createElement("div");
    const labels = {
      success: "Success",
      error: "Action failed",
      warning: "Check this",
      info: "Update",
    };

    toast.className = "cms-toast";
    toast.dataset.type = type;
    toast.innerHTML = `
      <strong>${labels[type] || "Notice"}</strong>
      <span>${escapeHtml(message)}</span>
    `;
    root.appendChild(toast);

    window.setTimeout(() => {
      toast.remove();
    }, duration);
  };

  const ensureModalRoot = () => {
    if (modalRoot) {
      return modalRoot;
    }

    modalRoot = document.createElement("div");
    modalRoot.className = "cms-modal-root";
    modalRoot.innerHTML = '<div class="cms-modal" role="dialog" aria-modal="true"></div>';
    modalRoot.addEventListener("click", (event) => {
      if (event.target === modalRoot || event.target.hasAttribute("data-modal-close")) {
        closeModal();
      }
    });
    document.body.appendChild(modalRoot);
    return modalRoot;
  };

  const closeModal = () => {
    if (!modalRoot) {
      return;
    }

    modalRoot.classList.remove("is-open");
    const panel = modalRoot.querySelector(".cms-modal");
    if (panel) {
      panel.className = "cms-modal";
      panel.innerHTML = "";
    }
  };

  const openModal = (config) => {
    const root = ensureModalRoot();
    const panel = root.querySelector(".cms-modal");
    const actions = Array.isArray(config.actions) ? config.actions : [];
    const sizeClass = config.size ? `cms-modal-${escapeHtml(config.size)}` : "";
    const extraClass = config.className ? String(config.className).trim() : "";
    const footerVisible = actions.length > 0 || Boolean(config.caption);

    panel.className = ["cms-modal", sizeClass, extraClass]
      .filter(Boolean)
      .join(" ");

    panel.innerHTML = `
      <header>
        <h3>${escapeHtml(config.title || "Notice")}</h3>
        <button class="btn btn-ghost btn-sm" data-modal-close type="button">Close</button>
      </header>
      <div class="cms-modal-body">${config.body || ""}</div>
      <footer class="${footerVisible ? "" : "is-hidden"}">
        <div class="muted">${escapeHtml(config.caption || "")}</div>
        <div class="inline-actions">
          ${actions
            .map(
              (action, index) => `
                <button class="btn btn-${escapeHtml(
                  action.variant || "secondary"
                )}" type="button" data-modal-action="${index}">
                  ${escapeHtml(action.label)}
                </button>
              `
            )
            .join("")}
        </div>
      </footer>
    `;

    panel.querySelectorAll("[data-modal-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = actions[Number(button.dataset.modalAction)];
        if (!action) {
          return;
        }

        if (typeof action.onClick === "function") {
          action.onClick();
        }

        if (action.closeOnClick !== false) {
          closeModal();
        }
      });
    });

    root.classList.add("is-open");
    return { root, panel };
  };

  const confirmAction = (message, onConfirm) => {
    openModal({
      title: "Confirm action",
      body: `<p>${escapeHtml(message)}</p>`,
      actions: [
        {
          label: "Cancel",
          variant: "secondary",
        },
        {
          label: "Confirm",
          variant: "primary",
          onClick: () => {
            if (typeof onConfirm === "function") {
              onConfirm();
            }
          },
        },
      ],
    });
  };

  const bindTableSearch = (scope) => {
    scope.querySelectorAll("[data-table-search]").forEach((input) => {
      const tableCard = input.closest(".panel-card");
      const rows = Array.from(tableCard.querySelectorAll("tbody tr"));
      const emptyState = tableCard.querySelector(".table-empty");

      input.addEventListener(
        "input",
        window.debounce(() => {
          const query = input.value.trim().toLowerCase();
          let visibleRows = 0;

          rows.forEach((row) => {
            const matches =
              !query || row.dataset.searchIndex.toLowerCase().includes(query);
            row.hidden = !matches;
            if (matches) {
              visibleRows += 1;
            }
          });

          emptyState?.classList.toggle("is-visible", visibleRows === 0);
        }, 120)
      );
    });
  };

  const formatCell = (cell) => {
    if (cell == null || cell === "") {
      return "—";
    }

    if (typeof cell === "object") {
      if (cell.type === "status" && typeof window.statusBadge === "function") {
        return window.statusBadge(cell.value);
      }

      if (cell.type === "tier" && typeof window.tierBadge === "function") {
        return window.tierBadge(cell.value);
      }

      if (cell.type === "html") {
        return cell.value;
      }

      if (cell.type === "currency" && typeof window.formatKSh === "function") {
        return window.formatKSh(cell.value);
      }

      return escapeHtml(cell.value || "");
    }

    return escapeHtml(String(cell));
  };

  const renderMetricCard = (metric) => `
    <article class="metric-card" data-tone="${escapeHtml(metric.tone || "neutral")}">
      <span class="metric-label">${escapeHtml(metric.label)}</span>
      <strong>${escapeHtml(metric.value)}</strong>
      <p>${escapeHtml(metric.hint || "")}</p>
    </article>
  `;

  const renderTable = (table) => `
    <article class="panel-card is-tall">
      <div class="panel-heading">
        <div class="panel-heading-copy">
          <span class="eyebrow">${escapeHtml(table.eyebrow || "Live Data")}</span>
          <h3>${escapeHtml(table.title)}</h3>
          <p>${escapeHtml(table.description || "")}</p>
        </div>
      </div>
      <div class="table-toolbar">
        <div class="surface-note">
          <strong>${escapeHtml(table.captionLabel || "Focus")}</strong>
          ${escapeHtml(table.caption || "Keep the critical fields obvious and safe to update.")}
        </div>
        <div class="field table-search">
          <label for="table-search">Quick filter</label>
          <input id="table-search" type="search" placeholder="${escapeHtml(
            table.searchPlaceholder || "Search rows"
          )}" data-table-search>
        </div>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>${table.columns
              .map((column) => `<th>${escapeHtml(column)}</th>`)
              .join("")}</tr>
          </thead>
          <tbody>
            ${table.rows
              .map(
                (row) => `
                  <tr data-search-index="${escapeHtml(row.map(textOnly).join(" "))}">
                    ${row.map((cell) => `<td>${formatCell(cell)}</td>`).join("")}
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
      <p class="table-empty">${escapeHtml(
        table.emptyMessage || "No rows matched that filter."
      )}</p>
    </article>
  `;

  const renderSecondaryCard = (card) => {
    if (card.type === "timeline") {
      return `
        <article class="panel-card">
          <div class="panel-heading-copy">
            <span class="eyebrow">${escapeHtml(card.eyebrow || "Activity")}</span>
            <h3>${escapeHtml(card.title)}</h3>
          </div>
          <ul class="timeline">
            ${card.items
              .map(
                (item) => `
                  <li>
                    <strong>${escapeHtml(item.title)}</strong>
                    <span>${escapeHtml(item.meta || "")}</span>
                  </li>
                `
              )
              .join("")}
          </ul>
        </article>
      `;
    }

    if (card.type === "logos") {
      return `
        <article class="panel-card">
          <div class="panel-heading-copy">
            <span class="eyebrow">${escapeHtml(card.eyebrow || "Assets")}</span>
            <h3>${escapeHtml(card.title)}</h3>
            <p>${escapeHtml(card.description || "")}</p>
          </div>
          <div class="logo-row">
            ${card.items
              .map(
                (item) => `
                  <div class="logo-chip">
                    <img src="${item.src}" alt="${escapeHtml(item.alt || item.label)}">
                    <div>
                      <strong>${escapeHtml(item.label)}</strong>
                      <p class="muted">${escapeHtml(item.meta || "")}</p>
                    </div>
                  </div>
                `
              )
              .join("")}
          </div>
        </article>
      `;
    }

    const listClass = card.type === "checklist" ? "checklist" : "list-card";
    return `
      <article class="panel-card">
        <div class="panel-heading-copy">
          <span class="eyebrow">${escapeHtml(card.eyebrow || "Checklist")}</span>
          <h3>${escapeHtml(card.title)}</h3>
          <p>${escapeHtml(card.description || "")}</p>
        </div>
        <ul class="${listClass}">
          ${card.items
            .map(
              (item) => `
                <li>
                  <strong>${escapeHtml(item.title || item)}</strong>
                  ${item.meta ? `<span>${escapeHtml(item.meta)}</span>` : ""}
                </li>
              `
            )
            .join("")}
        </ul>
      </article>
    `;
  };

  const bindActions = (scope, actions) => {
    scope.querySelectorAll("[data-action-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = actions[Number(button.dataset.actionId)];
        if (!action) {
          return;
        }

        const runAction = () => {
          if (typeof action.onClick === "function") {
            action.onClick(button);
            return;
          }

          showToast(action.toast || `${action.label} queued.`, action.toastType || "success");
        };

        if (action.confirmMessage) {
          confirmAction(action.confirmMessage, runAction);
          return;
        }

        runAction();
      });
    });
  };

  const mountModulePage = (config) => {
    const host = document.querySelector("[data-module-shell]");
    if (!host) {
      return;
    }

    const actions = Array.isArray(config.actions) ? config.actions : [];
    host.innerHTML = `
      <section class="hero-banner">
        <div class="content-cluster">
          <span class="eyebrow">${escapeHtml(config.eyebrow || "Module")}</span>
          <h2>${escapeHtml(config.title)}</h2>
          <p>${escapeHtml(config.description)}</p>
        </div>
        <div class="hero-actions">
          ${actions.map(renderActionButton).join("")}
        </div>
      </section>
      <section class="summary-grid">
        ${(config.metrics || []).map(renderMetricCard).join("")}
      </section>
      <section class="page-grid">
        ${renderTable(config.primary)}
        <div class="stack-grid">
          ${(config.secondary || []).map(renderSecondaryCard).join("")}
        </div>
      </section>
    `;

    bindActions(host, actions);
    bindTableSearch(host);
  };

  const mountDashboardPage = (config) => {
    const host = document.querySelector("[data-dashboard-shell]");
    if (!host) {
      return;
    }

    const actions = Array.isArray(config.actions) ? config.actions : [];
    host.innerHTML = `
      <section class="hero-banner">
        <div class="content-cluster">
          <span class="eyebrow">${escapeHtml(config.eyebrow || "Control Room")}</span>
          <h2>${escapeHtml(config.title)}</h2>
          <p>${escapeHtml(config.description)}</p>
        </div>
        <div class="hero-actions">
          ${actions.map(renderActionButton).join("")}
        </div>
      </section>
      <section class="summary-grid">
        ${(config.metrics || []).map(renderMetricCard).join("")}
      </section>
      <section class="dashboard-grid">
        <article class="panel-card">
          <div class="panel-heading-copy">
            <span class="eyebrow">Modules</span>
            <h3>Jump straight into work</h3>
            <p>Every Phase 1 area is reachable from one stable dashboard.</p>
          </div>
          <div class="module-card-grid">
            ${(config.modules || [])
              .map(
                (item) => `
                  <a class="module-tile" href="${item.href}">
                    <strong>${escapeHtml(item.label)}</strong>
                    <span>${escapeHtml(item.summary)}</span>
                    ${window.statusBadge ? window.statusBadge(item.status) : ""}
                  </a>
                `
              )
              .join("")}
          </div>
        </article>
        <div class="stack-grid">
          ${(config.spotlights || []).map(renderSecondaryCard).join("")}
        </div>
      </section>
      <section class="split-card">
        <article class="panel-card">
          <div class="panel-heading-copy">
            <span class="eyebrow">Recent Activity</span>
            <h3>What needs attention next</h3>
          </div>
          <ul class="timeline">
            ${(config.timeline || [])
              .map(
                (item) => `
                  <li>
                    <strong>${escapeHtml(item.title)}</strong>
                    <span>${escapeHtml(item.meta)}</span>
                  </li>
                `
              )
              .join("")}
          </ul>
        </article>
        <article class="panel-card">
          <div class="panel-heading-copy">
            <span class="eyebrow">Quick Links</span>
            <h3>Most-used flows</h3>
            <p>Shortcuts for the daily publish, pricing, and document tasks.</p>
          </div>
          <div class="quick-links">
            ${(config.quickLinks || [])
              .map(
                (item) => `
                  <a href="${item.href}">
                    <strong>${escapeHtml(item.label)}</strong>
                    <span>${escapeHtml(item.summary)}</span>
                  </a>
                `
              )
              .join("")}
          </div>
        </article>
      </section>
    `;

    bindActions(host, actions);
  };

  const loadPendingCount = async () => {
    const badge = document.getElementById("pending-count");
    if (!badge || !window.GET) {
      return;
    }

    try {
      await (window.MKT_CMS_AUTH?.ready || Promise.resolve());
      const data = await window.GET("/api/testimonials/pending-count");
      const count = Number(data && (data.count || data.pending || 0));

      if (count > 0) {
        badge.textContent = String(count);
        badge.style.display = "inline-flex";
      }
    } catch {
      // Silent failure is intentional for this UX.
    }
  };

  const initShell = () => {
    const sidebar = document.getElementById("cms-sidebar");
    const topbar = document.getElementById("cms-topbar");
    const backdrop = document.getElementById("sidebar-backdrop");

    if (sidebar) {
      sidebar.innerHTML = renderSidebar();
    }

    if (topbar) {
      topbar.innerHTML = renderTopbar();
    }

    if (!backdrop && sidebar) {
      const nextBackdrop = document.createElement("div");
      nextBackdrop.className = "sidebar-backdrop";
      nextBackdrop.id = "sidebar-backdrop";
      document.body.appendChild(nextBackdrop);
    }

    markActiveLink();
    bindSidebarControls();
    bindLogout();
    loadPendingCount();
  };

  window.showToast = showToast;
  window.openModal = openModal;
  window.closeModal = closeModal;
  window.confirmAction = confirmAction;
  window.MKT_CMS_UI = {
    initShell,
    markActiveLink,
    mountModulePage,
    mountDashboardPage,
    showToast,
    openModal,
    closeModal,
    confirmAction,
  };

  initShell();
})(window, document);
