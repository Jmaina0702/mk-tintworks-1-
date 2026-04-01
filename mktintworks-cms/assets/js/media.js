(function initMediaLibrary(window, document) {
  const shell = document.querySelector("[data-module-shell]");
  if (!shell) {
    return;
  }

  const R2_FREE_TIER_KB = 10 * 1024 * 1024;

  const state = {
    files: [],
    filter: "all",
    query: "",
  };

  const usageLabelMap = {
    blog: "Blog",
    gallery: "Gallery",
    invoices: "Invoices",
    pages: "Pages",
    products: "Products",
    promotions: "Promotions",
    records: "Records",
    seo: "SEO",
    testimonials: "Testimonials",
    warranty: "Warranty",
  };

  const escapeHtml = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const normalizeFile = (file) => {
    const usedIn = Array.isArray(file?.used_in)
      ? file.used_in
          .map((item) => String(item || "").trim().toLowerCase())
          .filter(Boolean)
      : [];

    return {
      id: Number(file?.id || 0),
      filename: String(file?.filename || "").trim(),
      original_name: String(file?.original_name || file?.filename || "").trim(),
      cdn_url: String(file?.cdn_url || "").trim(),
      file_type: String(file?.file_type || "").trim().toLowerCase(),
      file_size_kb:
        file?.file_size_kb === null || file?.file_size_kb === undefined
          ? null
          : Math.max(0, Number(file.file_size_kb) || 0),
      used_in: usedIn,
      is_orphan: Boolean(file?.is_orphan) || usedIn.length === 0,
      uploaded_at: file?.uploaded_at || null,
    };
  };

  const isImage = (file) => String(file?.file_type || "").startsWith("image/");
  const isDocument = (file) =>
    String(file?.file_type || "").toLowerCase() === "application/pdf";

  const formatStorageSize = (kilobytes) => {
    const bytes = Math.max(0, Number(kilobytes || 0)) * 1024;

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatUsageList = (usedIn) =>
    usedIn
      .map((module) => usageLabelMap[module] || module.replace(/(^|\s|-)\w/g, (char) => char.toUpperCase()))
      .join(", ");

  const getTotals = () => ({
    files: state.files.length,
    images: state.files.filter(isImage).length,
    documents: state.files.filter(isDocument).length,
    orphaned: state.files.filter((file) => file.is_orphan).length,
    file_size_kb: state.files.reduce(
      (sum, file) => sum + Math.max(0, Number(file.file_size_kb || 0)),
      0
    ),
  });

  const matchesFilter = (file) => {
    if (state.filter === "image") {
      return isImage(file);
    }

    if (state.filter === "pdf") {
      return isDocument(file);
    }

    if (state.filter === "orphan") {
      return file.is_orphan;
    }

    return true;
  };

  const matchesSearch = (file) => {
    if (!state.query) {
      return true;
    }

    const haystack = `${file.original_name} ${file.filename}`.toLowerCase();
    return haystack.includes(state.query);
  };

  const getVisibleFiles = () =>
    state.files.filter((file) => matchesFilter(file) && matchesSearch(file));

  const renderShell = () => {
    shell.innerHTML = `
      <section class="media-library">
        <section class="hero-banner media-hero">
          <div class="content-cluster">
            <span class="eyebrow">Section 12</span>
            <h2>Audit every uploaded asset before storage clutter becomes a real problem.</h2>
            <p>
              The Media Library is read-heavy by design. Uploads still happen inside Gallery, Products,
              Blog, Promotions, and the Visual Editor. This screen gives you inventory, live usage
              context, CDN copy actions, and orphan cleanup.
            </p>
          </div>
          <div class="hero-actions">
            <button class="btn btn-secondary" type="button" data-refresh-media>Refresh Library</button>
          </div>
        </section>

        <section class="summary-grid" id="media-metrics"></section>

        <section class="panel-card media-storage-card">
          <div class="media-storage-row">
            <div class="media-storage-copy">
              <span class="eyebrow">Storage Usage</span>
              <h3>R2 free-tier tracking</h3>
              <p>Cloudflare R2 gives the project 10 GB before this library needs tighter cleanup discipline.</p>
            </div>
            <p class="media-storage-text" id="storage-text">Calculating...</p>
          </div>
          <div class="media-storage-track" aria-hidden="true">
            <div class="media-storage-fill" id="storage-bar"></div>
          </div>
          <p class="surface-note media-surface-note">
            <strong>Read/delete only.</strong>
            New files enter this library from other CMS modules when they upload to R2.
          </p>
        </section>

        <section class="panel-card">
          <div class="panel-heading media-library-heading">
            <div class="panel-heading-copy">
              <span class="eyebrow">File Inventory</span>
              <h3>All media uploaded through the CMS</h3>
              <p>Filter by type, search by filename, copy URLs instantly, and remove files that are no longer referenced anywhere live.</p>
            </div>
          </div>

          <div class="media-toolbar">
            <div class="media-filter-group" role="tablist" aria-label="Media filters">
              <button class="btn btn-secondary btn-sm media-filter-btn" type="button" data-filter="all">All</button>
              <button class="btn btn-ghost btn-sm media-filter-btn" type="button" data-filter="image">Images</button>
              <button class="btn btn-ghost btn-sm media-filter-btn" type="button" data-filter="pdf">Documents</button>
              <button class="btn btn-ghost btn-sm media-filter-btn" type="button" data-filter="orphan">Unused</button>
            </div>

            <div class="field media-search-field">
              <label for="media-search">Search by filename</label>
              <input type="search" id="media-search" placeholder="Search by original filename...">
            </div>

            <span class="media-count" id="media-count"></span>
          </div>

          <div class="media-grid" id="media-grid"></div>
        </section>
      </section>
    `;
  };

  const renderMetrics = () => {
    const metricsHost = document.getElementById("media-metrics");
    if (!metricsHost) {
      return;
    }

    const totals = getTotals();

    metricsHost.innerHTML = `
      <article class="metric-card" data-tone="gold">
        <span class="metric-label">Files tracked</span>
        <strong>${totals.files}</strong>
        <p>Every upload recorded in the shared D1 media table.</p>
      </article>
      <article class="metric-card" data-tone="success">
        <span class="metric-label">Images</span>
        <strong>${totals.images}</strong>
        <p>Gallery shots, product visuals, blog images, and banner creatives.</p>
      </article>
      <article class="metric-card">
        <span class="metric-label">Documents</span>
        <strong>${totals.documents}</strong>
        <p>PDF assets stay visible here instead of disappearing into storage black boxes.</p>
      </article>
      <article class="metric-card" data-tone="${totals.orphaned ? "danger" : "success"}">
        <span class="metric-label">Unused</span>
        <strong>${totals.orphaned}</strong>
        <p>${totals.orphaned ? "Potential cleanup candidates with no live references." : "No orphaned files currently detected."}</p>
      </article>
    `;
  };

  const renderStorage = () => {
    const storageText = document.getElementById("storage-text");
    const storageBar = document.getElementById("storage-bar");
    if (!storageText || !storageBar) {
      return;
    }

    const totalKb = getTotals().file_size_kb;
    const percent = Math.min(100, (totalKb / R2_FREE_TIER_KB) * 100);
    const tone = percent > 80 ? "danger" : percent > 60 ? "warning" : "success";

    storageText.textContent = `${formatStorageSize(totalKb)} used of 10 GB (${percent.toFixed(
      2
    )}%)`;
    storageBar.style.width = `${percent}%`;
    storageBar.dataset.tone = tone;
  };

  const renderGrid = () => {
    const visibleFiles = getVisibleFiles();
    const grid = document.getElementById("media-grid");
    const count = document.getElementById("media-count");

    if (!grid || !count) {
      return;
    }

    count.textContent = `${visibleFiles.length} file${visibleFiles.length === 1 ? "" : "s"}`;

    if (!visibleFiles.length) {
      grid.innerHTML = `
        <div class="media-empty">
          <strong>No files found.</strong>
          <span>Change the filter or search term to widen the result set.</span>
        </div>
      `;
      return;
    }

    grid.innerHTML = visibleFiles
      .map((file) => {
        const usageMarkup = file.is_orphan
          ? "Not in use"
          : `Used in: ${escapeHtml(formatUsageList(file.used_in))}`;
        const fileSizeLabel =
          file.file_size_kb === null
            ? "Unknown size"
            : window.formatFileSize((Number(file.file_size_kb) || 0) * 1024);
        const uploadedLabel = file.uploaded_at
          ? window.formatRelativeTime(file.uploaded_at)
          : "Unknown date";

        return `
          <article class="media-card ${file.is_orphan ? "is-orphan" : ""}">
            <div class="media-thumb">
              ${
                isImage(file)
                  ? `<img src="${escapeHtml(file.cdn_url)}" alt="${escapeHtml(
                      file.original_name || "Media library image"
                    )}" loading="lazy" decoding="async">`
                  : `<div class="media-doc-fallback">
                      <strong>PDF</strong>
                      <span>Document file</span>
                    </div>`
              }
              <div class="media-thumb-overlay">
                <div class="media-card-actions">
                  <button class="btn btn-secondary btn-sm" type="button" data-copy-url="${escapeHtml(
                    file.cdn_url
                  )}">Copy URL</button>
                  <button class="btn btn-danger btn-sm" type="button" data-delete-id="${file.id}">Delete</button>
                </div>
              </div>
            </div>
            <div class="media-card-body">
              <p class="media-name" title="${escapeHtml(file.original_name)}">${escapeHtml(
                file.original_name
              )}</p>
              <p class="media-meta">${escapeHtml(fileSizeLabel)} · ${escapeHtml(
                uploadedLabel
              )}</p>
              <span class="media-usage ${file.is_orphan ? "is-empty" : ""}">${usageMarkup}</span>
            </div>
          </article>
        `;
      })
      .join("");
  };

  const updateUi = () => {
    renderMetrics();
    renderStorage();
    renderGrid();

    shell.querySelectorAll("[data-filter]").forEach((button) => {
      const isActive = button.getAttribute("data-filter") === state.filter;
      button.className = isActive
        ? "btn btn-secondary btn-sm media-filter-btn"
        : "btn btn-ghost btn-sm media-filter-btn";
      button.setAttribute("aria-pressed", String(isActive));
    });
  };

  const copyMediaUrl = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      window.showToast("URL copied to clipboard.", "success");
    } catch {
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
      window.showToast("URL copied.", "success");
    }
  };

  const deleteMediaFile = (mediaId) => {
    const file = state.files.find((item) => item.id === mediaId);
    if (!file) {
      return;
    }

    const message = file.is_orphan
      ? "This file is not currently in use. Delete it from R2 and remove its D1 record?"
      : `WARNING: This file is still used in ${formatUsageList(
          file.used_in
        )}. Deleting it will break those references. Continue?`;

    window.confirmAction(message, async () => {
      try {
        await window.DELETE(`/api/media/${mediaId}`);
        state.files = state.files.filter((item) => item.id !== mediaId);
        updateUi();
        window.showToast("File deleted.", "success");
      } catch (error) {
        window.showToast(error.message || "Delete failed.", "error");
      }
    });
  };

  const loadMedia = async () => {
    const refreshButton = shell.querySelector("[data-refresh-media]");

    try {
      window.setButtonLoading(refreshButton, true, "Refreshing...");
      const payload = await window.GET("/api/media");
      state.files = Array.isArray(payload?.files)
        ? payload.files.map(normalizeFile)
        : [];
      updateUi();
    } catch (error) {
      window.showToast(error.message || "Failed to load media library.", "error");
    } finally {
      window.setButtonLoading(refreshButton, false);
    }
  };

  const bindEvents = () => {
    shell.addEventListener("click", (event) => {
      const refreshButton = event.target.closest("[data-refresh-media]");
      if (refreshButton) {
        loadMedia();
        return;
      }

      const filterButton = event.target.closest("[data-filter]");
      if (filterButton) {
        state.filter = filterButton.getAttribute("data-filter") || "all";
        updateUi();
        return;
      }

      const copyButton = event.target.closest("[data-copy-url]");
      if (copyButton) {
        copyMediaUrl(copyButton.getAttribute("data-copy-url") || "");
        return;
      }

      const deleteButton = event.target.closest("[data-delete-id]");
      if (deleteButton) {
        deleteMediaFile(Number(deleteButton.getAttribute("data-delete-id") || 0));
      }
    });

    const searchInput = document.getElementById("media-search");
    searchInput?.addEventListener(
      "input",
      window.debounce((event) => {
        state.query = String(event.target.value || "").trim().toLowerCase();
        renderGrid();
      }, 150)
    );
  };

  const boot = async () => {
    renderShell();
    bindEvents();
    await window.MKT_CMS_AUTH.ready;
    await loadMedia();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})(window, document);
