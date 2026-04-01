(function initSeoManager(window, document) {
  const shell = document.querySelector("[data-module-shell]");
  if (!shell) {
    return;
  }

  const SEO_IMAGE_TARGET_KB = 300;
  const PAGE_OPTIONS = [
    { slug: "home", label: "Home Page", path: "/" },
    { slug: "services", label: "Services & Products", path: "/services.html" },
    { slug: "gallery", label: "Gallery", path: "/gallery.html" },
    { slug: "testimonials", label: "Testimonials", path: "/testimonials.html" },
    { slug: "blog", label: "Blog", path: "/blog/" },
    { slug: "book", label: "Book Now", path: "/book.html" },
  ];

  const state = {
    activeSlug: "home",
    settingsBySlug: {},
    persistedOgImageUrl: "",
    previewOgImageUrl: "",
    pendingOgImageFile: null,
    pendingPreviewUrl: "",
  };

  const escapeHtml = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const normalizeSettings = (settings, slug = state.activeSlug) => ({
    page_slug: String(settings?.page_slug || slug || "").trim().toLowerCase(),
    meta_title: String(settings?.meta_title || "").trim(),
    meta_description: String(settings?.meta_description || "").trim(),
    og_image_url: String(settings?.og_image_url || "").trim(),
    og_title: String(settings?.og_title || "").trim(),
    og_description: String(settings?.og_description || "").trim(),
    updated_at: settings?.updated_at || null,
  });

  const getPageOption = (slug) =>
    PAGE_OPTIONS.find((page) => page.slug === slug) || PAGE_OPTIONS[0];

  const revokePendingPreview = () => {
    if (state.pendingPreviewUrl && state.pendingPreviewUrl.startsWith("blob:")) {
      window.URL.revokeObjectURL(state.pendingPreviewUrl);
    }

    state.pendingPreviewUrl = "";
  };

  const setSaveStatus = (message = "", tone = "") => {
    const status = document.getElementById("seo-save-status");
    if (!status) {
      return;
    }

    status.textContent = message;
    status.className = ["seo-save-status", tone ? `is-${tone}` : ""]
      .filter(Boolean)
      .join(" ");
  };

  const updateCounter = (inputId, counterId, max) => {
    const input = document.getElementById(inputId);
    const counter = document.getElementById(counterId);
    if (!input || !counter) {
      return;
    }

    const length = input.value.length;
    counter.textContent = `${length} / ${max}`;
    counter.className = [
      "char-count",
      length > max * 0.9 ? "near-limit" : "",
      length >= max ? "at-limit" : "",
    ]
      .filter(Boolean)
      .join(" ");
  };

  const updateAllCounters = () => {
    updateCounter("seo-meta-title", "meta-title-count", 60);
    updateCounter("seo-meta-desc", "meta-desc-count", 160);
    updateCounter("seo-og-title", "og-title-count", 60);
    updateCounter("seo-og-desc", "og-desc-count", 160);
  };

  const setPreviewImage = (url = "") => {
    state.previewOgImageUrl = String(url || "").trim();

    const panelPreview = document.getElementById("og-img-preview");
    const panelPlaceholder = document.getElementById("seo-image-placeholder");
    const shareImage = document.getElementById("wa-img");
    const sharePlaceholder = document.getElementById("wa-img-placeholder");

    if (panelPreview) {
      panelPreview.src = state.previewOgImageUrl;
      panelPreview.hidden = !state.previewOgImageUrl;
    }
    if (panelPlaceholder) {
      panelPlaceholder.hidden = Boolean(state.previewOgImageUrl);
    }

    if (shareImage) {
      shareImage.src = state.previewOgImageUrl;
      shareImage.hidden = !state.previewOgImageUrl;
    }

    if (sharePlaceholder) {
      sharePlaceholder.hidden = Boolean(state.previewOgImageUrl);
    }
  };

  const updatePageMeta = (settings) => {
    const page = getPageOption(state.activeSlug);
    const route = document.getElementById("seo-page-route");
    const updated = document.getElementById("seo-last-updated");
    const imageState = document.getElementById("seo-image-state");

    if (route) {
      route.textContent = `mktintworks.com${page.path}`;
    }

    if (updated) {
      updated.textContent = settings?.updated_at
        ? `Last updated ${window.formatDateTime(settings.updated_at)}`
        : "Using the seeded default metadata for this page.";
    }

    if (imageState) {
      imageState.textContent = state.pendingOgImageFile
        ? `New image selected: ${state.pendingOgImageFile.name}`
        : state.persistedOgImageUrl
          ? "Current OG image is stored and will stay in use until you replace it."
          : "No custom OG image saved yet for this page.";
    }
  };

  const updatePreviews = () => {
    const page = getPageOption(state.activeSlug);
    const metaTitle =
      document.getElementById("seo-meta-title")?.value.trim() || "Page Title";
    const metaDescription =
      document.getElementById("seo-meta-desc")?.value.trim() ||
      "Meta description will appear here.";
    const ogTitle =
      document.getElementById("seo-og-title")?.value.trim() || metaTitle;
    const ogDescription =
      document.getElementById("seo-og-desc")?.value.trim() || metaDescription;

    const googleUrl = document.getElementById("gp-url");
    const googleTitle = document.getElementById("gp-title");
    const googleDesc = document.getElementById("gp-desc");
    const shareUrl = document.getElementById("wa-url");
    const shareTitle = document.getElementById("wa-title");
    const shareDesc = document.getElementById("wa-desc");

    if (googleUrl) {
      googleUrl.textContent = `mktintworks.com${page.path}`;
    }
    if (googleTitle) {
      googleTitle.textContent = metaTitle;
    }
    if (googleDesc) {
      googleDesc.textContent = metaDescription;
    }
    if (shareUrl) {
      shareUrl.textContent = `mktintworks.com${page.path}`;
    }
    if (shareTitle) {
      shareTitle.textContent = ogTitle;
    }
    if (shareDesc) {
      shareDesc.textContent = ogDescription;
    }

    setPreviewImage(state.previewOgImageUrl || state.persistedOgImageUrl);
  };

  const renderMetrics = () => {
    const host = document.getElementById("seo-metrics");
    if (!host) {
      return;
    }

    const rows = PAGE_OPTIONS.map((page) =>
      normalizeSettings(state.settingsBySlug[page.slug], page.slug)
    );
    const titleReady = rows.filter((row) => row.meta_title).length;
    const descriptionReady = rows.filter((row) => row.meta_description).length;
    const customCards = rows.filter(
      (row) => row.og_title || row.og_description || row.og_image_url
    ).length;
    const customImages = rows.filter((row) => row.og_image_url).length;

    host.innerHTML = `
      <article class="metric-card" data-tone="gold">
        <span class="metric-label">Controlled pages</span>
        <strong>${PAGE_OPTIONS.length}</strong>
        <p>The SEO manager only edits the six core public routes defined in Section 13.</p>
      </article>
      <article class="metric-card" data-tone="${titleReady === PAGE_OPTIONS.length ? "success" : "gold"}">
        <span class="metric-label">Titles ready</span>
        <strong>${titleReady}/${PAGE_OPTIONS.length}</strong>
        <p>Saved page titles feed the generated <code>&lt;title&gt;</code> tags used in browser tabs and Google.</p>
      </article>
      <article class="metric-card" data-tone="${descriptionReady === PAGE_OPTIONS.length ? "success" : "gold"}">
        <span class="metric-label">Descriptions ready</span>
        <strong>${descriptionReady}/${PAGE_OPTIONS.length}</strong>
        <p>Descriptions map to the public page source during the next build and deploy cycle.</p>
      </article>
      <article class="metric-card" data-tone="${customImages ? "success" : "neutral"}">
        <span class="metric-label">Custom social cards</span>
        <strong>${customCards}</strong>
        <p>${customImages} page${customImages === 1 ? "" : "s"} currently use a custom OG image instead of fallback art.</p>
      </article>
    `;
  };

  const applySettingsToForm = (settings) => {
    const metaTitle = document.getElementById("seo-meta-title");
    const metaDescription = document.getElementById("seo-meta-desc");
    const ogTitle = document.getElementById("seo-og-title");
    const ogDescription = document.getElementById("seo-og-desc");
    const selector = document.getElementById("seo-page-select");
    const uploadInput = document.getElementById("og-image-input");

    if (selector) {
      selector.value = state.activeSlug;
    }
    if (metaTitle) {
      metaTitle.value = settings.meta_title;
    }
    if (metaDescription) {
      metaDescription.value = settings.meta_description;
    }
    if (ogTitle) {
      ogTitle.value = settings.og_title;
    }
    if (ogDescription) {
      ogDescription.value = settings.og_description;
    }
    if (uploadInput) {
      uploadInput.value = "";
    }

    state.persistedOgImageUrl = settings.og_image_url;
    state.pendingOgImageFile = null;
    revokePendingPreview();
    setPreviewImage(state.persistedOgImageUrl);
    updatePageMeta(settings);
    updatePreviews();
    updateAllCounters();
  };

  const loadCoverage = async () => {
    try {
      const payload = await window.MKT_CMS_AUTH.GET("/api/seo/public", {
        allowAnonymous: true,
      });
      const settings = payload?.settings || {};

      PAGE_OPTIONS.forEach((page) => {
        state.settingsBySlug[page.slug] = normalizeSettings(
          settings[page.slug],
          page.slug
        );
      });
      renderMetrics();
    } catch {
      renderMetrics();
    }
  };

  const loadSEOSettings = async (slug) => {
    state.activeSlug = slug;
    setSaveStatus("", "");

    try {
      const payload = await window.GET(`/api/seo/${slug}`);
      const settings = normalizeSettings(payload?.settings, slug);
      state.settingsBySlug[slug] = settings;
      applySettingsToForm(settings);
      renderMetrics();
    } catch (error) {
      window.showToast(`Could not load SEO settings: ${error.message}`, "error");
      setSaveStatus(`Could not load SEO settings: ${error.message}`, "error");
    }
  };

  const uploadOgImage = async (file) => {
    if (!file) {
      return "";
    }

    if (typeof window.compressImage !== "function") {
      throw new Error("Shared image compression helper is unavailable");
    }

    const compressed = await window.compressImage(file, SEO_IMAGE_TARGET_KB, 2400);
    const extension = compressed.type === "image/webp" ? "webp" : "jpg";
    const safeBase = String(file.name || "seo-og-image").replace(/\.[^.]+$/, "");
    const formData = new FormData();
    const token = await window.MKT_CMS_AUTH.ensureToken();

    formData.append("image", compressed, `${safeBase}.${extension}`);
    formData.append("page", state.activeSlug);

    const response = await window.fetch(
      `${window.MKT_CMS_AUTH.API_BASE}/api/seo/upload-og-image`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      }
    );

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error || "OG image upload failed");
    }

    return String(payload?.cdn_url || "").trim();
  };

  const handleOgFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!String(file.type || "").startsWith("image/")) {
      window.showToast("Only image files can be used for OG previews.", "warning");
      event.target.value = "";
      return;
    }

    state.pendingOgImageFile = file;
    revokePendingPreview();
    state.pendingPreviewUrl = window.URL.createObjectURL(file);
    setPreviewImage(state.pendingPreviewUrl);
    updatePageMeta(state.settingsBySlug[state.activeSlug]);
    updatePreviews();
  };

  const saveSEOSettings = async () => {
    const saveButton = document.getElementById("save-seo-btn");
    const metaTitle = document.getElementById("seo-meta-title")?.value.trim() || "";
    const metaDescription =
      document.getElementById("seo-meta-desc")?.value.trim() || "";
    const ogTitle = document.getElementById("seo-og-title")?.value.trim() || null;
    const ogDescription =
      document.getElementById("seo-og-desc")?.value.trim() || null;

    if (!metaTitle) {
      window.showToast("Page title is required before saving.", "warning");
      setSaveStatus("Page title is required before saving.", "error");
      return;
    }

    if (!metaDescription) {
      window.showToast("Meta description is required before saving.", "warning");
      setSaveStatus("Meta description is required before saving.", "error");
      return;
    }

    window.setButtonLoading(saveButton, true, "Saving...");
    setSaveStatus("", "");

    try {
      let ogImageUrl = state.persistedOgImageUrl || "";

      if (state.pendingOgImageFile) {
        setSaveStatus("Uploading OG image...", "info");
        ogImageUrl = await uploadOgImage(state.pendingOgImageFile);
      }

      setSaveStatus("Saving SEO settings and triggering the site rebuild...", "info");
      const payload = await window.POST("/api/seo/save", {
        page_slug: state.activeSlug,
        meta_title: metaTitle,
        meta_description: metaDescription,
        og_image_url: ogImageUrl || null,
        og_title: ogTitle,
        og_description: ogDescription,
      });

      const saved = normalizeSettings(payload?.settings, state.activeSlug);
      state.settingsBySlug[state.activeSlug] = saved;
      applySettingsToForm(saved);
      renderMetrics();
      window.showToast("SEO settings saved. The public site rebuild is queued.", "success");
      setSaveStatus("Saved. Updated metadata should appear on the live site after the rebuild finishes.", "success");
    } catch (error) {
      window.showToast(`Save failed: ${error.message}`, "error");
      setSaveStatus(`Save failed: ${error.message}`, "error");
    } finally {
      window.setButtonLoading(saveButton, false);
    }
  };

  const renderShell = () => {
    const selectorOptions = PAGE_OPTIONS.map(
      (page) =>
        `<option value="${escapeHtml(page.slug)}">${escapeHtml(page.label)}</option>`
    ).join("");

    shell.innerHTML = `
      <section class="seo-manager">
        <section class="hero-banner seo-hero">
          <div class="content-cluster">
            <span class="eyebrow">Section 13</span>
            <h2>Control how every core page looks in search and social shares without touching code.</h2>
            <p>
              Titles, descriptions, and OG cards now live in one controlled workflow. Save here,
              trigger the Pages rebuild, and let the generated public HTML carry the new metadata.
            </p>
          </div>
          <div class="hero-actions">
            <button class="btn btn-secondary" type="button" id="refresh-seo-btn">Reload Current Page</button>
          </div>
        </section>

        <section class="summary-grid" id="seo-metrics"></section>

        <div class="seo-shell">
          <div class="seo-form-col">
            <section class="panel-card">
              <div class="panel-heading seo-panel-heading">
                <div class="panel-heading-copy">
                  <span class="eyebrow">Page Selector</span>
                  <h3>Choose the page to edit</h3>
                  <p>The SEO manager only controls the six main public website pages defined in the PRD.</p>
                </div>
              </div>

              <div class="field seo-selector-field">
                <label for="seo-page-select">Select page</label>
                <select id="seo-page-select">${selectorOptions}</select>
              </div>

              <div class="seo-page-meta">
                <p class="seo-page-route" id="seo-page-route">mktintworks.com/</p>
                <p class="seo-page-updated" id="seo-last-updated">Loading saved metadata...</p>
              </div>
            </section>

            <section class="panel-card">
              <div class="panel-heading seo-panel-heading">
                <div class="panel-heading-copy">
                  <span class="eyebrow">Google Search Settings</span>
                  <h3>Search result metadata</h3>
                  <p>Keep titles under 60 characters and descriptions under 160 so Google has less reason to trim them.</p>
                </div>
              </div>

              <div class="field">
                <label for="seo-meta-title" class="seo-label-row">
                  <span>Page Title</span>
                  <span class="char-count" id="meta-title-count">0 / 60</span>
                </label>
                <input
                  type="text"
                  id="seo-meta-title"
                  maxlength="60"
                  placeholder="MK Tintworks | Premium Window Tinting Nairobi"
                >
                <span class="field-hint">
                  Shown in the browser tab and as the blue link in Google results. Include the page's main keyword.
                </span>
              </div>

              <div class="field">
                <label for="seo-meta-desc" class="seo-label-row">
                  <span>Meta Description</span>
                  <span class="char-count" id="meta-desc-count">0 / 160</span>
                </label>
                <textarea
                  id="seo-meta-desc"
                  maxlength="160"
                  rows="4"
                  placeholder="Professional window tinting Nairobi. Authorized 3M and Llumar installer. Book today."
                ></textarea>
                <span class="field-hint">
                  This becomes the public description tag and the Google snippet description when search engines choose to use it.
                </span>
              </div>
            </section>

            <section class="panel-card">
              <div class="panel-heading seo-panel-heading">
                <div class="panel-heading-copy">
                  <span class="eyebrow">Social Sharing Settings</span>
                  <h3>WhatsApp and Facebook share card</h3>
                  <p>Upload a 1200 x 630 image when possible. Leave OG title and description blank to fall back to the main search fields.</p>
                </div>
              </div>

              <div class="field">
                <label for="og-image-input">OG Image</label>
                <div class="seo-image-frame">
                  <img id="og-img-preview" class="seo-image-preview" src="" alt="Open Graph preview" hidden>
                  <div class="seo-image-placeholder" id="seo-image-placeholder">
                    <strong>No custom image selected</strong>
                    <span>Upload an image to preview the social card art here before saving.</span>
                  </div>
                </div>
                <input type="file" id="og-image-input" accept="image/jpeg,image/png,image/webp,image/gif">
                <span class="field-hint" id="seo-image-state">
                  Recommended size: 1200 x 630 pixels. Uploads are compressed before they are stored in R2.
                </span>
              </div>

              <div class="field">
                <label for="seo-og-title" class="seo-label-row">
                  <span>OG Title</span>
                  <span class="char-count" id="og-title-count">0 / 60</span>
                </label>
                <input
                  type="text"
                  id="seo-og-title"
                  maxlength="60"
                  placeholder="Leave empty to use the Page Title"
                >
              </div>

              <div class="field">
                <label for="seo-og-desc" class="seo-label-row">
                  <span>OG Description</span>
                  <span class="char-count" id="og-desc-count">0 / 160</span>
                </label>
                <textarea
                  id="seo-og-desc"
                  maxlength="160"
                  rows="3"
                  placeholder="Leave empty to use the Meta Description"
                ></textarea>
              </div>
            </section>

            <div class="seo-save-row">
              <button class="btn btn-primary btn-lg" id="save-seo-btn" type="button">Save SEO Settings</button>
              <p class="seo-save-status" id="seo-save-status" aria-live="polite"></p>
            </div>
          </div>

          <div class="seo-preview-col">
            <section class="panel-card seo-preview-panel">
              <div class="panel-heading seo-panel-heading">
                <div class="panel-heading-copy">
                  <span class="eyebrow">Google Preview</span>
                  <h3>Search result snippet</h3>
                </div>
              </div>
              <div class="google-preview">
                <p class="gp-url" id="gp-url">mktintworks.com/</p>
                <p class="gp-title" id="gp-title">Page Title</p>
                <p class="gp-desc" id="gp-desc">Meta description will appear here.</p>
              </div>
            </section>

            <section class="panel-card seo-preview-panel">
              <div class="panel-heading seo-panel-heading">
                <div class="panel-heading-copy">
                  <span class="eyebrow">WhatsApp / Facebook Preview</span>
                  <h3>Open Graph card</h3>
                </div>
              </div>
              <div class="wa-preview-card">
                <div class="wa-preview-image">
                  <img id="wa-img" src="" alt="Open Graph card preview" hidden>
                  <p id="wa-img-placeholder">Upload an OG image to see it here.</p>
                </div>
                <div class="wa-preview-text">
                  <p class="wa-preview-url" id="wa-url">mktintworks.com/</p>
                  <p class="wa-preview-title" id="wa-title">Page Title</p>
                  <p class="wa-preview-desc" id="wa-desc">Meta description will appear here.</p>
                </div>
              </div>
            </section>

            <section class="panel-card seo-notes-panel">
              <span class="eyebrow">Publishing Notes</span>
              <h3>What happens when you save</h3>
              <ul class="checklist seo-checklist">
                <li>The Worker stores the SEO row in D1 and keeps the page slug locked to the approved six-page list.</li>
                <li>The save endpoint triggers the public Pages deploy hook so generated HTML can pick up the new metadata.</li>
                <li>OG image uploads are written into the shared media table, so the Media Library can still track their live usage.</li>
              </ul>
            </section>
          </div>
        </div>
      </section>
    `;
  };

  const bindEvents = () => {
    const selector = document.getElementById("seo-page-select");
    const refreshButton = document.getElementById("refresh-seo-btn");
    const saveButton = document.getElementById("save-seo-btn");
    const ogInput = document.getElementById("og-image-input");

    selector?.addEventListener("change", (event) => {
      loadSEOSettings(event.target.value);
    });

    refreshButton?.addEventListener("click", () => {
      loadSEOSettings(state.activeSlug);
    });

    saveButton?.addEventListener("click", saveSEOSettings);
    ogInput?.addEventListener("change", handleOgFileChange);

    ["seo-meta-title", "seo-meta-desc", "seo-og-title", "seo-og-desc"].forEach((id) => {
      const field = document.getElementById(id);
      field?.addEventListener("input", () => {
        updateAllCounters();
        updatePreviews();
      });
    });
  };

  const start = async () => {
    renderShell();
    bindEvents();
    renderMetrics();
    updateAllCounters();
    await loadCoverage();
    await loadSEOSettings(state.activeSlug);
  };

  start();
})(window, document);
