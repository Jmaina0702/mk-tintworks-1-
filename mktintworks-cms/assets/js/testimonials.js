(function initTestimonialsManager(window, document) {
  const shell = document.querySelector("[data-module-shell]");
  if (!shell) {
    return;
  }

  const serviceLabels = {
    automotive: "Automotive Tinting",
    residential: "Residential Tinting",
    commercial: "Commercial Tinting",
  };

  const state = {
    testimonials: [],
    activeTab: "pending",
  };

  const escapeHtml = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const formatService = (value) =>
    serviceLabels[String(value || "").trim().toLowerCase()] || "Tinting Service";

  const normalizeTestimonial = (item) => ({
    id: Number(item?.id || 0),
    client_name: String(item?.client_name || "").trim(),
    service_type: String(item?.service_type || "").trim().toLowerCase(),
    rating: Math.max(1, Math.min(5, Number(item?.rating || 0) || 0)),
    review_text: String(item?.review_text || "").trim(),
    status: String(item?.status || "pending").trim().toLowerCase(),
    display_order: Number(item?.display_order || 0),
    submitted_at: item?.submitted_at || null,
    approved_at: item?.approved_at || null,
  });

  const getItemsForStatus = (status) =>
    state.testimonials
      .filter((item) => item.status === status)
      .sort((left, right) => {
        if (status === "approved") {
          return (
            left.display_order - right.display_order ||
            new Date(right.approved_at || 0).getTime() -
              new Date(left.approved_at || 0).getTime() ||
            right.id - left.id
          );
        }

        return (
          new Date(right.submitted_at || 0).getTime() -
            new Date(left.submitted_at || 0).getTime() ||
          right.id - left.id
        );
      });

  const renderStats = () => {
    const counts = {
      pending: getItemsForStatus("pending").length,
      approved: getItemsForStatus("approved").length,
      rejected: getItemsForStatus("rejected").length,
    };

    const pendingValue = document.getElementById("stat-pending");
    const approvedValue = document.getElementById("stat-approved");
    const rejectedValue = document.getElementById("stat-rejected");
    const pendingTabCount = document.getElementById("pending-tab-count");
    const sidebarCount = document.getElementById("pending-count");

    if (pendingValue) {
      pendingValue.textContent = String(counts.pending);
    }
    if (approvedValue) {
      approvedValue.textContent = String(counts.approved);
    }
    if (rejectedValue) {
      rejectedValue.textContent = String(counts.rejected);
    }

    if (pendingTabCount) {
      pendingTabCount.textContent = String(counts.pending);
      pendingTabCount.hidden = counts.pending <= 0;
    }

    if (sidebarCount) {
      sidebarCount.textContent = String(counts.pending);
      sidebarCount.style.display = counts.pending > 0 ? "inline-flex" : "none";
    }
  };

  const renderActions = (item, status) => {
    if (status === "pending") {
      return `
        <button class="btn btn-success btn-sm" type="button" data-action="approve" data-id="${item.id}">
          Approve
        </button>
        <button class="btn btn-danger btn-sm" type="button" data-action="reject" data-id="${item.id}">
          Reject
        </button>
      `;
    }

    if (status === "approved") {
      return `
        <button class="btn btn-ghost btn-sm" type="button" data-action="reject" data-id="${item.id}">
          Remove From Website
        </button>
      `;
    }

    return `
      <button class="btn btn-ghost btn-sm" type="button" data-action="approve" data-id="${item.id}">
        Restore To Website
      </button>
    `;
  };

  const renderList = (status) => {
    const host = document.getElementById(`testimonial-list-${status}`);
    if (!host) {
      return;
    }

    const items = getItemsForStatus(status);
    if (!items.length) {
      host.innerHTML = `
        <article class="testimonial-empty-card">
          <strong>No ${escapeHtml(status)} reviews</strong>
          <p>
            ${
              status === "pending"
                ? "New public reviews will appear here as soon as they are submitted."
                : status === "approved"
                  ? "Approved reviews will appear here after moderation."
                  : "Rejected reviews are kept here for audit visibility and optional restore."
            }
          </p>
        </article>
      `;
      return;
    }

    host.innerHTML = items
      .map(
        (item) => `
          <article class="testimonial-item" data-id="${item.id}">
            <div class="testimonial-item-header">
              <div class="testimonial-item-copy">
                <strong class="testimonial-name">${escapeHtml(item.client_name)}</strong>
                <div class="testimonial-item-meta">
                  <span>${escapeHtml(formatService(item.service_type))}</span>
                  <span>${escapeHtml(
                    window.formatRelativeTime
                      ? window.formatRelativeTime(item.submitted_at)
                      : "Recently submitted"
                  )}</span>
                  ${
                    status === "approved" && item.display_order > 0
                      ? `<span>Display order #${item.display_order}</span>`
                      : ""
                  }
                  ${
                    status === "approved" && item.approved_at
                      ? `<span>Approved ${escapeHtml(
                          window.formatDateTime
                            ? window.formatDateTime(item.approved_at)
                            : item.approved_at
                        )}</span>`
                      : ""
                  }
                </div>
              </div>
              <div class="testimonial-item-side">
                <div class="testimonial-stars" aria-label="${item.rating} out of 5 stars">
                  ${"★".repeat(item.rating)}${"☆".repeat(5 - item.rating)}
                </div>
                <div class="testimonial-rating-label">${item.rating}/5</div>
                ${
                  window.statusBadge
                    ? `<div class="testimonial-status-wrap">${window.statusBadge(item.status)}</div>`
                    : ""
                }
              </div>
            </div>

            <blockquote class="testimonial-review">
              "${escapeHtml(item.review_text)}"
            </blockquote>

            <div class="testimonial-actions">
              ${renderActions(item, status)}
            </div>
          </article>
        `
      )
      .join("");
  };

  const renderPanels = () => {
    ["pending", "approved", "rejected"].forEach((status) => {
      const panel = document.getElementById(`tab-${status}`);
      const button = document.querySelector(`[data-tab="${status}"]`);
      const isActive = state.activeTab === status;

      if (panel) {
        panel.hidden = !isActive;
      }

      if (button) {
        button.className = isActive
          ? "btn btn-secondary testimonial-tab is-active"
          : "btn btn-ghost testimonial-tab";
      }

      renderList(status);
    });
  };

  const updateUi = () => {
    renderStats();
    renderPanels();
  };

  const renderShell = () => {
    shell.innerHTML = `
      <section class="testimonials-module">
        <article class="panel-card testimonials-overview">
          <div class="testimonials-header">
            <div class="testimonials-copy">
              <p class="section-kicker">Testimonials Pipeline</p>
              <h2>Review incoming public feedback before it reaches the website.</h2>
              <p>
                New reviews land here as pending, trigger an email notification, and only go live after an explicit approval action.
              </p>
            </div>
            <div class="inline-actions">
              <button class="btn btn-secondary" type="button" id="refresh-testimonials">
                Refresh Queue
              </button>
            </div>
          </div>
        </article>

        <section class="summary-grid testimonial-metrics">
          <article class="metric-card" data-tone="warning">
            <span class="metric-label">Pending</span>
            <strong id="stat-pending">0</strong>
            <p>Reviews waiting for moderation before they can go live.</p>
          </article>
          <article class="metric-card" data-tone="success">
            <span class="metric-label">Approved</span>
            <strong id="stat-approved">0</strong>
            <p>Reviews currently eligible for build-time public rendering.</p>
          </article>
          <article class="metric-card" data-tone="danger">
            <span class="metric-label">Rejected</span>
            <strong id="stat-rejected">0</strong>
            <p>Hidden reviews kept out of the live site until restored.</p>
          </article>
        </section>

        <article class="panel-card">
          <div class="testimonials-tab-row" role="tablist" aria-label="Testimonials status filters">
            <button class="btn btn-secondary testimonial-tab is-active" type="button" data-tab="pending">
              Pending
              <span class="testimonial-tab-count" id="pending-tab-count">0</span>
            </button>
            <button class="btn btn-ghost testimonial-tab" type="button" data-tab="approved">
              Approved
            </button>
            <button class="btn btn-ghost testimonial-tab" type="button" data-tab="rejected">
              Rejected
            </button>
          </div>

          <div class="testimonial-panels">
            <section class="testimonial-panel" id="tab-pending">
              <div class="testimonial-list" id="testimonial-list-pending"></div>
            </section>
            <section class="testimonial-panel" id="tab-approved" hidden>
              <div class="testimonial-list" id="testimonial-list-approved"></div>
            </section>
            <section class="testimonial-panel" id="tab-rejected" hidden>
              <div class="testimonial-list" id="testimonial-list-rejected"></div>
            </section>
          </div>
        </article>
      </section>
    `;
  };

  const loadTestimonials = async () => {
    const refreshButton = document.getElementById("refresh-testimonials");

    try {
      window.setButtonLoading?.(refreshButton, true, "Refreshing...");
      const payload = await window.GET("/api/testimonials");
      state.testimonials = Array.isArray(payload?.testimonials)
        ? payload.testimonials.map(normalizeTestimonial)
        : [];
      updateUi();
    } catch (error) {
      window.showToast(error.message || "Failed to load testimonials.", "error");
    } finally {
      window.setButtonLoading?.(refreshButton, false);
    }
  };

  const mutateReview = async (button, action, id) => {
    const isApprove = action === "approve";
    const endpoint = isApprove
      ? "/api/testimonials/approve"
      : "/api/testimonials/reject";
    const successMessage = isApprove
      ? "Review approved. It should appear on the website after the next rebuild."
      : "Review rejected.";
    const loadingLabel = isApprove ? "Approving..." : "Rejecting...";

    try {
      window.setButtonLoading?.(button, true, loadingLabel);
      await window.POST(endpoint, { id });
      window.showToast(successMessage, isApprove ? "success" : "info");
      await loadTestimonials();
    } catch (error) {
      window.showToast(error.message || "Update failed.", "error");
    } finally {
      window.setButtonLoading?.(button, false);
    }
  };

  const bindActions = () => {
    shell.addEventListener("click", (event) => {
      const tabButton = event.target.closest("[data-tab]");
      if (tabButton) {
        state.activeTab = tabButton.dataset.tab || "pending";
        renderPanels();
        return;
      }

      const refreshButton = event.target.closest("#refresh-testimonials");
      if (refreshButton) {
        loadTestimonials();
        return;
      }

      const actionButton = event.target.closest("[data-action][data-id]");
      if (!actionButton) {
        return;
      }

      const id = Number(actionButton.dataset.id || 0);
      const action = String(actionButton.dataset.action || "");
      if (!id || !action) {
        return;
      }

      mutateReview(actionButton, action, id);
    });
  };

  const boot = async () => {
    renderShell();
    bindActions();
    await window.MKT_CMS_AUTH.ready;
    await loadTestimonials();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})(window, document);
