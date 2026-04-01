(function initPromotionsManager(window, document) {
  const shell = document.querySelector("[data-module-shell]");
  if (!shell) {
    return;
  }

  const FEATURED_BANNER_TARGET_KB = 400;
  const PROMO_MODAL_CLASS = "promo-modal-shell";

  const state = {
    promotions: [],
    modalPromotionId: null,
    modalImageUrl: "",
    modalImageFile: null,
  };

  const escapeHtml = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const normalizePromotion = (promotion) => ({
    id: Number(promotion?.id || 0),
    title: String(promotion?.title || "").trim(),
    image_url: String(promotion?.image_url || "").trim(),
    link_url: String(promotion?.link_url || "").trim(),
    animation_type: String(promotion?.animation_type || "fade").trim().toLowerCase(),
    display_duration: Math.max(2000, Number(promotion?.display_duration || 5000)),
    season: String(promotion?.season || "").trim().toLowerCase(),
    custom_label: String(promotion?.custom_label || "").trim(),
    start_datetime: promotion?.start_datetime || null,
    end_datetime: promotion?.end_datetime || null,
    display_order: Number(promotion?.display_order || 0),
    is_active: Number(promotion?.is_active || 0) === 1 ? 1 : 0,
    created_at: promotion?.created_at || null,
    state: String(promotion?.state || "").trim().toLowerCase(),
  });

  const computePromotionState = (promotion) => {
    if (promotion.state) {
      return promotion.state;
    }

    const now = Date.now();
    const startTime = new Date(promotion.start_datetime || "").getTime();
    const endTime = new Date(promotion.end_datetime || "").getTime();

    if (Number.isFinite(endTime) && endTime <= now) {
      return "expired";
    }

    if (!promotion.is_active) {
      return "paused";
    }

    if (Number.isFinite(startTime) && startTime > now) {
      return "scheduled";
    }

    return "live";
  };

  const renderStateBadge = (promotion) => {
    const currentState = computePromotionState(promotion);
    const tone =
      currentState === "live"
        ? "success"
        : currentState === "scheduled"
          ? "warning"
          : currentState === "paused"
            ? "danger"
            : "neutral";
    const label =
      currentState === "live"
        ? "Live"
        : currentState === "scheduled"
          ? "Scheduled"
          : currentState === "paused"
            ? "Paused"
            : "Expired";

    return `<span class="badge badge-${tone}">${label}</span>`;
  };

  const buildPromoForm = (promotion) => `
    <form class="promo-form" id="promo-form">
      <div class="field">
        <label>Banner Image <span class="required">*</span></label>
        <button class="promo-upload-zone" id="promo-upload-zone" type="button">
          <span class="promo-upload-zone-copy">
            <strong>Upload your Canva banner image</strong>
            <span>PNG, JPG, or WebP. Recommended: 1440 x 80px for slim bars or 1440 x 300px for tall campaign banners.</span>
          </span>
        </button>
        <input type="file" id="promo-image-input" accept="image/jpeg,image/png,image/webp" hidden>
        <img
          id="promo-img-preview"
          class="promo-image-preview"
          src="${escapeHtml(promotion?.image_url || "")}"
          alt="${escapeHtml(promotion?.title || "Promotion banner preview")}"
          ${promotion?.image_url ? "" : "hidden"}
        >
        <span class="field-hint">Banners are designed externally in Canva. The CMS only uploads, schedules, and displays them.</span>
      </div>

      <div class="field">
        <label for="promo-title">Internal Label <span class="required">*</span></label>
        <input
          type="text"
          id="promo-title"
          maxlength="100"
          value="${escapeHtml(promotion?.title || "")}"
          placeholder="e.g. Easter 2026 - 20% off Crystalline"
        >
        <span class="field-hint">This label stays inside the CMS. It does not appear on the live website.</span>
      </div>

      <div class="field">
        <label for="promo-link">Click-through URL</label>
        <input
          type="text"
          id="promo-link"
          value="${escapeHtml(promotion?.link_url || "")}"
          placeholder="/services.html or https://mktintworks.com/services.html"
        >
        <span class="field-hint">Optional. Use a site-relative path or a full http(s) URL.</span>
      </div>

      <div class="promo-form-grid">
        <div class="field">
          <label for="promo-animation">Entrance Animation</label>
          <select id="promo-animation">
            <option value="fade" ${promotion?.animation_type === "fade" ? "selected" : ""}>Fade In</option>
            <option value="slide-down" ${promotion?.animation_type === "slide-down" ? "selected" : ""}>Slide Down</option>
            <option value="bounce" ${promotion?.animation_type === "bounce" ? "selected" : ""}>Bounce</option>
            <option value="zoom" ${promotion?.animation_type === "zoom" ? "selected" : ""}>Zoom In</option>
            <option value="slide-right" ${promotion?.animation_type === "slide-right" ? "selected" : ""}>Slide Right</option>
          </select>
        </div>

        <div class="field">
          <label for="promo-duration">Show Duration (ms)</label>
          <input
            type="number"
            id="promo-duration"
            min="2000"
            max="30000"
            step="500"
            value="${escapeHtml(promotion?.display_duration || 5000)}"
          >
          <span class="field-hint">Only used when multiple live banners rotate in the public carousel.</span>
        </div>

        <div class="field">
          <label for="promo-start">Start Date &amp; Time <span class="required">*</span></label>
          <input type="datetime-local" id="promo-start" value="${escapeHtml((promotion?.start_datetime || "").slice(0, 16))}">
        </div>

        <div class="field">
          <label for="promo-end">End Date &amp; Time <span class="required">*</span></label>
          <input type="datetime-local" id="promo-end" value="${escapeHtml((promotion?.end_datetime || "").slice(0, 16))}">
        </div>
      </div>

      <div class="field">
        <label for="promo-season">Season / Campaign Type</label>
        <select id="promo-season">
          <option value="" ${!promotion?.season ? "selected" : ""}>No specific season</option>
          <option value="easter" ${promotion?.season === "easter" ? "selected" : ""}>Easter</option>
          <option value="christmas" ${promotion?.season === "christmas" ? "selected" : ""}>Christmas</option>
          <option value="eid" ${promotion?.season === "eid" ? "selected" : ""}>Eid</option>
          <option value="custom" ${promotion?.season === "custom" ? "selected" : ""}>Custom Campaign</option>
        </select>
      </div>

      <div class="field" id="custom-label-field" ${promotion?.season === "custom" ? "" : "hidden"}>
        <label for="promo-custom-label">Custom Campaign Name</label>
        <input
          type="text"
          id="promo-custom-label"
          value="${escapeHtml(promotion?.custom_label || "")}"
          placeholder="e.g. Nairobi Motor Show or End of Year Sale"
        >
      </div>

      <label class="promo-toggle-row" for="promo-active">
        <span>
          <strong>Banner is enabled</strong>
          <small>It will appear on the website automatically when the schedule window is live.</small>
        </span>
        <span class="switch">
          <input type="checkbox" id="promo-active" ${promotion?.is_active !== 0 ? "checked" : ""}>
          <span class="switch-track"></span>
        </span>
      </label>

      <p class="promo-form-status" id="promo-save-status" aria-live="polite"></p>
    </form>
  `;

  const renderShell = () => {
    shell.innerHTML = `
      <section class="promotions-manager">
        <section class="panel-card promotions-overview">
          <div class="promotions-header">
            <div class="promotions-copy">
              <p class="section-kicker">Promotions + Announcements</p>
              <h2>Schedule Canva banners without touching the website markup.</h2>
              <p>
                Upload finished banner artwork, set animation and timing, then let the public site
                surface live campaigns above the navigation bar with session-based dismiss handling.
              </p>
            </div>
            <button class="btn btn-primary" id="new-promo-btn" type="button">+ New Banner</button>
          </div>

          <div class="promotions-metrics" id="promotions-metrics"></div>
        </section>

        <div id="active-banner-info"></div>

        <section class="panel-card">
          <div class="panel-heading-copy promotions-list-heading">
            <div>
              <span class="eyebrow">Banner Library</span>
              <h3>All configured promotions</h3>
              <p>Live banners render on the website immediately from the Worker active feed. Scheduled and paused rows stay ready for future windows.</p>
            </div>
          </div>
          <div class="promo-list" id="promotions-list"></div>
        </section>
      </section>
    `;
  };

  const renderMetrics = () => {
    const metrics = document.getElementById("promotions-metrics");
    if (!metrics) {
      return;
    }

    const counts = {
      total: state.promotions.length,
      live: 0,
      scheduled: 0,
      paused: 0,
      expired: 0,
    };

    state.promotions.forEach((promotion) => {
      const currentState = computePromotionState(promotion);
      if (counts[currentState] !== undefined) {
        counts[currentState] += 1;
      }
    });

    metrics.innerHTML = `
      <article class="metric-card" data-tone="gold">
        <strong>${counts.total}</strong>
        <span class="metric-label">Total banners tracked in the CMS.</span>
      </article>
      <article class="metric-card" data-tone="success">
        <strong>${counts.live}</strong>
        <span class="metric-label">Currently live on the public website.</span>
      </article>
      <article class="metric-card">
        <strong>${counts.scheduled}</strong>
        <span class="metric-label">Scheduled for a future campaign window.</span>
      </article>
      <article class="metric-card" data-tone="danger">
        <strong>${counts.paused + counts.expired}</strong>
        <span class="metric-label">Paused or expired rows waiting on cleanup or reuse.</span>
      </article>
    `;
  };

  const renderActiveInfo = () => {
    const infoEl = document.getElementById("active-banner-info");
    if (!infoEl) {
      return;
    }

    const livePromotions = state.promotions.filter(
      (promotion) => computePromotionState(promotion) === "live"
    );

    if (!livePromotions.length) {
      infoEl.innerHTML = `
        <div class="surface-note promo-surface-note">
          <strong>No live banners right now.</strong>
          Create a new banner or update a schedule window to make one appear above the site navigation.
        </div>
      `;
      return;
    }

    infoEl.innerHTML = `
      <div class="promo-live-note">
        <strong>${livePromotions.length} banner${livePromotions.length === 1 ? " is" : "s are"} live on the website.</strong>
        <span>Visitors will see them above the nav and can dismiss them for the current browser session.</span>
      </div>
    `;
  };

  const renderList = () => {
    const list = document.getElementById("promotions-list");
    if (!list) {
      return;
    }

    if (!state.promotions.length) {
      list.innerHTML = `
        <div class="promo-empty">
          <strong>No banners yet.</strong>
          <span>Upload your first Canva banner to start scheduling campaign announcements.</span>
        </div>
      `;
      return;
    }

    list.innerHTML = state.promotions
      .map((promotion) => {
        const currentState = computePromotionState(promotion);
        const seasonLabel = promotion.custom_label || promotion.season || "General campaign";

        return `
          <article class="promo-card is-${currentState}">
            <img
              class="promo-card-preview"
              src="${escapeHtml(promotion.image_url)}"
              alt="${escapeHtml(promotion.title || seasonLabel)}"
              loading="lazy"
              decoding="async"
            >
            <div class="promo-card-body">
              <div class="promo-card-copy">
                <div class="promo-card-title-row">
                  <h3>${escapeHtml(promotion.title || "Untitled banner")}</h3>
                  ${renderStateBadge(promotion)}
                </div>
                <p class="promo-card-meta">
                  ${escapeHtml(window.formatDateTime(promotion.start_datetime))} to
                  ${escapeHtml(window.formatDateTime(promotion.end_datetime))}
                </p>
                <p class="promo-card-meta">
                  Animation: ${escapeHtml(promotion.animation_type)} ·
                  Rotation: ${escapeHtml(String(Math.round(promotion.display_duration / 100) / 10))}s ·
                  Campaign: ${escapeHtml(seasonLabel)}
                </p>
                ${
                  promotion.link_url
                    ? `<p class="promo-card-link">${escapeHtml(promotion.link_url)}</p>`
                    : `<p class="promo-card-link promo-card-link-empty">No click-through URL configured.</p>`
                }
              </div>
              <div class="promo-card-actions">
                <button class="btn btn-ghost btn-sm" type="button" data-edit-id="${promotion.id}">Edit</button>
                <button class="btn btn-danger btn-sm" type="button" data-delete-id="${promotion.id}">Delete</button>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  };

  const updateUi = () => {
    renderMetrics();
    renderActiveInfo();
    renderList();
  };

  const setModalStatus = (message = "", tone = "") => {
    const status = document.getElementById("promo-save-status");
    if (!status) {
      return;
    }

    status.textContent = message;
    status.className = ["promo-form-status", tone ? `is-${tone}` : ""]
      .filter(Boolean)
      .join(" ");
  };

  const updatePromoPreview = (src, alt = "") => {
    const preview = document.getElementById("promo-img-preview");
    if (!preview) {
      return;
    }

    if (!src) {
      preview.hidden = true;
      preview.removeAttribute("src");
      preview.alt = "";
      return;
    }

    preview.src = src;
    preview.alt = alt;
    preview.hidden = false;
  };

  const bindPromoForm = () => {
    const uploadZone = document.getElementById("promo-upload-zone");
    const imageInput = document.getElementById("promo-image-input");
    const seasonSelect = document.getElementById("promo-season");
    const customField = document.getElementById("custom-label-field");

    uploadZone?.addEventListener("click", () => {
      imageInput?.click();
    });

    imageInput?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      state.modalImageFile = file || null;

      if (!file) {
        return;
      }

      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        updatePromoPreview(
          String(loadEvent.target?.result || ""),
          document.getElementById("promo-title")?.value.trim() || "Promotion banner preview"
        );
      };
      reader.readAsDataURL(file);
      setModalStatus("New banner image selected. Save to upload it.", "info");
    });

    seasonSelect?.addEventListener("change", (event) => {
      const isCustom = event.target.value === "custom";
      if (customField) {
        customField.hidden = !isCustom;
      }
    });

    document.getElementById("promo-title")?.addEventListener("input", (event) => {
      const preview = document.getElementById("promo-img-preview");
      if (preview && !preview.hidden) {
        preview.alt = event.target.value.trim() || "Promotion banner preview";
      }
    });
  };

  const openPromotionModal = (promotion = null) => {
    state.modalPromotionId = promotion?.id || null;
    state.modalImageUrl = promotion?.image_url || "";
    state.modalImageFile = null;

    window.openModal({
      title: promotion ? "Edit Banner" : "Add New Banner",
      body: buildPromoForm(promotion),
      className: PROMO_MODAL_CLASS,
      actions: [
        {
          label: "Cancel",
          variant: "secondary",
        },
        {
          label: promotion ? "Save Changes" : "Save Banner",
          variant: "primary",
          closeOnClick: false,
          onClick: () => {
            savePromotion(state.modalPromotionId);
          },
        },
      ],
    });

    bindPromoForm();
  };

  const uploadBannerImage = async () => {
    if (!state.modalImageFile) {
      return state.modalImageUrl || null;
    }

    if (typeof window.compressImage !== "function") {
      throw new Error("Shared image compression helper is unavailable");
    }

    const compressed = await window.compressImage(
      state.modalImageFile,
      FEATURED_BANNER_TARGET_KB,
      2800
    );
    const extension = compressed.type === "image/webp" ? "webp" : "jpg";
    const safeBase = String(state.modalImageFile.name || "promotion-banner").replace(
      /\.[^.]+$/,
      ""
    );
    const formData = new FormData();
    formData.append("image", compressed, `${safeBase}.${extension}`);

    const payload = await window.POST("/api/promotions/upload-image", formData);
    state.modalImageUrl = String(payload?.cdn_url || "").trim();
    state.modalImageFile = null;
    return state.modalImageUrl || null;
  };

  const savePromotion = async (existingId) => {
    const title = document.getElementById("promo-title")?.value.trim() || "";
    const linkUrl = document.getElementById("promo-link")?.value.trim() || "";
    const animationType = document.getElementById("promo-animation")?.value || "fade";
    const displayDuration =
      parseInt(document.getElementById("promo-duration")?.value || "5000", 10) || 5000;
    const startValue = document.getElementById("promo-start")?.value || "";
    const endValue = document.getElementById("promo-end")?.value || "";
    const season = document.getElementById("promo-season")?.value || "";
    const customLabel =
      document.getElementById("promo-custom-label")?.value.trim() || "";
    const isActive = document.getElementById("promo-active")?.checked ? 1 : 0;
    const saveButton = document.querySelector('[data-modal-action="1"]');

    if (!title) {
      setModalStatus("Internal label is required.", "error");
      return;
    }

    if (!startValue || !endValue) {
      setModalStatus("Start and end dates are required.", "error");
      return;
    }

    if (new Date(endValue) <= new Date(startValue)) {
      setModalStatus("End date must be after start date.", "error");
      return;
    }

    if (season === "custom" && !customLabel) {
      setModalStatus("Enter a custom campaign name for custom banners.", "error");
      return;
    }

    if (!existingId && !state.modalImageFile && !state.modalImageUrl) {
      setModalStatus("Please upload a banner image before saving.", "error");
      return;
    }

    window.setButtonLoading(
      saveButton,
      true,
      existingId ? "Saving..." : "Creating..."
    );
    setModalStatus("Saving banner...", "info");

    try {
      const imageUrl = await uploadBannerImage();

      await window.POST("/api/promotions/save", {
        id: existingId,
        title,
        image_url: imageUrl,
        link_url: linkUrl || null,
        animation_type: animationType,
        display_duration: displayDuration,
        season: season || null,
        custom_label: customLabel || null,
        start_datetime: new Date(startValue).toISOString(),
        end_datetime: new Date(endValue).toISOString(),
        is_active: isActive,
      });

      window.showToast("Banner saved successfully.", "success");
      window.closeModal();
      await loadPromotions();
    } catch (error) {
      setModalStatus(`Save failed: ${error.message}`, "error");
      window.showToast(error.message || "Banner save failed.", "error");
    } finally {
      window.setButtonLoading(saveButton, false);
    }
  };

  const loadPromotions = async () => {
    try {
      const payload = await window.GET("/api/promotions");
      state.promotions = Array.isArray(payload?.promotions)
        ? payload.promotions.map(normalizePromotion)
        : [];
      updateUi();
    } catch (error) {
      window.showToast(error.message || "Failed to load promotions.", "error");
    }
  };

  const editPromotion = async (promotionId) => {
    try {
      const payload = await window.GET(`/api/promotions/${promotionId}`);
      const promotion = payload?.promotion ? normalizePromotion(payload.promotion) : null;
      if (!promotion) {
        throw new Error("Promotion not found.");
      }

      openPromotionModal(promotion);
    } catch (error) {
      window.showToast(error.message || "Failed to load banner details.", "error");
    }
  };

  const deletePromotion = (promotionId) => {
    window.confirmAction(
      "This will permanently delete the selected banner from the promotions schedule.",
      async () => {
        try {
          await window.DELETE(`/api/promotions/${promotionId}`);
          state.promotions = state.promotions.filter(
            (promotion) => promotion.id !== promotionId
          );
          updateUi();
          window.showToast("Banner deleted.", "success");
        } catch (error) {
          window.showToast(error.message || "Delete failed.", "error");
        }
      }
    );
  };

  const bindActions = () => {
    shell.addEventListener("click", (event) => {
      if (event.target.closest("#new-promo-btn")) {
        openPromotionModal();
        return;
      }

      const editButton = event.target.closest("[data-edit-id]");
      if (editButton) {
        editPromotion(Number(editButton.dataset.editId || 0));
        return;
      }

      const deleteButton = event.target.closest("[data-delete-id]");
      if (deleteButton) {
        deletePromotion(Number(deleteButton.dataset.deleteId || 0));
      }
    });
  };

  const boot = async () => {
    renderShell();
    bindActions();
    await window.MKT_CMS_AUTH.ready;
    await loadPromotions();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})(window, document);
