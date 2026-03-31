(function initGalleryManager(window, document) {
  const GALLERY_TARGET_KB = 150;
  const ALLOWED_FILE_TYPES = new Set([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
  ]);
  const state = {
    items: [],
    currentFilter: "all",
    isLoading: false,
  };

  const shell = document.querySelector("[data-module-shell]");
  if (!shell) {
    return;
  }

  const escapeHtml = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const escapeAttr = (value) => escapeHtml(value).replace(/`/g, "&#96;");

  const normalizeItem = (item, index = 0) => ({
    id: Number(item?.id || 0),
    image_url: String(item?.image_url || "").trim(),
    thumbnail_url: String(item?.thumbnail_url || item?.image_url || "").trim(),
    caption: String(item?.caption || "").trim(),
    category: String(item?.category || "automotive").trim().toLowerCase(),
    alt_text: String(item?.alt_text || "").trim(),
    display_order: Number(item?.display_order || index),
    file_size_kb:
      item?.file_size_kb === null || item?.file_size_kb === undefined
        ? null
        : Number(item.file_size_kb),
    original_name: String(item?.original_name || "").trim(),
    is_placeholder: Number(item?.is_placeholder || 0) === 1,
    created_at: item?.created_at || null,
  });

  const sortItems = (items) =>
    items
      .slice()
      .sort(
        (left, right) =>
          left.display_order - right.display_order ||
          String(left.created_at || "").localeCompare(String(right.created_at || "")) ||
          left.id - right.id
      );

  const categoryLabel = (value) =>
    String(value || "")
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  const filteredItems = () => {
    const ordered = sortItems(state.items);
    if (state.currentFilter === "all") {
      return ordered;
    }

    return ordered.filter((item) => item.category === state.currentFilter);
  };

  const countByCategory = (category) =>
    state.items.filter((item) => item.category === category).length;

  const renderShell = () => {
    shell.innerHTML = `
      <section class="gallery-manager">
        <div class="gallery-header">
          <div class="gallery-header-copy">
            <p class="section-kicker">Showcase Media</p>
            <h1>Gallery Manager</h1>
            <p>
              Upload, compress, caption, categorize, reorder, and retire portfolio images without leaving the CMS.
            </p>
          </div>
        </div>

        <div class="gallery-stats">
          <article class="gallery-stat">
            <strong id="gallery-stat-total">0</strong>
            <span>Total images tracked across the live gallery library.</span>
          </article>
          <article class="gallery-stat">
            <strong id="gallery-stat-automotive">0</strong>
            <span>Automotive showcase images currently available.</span>
          </article>
          <article class="gallery-stat">
            <strong id="gallery-stat-residential">0</strong>
            <span>Residential proof images currently available.</span>
          </article>
          <article class="gallery-stat">
            <strong id="gallery-stat-commercial">0</strong>
            <span>Commercial or architectural images currently available.</span>
          </article>
        </div>

        <section class="gallery-panel" aria-labelledby="gallery-upload-title">
          <h2 id="gallery-upload-title">Upload Images</h2>
          <p class="gallery-panel-copy">
            Every gallery upload is compressed in the browser before it reaches the Worker or R2 storage.
          </p>

          <div class="gallery-upload-grid">
            <div class="field">
              <label for="upload-category">Category</label>
              <select id="upload-category">
                <option value="automotive">Automotive</option>
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
              </select>
            </div>
            <div class="field">
              <label for="upload-caption">Caption (optional)</label>
              <input
                type="text"
                id="upload-caption"
                maxlength="150"
                placeholder="e.g. 3M Crystalline on a Toyota Land Cruiser"
              >
            </div>
          </div>

          <div
            id="upload-zone"
            class="gallery-upload-zone"
            role="button"
            tabindex="0"
            aria-label="Upload gallery images"
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <p>Drag images here or click to browse</p>
            <p class="hint">JPG, PNG, WebP, GIF · auto-compressed to target 150KB before upload</p>
            <input type="file" id="gallery-file-input" accept="image/*" multiple hidden>
          </div>

          <div id="upload-progress" class="gallery-upload-progress" aria-live="polite">
            <div class="gallery-upload-progress-bar">
              <span id="upload-progress-bar"></span>
            </div>
            <p id="upload-progress-text"></p>
          </div>
        </section>

        <section class="gallery-panel" aria-labelledby="gallery-grid-title">
          <h2 id="gallery-grid-title">Gallery Library</h2>
          <p class="gallery-panel-copy">
            Filter by category, edit captions, mark placeholders, and drag cards to change the public display order.
          </p>

          <div class="gallery-toolbar" id="gallery-filter-bar">
            <button class="btn btn-secondary btn-sm is-filter-active" type="button" data-filter="all">All</button>
            <button class="btn btn-ghost btn-sm" type="button" data-filter="automotive">Automotive</button>
            <button class="btn btn-ghost btn-sm" type="button" data-filter="residential">Residential</button>
            <button class="btn btn-ghost btn-sm" type="button" data-filter="commercial">Commercial</button>
            <span class="gallery-count" id="gallery-count">0 images</span>
          </div>

          <div class="gallery-grid" id="gallery-grid"></div>
        </section>
      </section>
    `;
  };

  const renderStats = () => {
    const total = state.items.length;
    const totalEl = document.getElementById("gallery-stat-total");
    const automotiveEl = document.getElementById("gallery-stat-automotive");
    const residentialEl = document.getElementById("gallery-stat-residential");
    const commercialEl = document.getElementById("gallery-stat-commercial");

    if (totalEl) {
      totalEl.textContent = String(total);
    }
    if (automotiveEl) {
      automotiveEl.textContent = String(countByCategory("automotive"));
    }
    if (residentialEl) {
      residentialEl.textContent = String(countByCategory("residential"));
    }
    if (commercialEl) {
      commercialEl.textContent = String(countByCategory("commercial"));
    }
  };

  const renderGrid = () => {
    const grid = document.getElementById("gallery-grid");
    const count = document.getElementById("gallery-count");
    const filtered = filteredItems();

    if (!grid || !count) {
      return;
    }

    count.textContent = `${filtered.length} image${filtered.length === 1 ? "" : "s"}`;

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="gallery-empty">
          No images in this category yet. Upload a batch above to start building the portfolio.
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered
      .map(
        (image) => `
          <article
            class="gallery-card"
            data-id="${image.id}"
            data-category="${escapeAttr(image.category)}"
            data-caption="${escapeAttr(image.caption)}"
            draggable="true"
          >
            ${
              image.is_placeholder
                ? '<div class="gallery-placeholder-badge">Placeholder</div>'
                : ""
            }
            <img
              src="${escapeAttr(image.thumbnail_url || image.image_url)}"
              alt="${escapeAttr(image.alt_text || image.caption || "Gallery image")}"
              loading="lazy"
              decoding="async"
            >
            <div class="gallery-card-overlay">
              <p class="gallery-card-caption">
                ${escapeHtml(image.caption || "No caption")}
              </p>
              <div class="gallery-card-actions">
                <button class="btn btn-secondary btn-sm" type="button" data-action="edit" data-id="${image.id}">
                  Edit
                </button>
                <button class="btn btn-danger btn-sm" type="button" data-action="delete" data-id="${image.id}">
                  Delete
                </button>
              </div>
              <p class="gallery-card-meta">
                ${escapeHtml(categoryLabel(image.category))}
                ${
                  image.file_size_kb
                    ? ` · ${escapeHtml(`${image.file_size_kb} KB`)}`
                    : ""
                }
              </p>
            </div>
          </article>
        `
      )
      .join("");

    initDragToReorder();
  };

  const syncFilterButtons = () => {
    document.querySelectorAll("[data-filter]").forEach((button) => {
      const active = button.dataset.filter === state.currentFilter;
      button.className = active
        ? "btn btn-secondary btn-sm is-filter-active"
        : "btn btn-ghost btn-sm";
    });
  };

  const updateUi = () => {
    renderStats();
    syncFilterButtons();
    renderGrid();
  };

  const setUploadProgress = (percent, text) => {
    const root = document.getElementById("upload-progress");
    const bar = document.getElementById("upload-progress-bar");
    const copy = document.getElementById("upload-progress-text");

    if (!root || !bar || !copy) {
      return;
    }

    root.classList.add("is-visible");
    bar.style.width = `${percent}%`;
    copy.textContent = text;
  };

  const hideUploadProgress = () => {
    const root = document.getElementById("upload-progress");
    const bar = document.getElementById("upload-progress-bar");
    const copy = document.getElementById("upload-progress-text");

    if (!root || !bar || !copy) {
      return;
    }

    root.classList.remove("is-visible");
    bar.style.width = "0%";
    copy.textContent = "";
  };

  const uploadSingleFile = async (file, category, caption) => {
    const compressed = await window.compressImage(file, GALLERY_TARGET_KB);
    const token = await window.MKT_CMS_AUTH.ensureToken();
    const extension = compressed.type === "image/webp" ? "webp" : "jpg";
    const safeBase = file.name.replace(/\.[^.]+$/, "") || "gallery-upload";
    const formData = new FormData();

    formData.append("image", compressed, `${safeBase}.${extension}`);
    formData.append("category", category);
    formData.append("caption", caption);

    const response = await fetch(
      `${window.MKT_CMS_AUTH.API_BASE}/api/gallery/upload`,
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
      throw new Error(payload.error || "Upload failed");
    }

    return payload.image ? normalizeItem(payload.image) : null;
  };

  const handleFiles = async (files) => {
    if (!Array.isArray(files) || files.length === 0) {
      return;
    }

    const category = document.getElementById("upload-category")?.value || "automotive";
    const caption = document.getElementById("upload-caption")?.value.trim() || "";
    let successCount = 0;

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const ratio = Math.round(((index + 1) / files.length) * 100);

      if (!ALLOWED_FILE_TYPES.has(file.type)) {
        window.showToast(`Skipped ${file.name} because the file type is unsupported.`, "warning");
        continue;
      }

      if (file.size > 15 * 1024 * 1024) {
        window.showToast(`Skipped ${file.name} because it exceeds 15MB.`, "warning");
        continue;
      }

      setUploadProgress(
        Math.max(4, ratio - 18),
        `Compressing and uploading ${index + 1} of ${files.length}: ${file.name}`
      );

      try {
        const uploaded = await uploadSingleFile(file, category, caption);
        if (uploaded) {
          state.items.push(uploaded);
          successCount += 1;
        }
      } catch (error) {
        window.showToast(`Failed to upload ${file.name}: ${error.message}`, "error");
      }

      setUploadProgress(ratio, `Processed ${index + 1} of ${files.length} files`);
    }

    if (document.getElementById("upload-caption")) {
      document.getElementById("upload-caption").value = "";
    }

    if (successCount > 0) {
      state.items = sortItems(state.items).map((item, index) => ({
        ...item,
        display_order: index,
      }));
      updateUi();
      window.showToast(
        `${successCount} image${successCount === 1 ? "" : "s"} uploaded successfully.`,
        "success"
      );
    }

    setUploadProgress(100, `Done — ${successCount} of ${files.length} images uploaded`);
    window.setTimeout(hideUploadProgress, 1400);
  };

  const loadGallery = async () => {
    state.isLoading = true;
    try {
      const payload = await window.GET("/api/gallery");
      state.items = Array.isArray(payload?.images)
        ? payload.images.map(normalizeItem)
        : [];
      updateUi();
    } catch (error) {
      window.showToast(error.message || "Failed to load gallery.", "error");
    } finally {
      state.isLoading = false;
    }
  };

  const saveGalleryEdit = async (imageId) => {
    const status = document.getElementById("gallery-edit-status");
    const caption = document.getElementById("gallery-edit-caption")?.value.trim() || "";
    const category =
      document.getElementById("gallery-edit-category")?.value || "automotive";
    const isPlaceholder = document.getElementById("gallery-edit-placeholder")?.checked
      ? 1
      : 0;

    try {
      const payload = await window.POST("/api/gallery/update", {
        id: imageId,
        caption,
        category,
        is_placeholder: isPlaceholder,
      });

      const updated = normalizeItem(payload?.image || { id: imageId, caption, category, is_placeholder: isPlaceholder });
      state.items = state.items.map((item) => (item.id === imageId ? updated : item));
      updateUi();
      window.closeModal();
      window.showToast("Image updated.", "success");
    } catch (error) {
      if (status) {
        status.textContent = `Save failed: ${error.message}`;
      }
    }
  };

  const openEditModal = (imageId) => {
    const image = state.items.find((item) => item.id === imageId);
    if (!image) {
      return;
    }

    window.openModal({
      title: "Edit Gallery Image",
      size: "wide",
      body: `
        <img
          class="gallery-edit-preview"
          src="${escapeAttr(image.thumbnail_url || image.image_url)}"
          alt="${escapeAttr(image.alt_text || image.caption || "Gallery image")}"
        >
        <div class="field">
          <label for="gallery-edit-caption">Caption (shown on hover)</label>
          <input
            type="text"
            id="gallery-edit-caption"
            maxlength="150"
            value="${escapeAttr(image.caption)}"
            placeholder="One sentence describing this photo"
          >
        </div>
        <div class="field">
          <label for="gallery-edit-category">Category</label>
          <select id="gallery-edit-category">
            <option value="automotive" ${image.category === "automotive" ? "selected" : ""}>Automotive</option>
            <option value="residential" ${image.category === "residential" ? "selected" : ""}>Residential</option>
            <option value="commercial" ${image.category === "commercial" ? "selected" : ""}>Commercial</option>
          </select>
        </div>
        <label class="field" for="gallery-edit-placeholder">
          <span>Placeholder status</span>
          <div style="display:flex;align-items:center;gap:10px;margin-top:10px">
            <input
              type="checkbox"
              id="gallery-edit-placeholder"
              ${image.is_placeholder ? "checked" : ""}
            >
            <span>Mark as placeholder (AI-generated, replace with a real project photo later)</span>
          </div>
        </label>
        <div id="gallery-edit-status" class="gallery-edit-status"></div>
      `,
      actions: [
        {
          label: "Cancel",
          variant: "secondary",
        },
        {
          label: "Save Changes",
          variant: "primary",
          closeOnClick: false,
          onClick: () => saveGalleryEdit(imageId),
        },
      ],
    });
  };

  const deleteGalleryItem = (imageId) => {
    window.confirmAction(
      "This will permanently remove the image from the gallery. R2 cleanup is attempted automatically for managed uploads.",
      async () => {
        try {
          await window.DELETE(`/api/gallery/${imageId}`);
          state.items = state.items.filter((item) => item.id !== imageId);
          state.items = sortItems(state.items).map((item, index) => ({
            ...item,
            display_order: index,
          }));
          updateUi();
          window.showToast("Image deleted.", "success");
        } catch (error) {
          window.showToast(error.message || "Delete failed.", "error");
        }
      }
    );
  };

  const buildReorderedItems = (sourceId, targetId) => {
    const fullOrder = sortItems(state.items);

    if (state.currentFilter === "all") {
      const sourceIndex = fullOrder.findIndex((item) => item.id === sourceId);
      const targetIndex = fullOrder.findIndex((item) => item.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) {
        return fullOrder;
      }

      const next = fullOrder.slice();
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    }

    const filtered = fullOrder.filter((item) => item.category === state.currentFilter);
    const sourceIndex = filtered.findIndex((item) => item.id === sourceId);
    const targetIndex = filtered.findIndex((item) => item.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) {
      return fullOrder;
    }

    const reorderedFiltered = filtered.slice();
    const [moved] = reorderedFiltered.splice(sourceIndex, 1);
    reorderedFiltered.splice(targetIndex, 0, moved);

    const queue = reorderedFiltered.slice();
    return fullOrder.map((item) =>
      item.category === state.currentFilter ? queue.shift() : item
    );
  };

  const saveReorder = async (sourceId, targetId) => {
    const previous = state.items.slice();
    const reordered = buildReorderedItems(sourceId, targetId).map((item, index) => ({
      ...item,
      display_order: index,
    }));

    state.items = reordered;
    updateUi();

    try {
      await window.POST("/api/gallery/reorder", {
        order: reordered.map((item, index) => ({
          id: item.id,
          order: index,
        })),
      });
      window.showToast("Order saved.", "success");
    } catch (error) {
      state.items = previous;
      updateUi();
      window.showToast(error.message || "Could not save the new order.", "error");
    }
  };

  const initDragToReorder = () => {
    const cards = Array.from(document.querySelectorAll(".gallery-card"));
    let dragSourceId = null;

    cards.forEach((card) => {
      card.addEventListener("dragstart", (event) => {
        dragSourceId = Number(card.dataset.id || 0);
        card.classList.add("is-dragging");
        event.dataTransfer.effectAllowed = "move";
      });

      card.addEventListener("dragend", () => {
        card.classList.remove("is-dragging");
        cards.forEach((item) => item.classList.remove("is-drop-target"));
        dragSourceId = null;
      });

      card.addEventListener("dragover", (event) => {
        event.preventDefault();
        if (Number(card.dataset.id || 0) === dragSourceId) {
          return;
        }
        card.classList.add("is-drop-target");
      });

      card.addEventListener("dragleave", () => {
        card.classList.remove("is-drop-target");
      });

      card.addEventListener("drop", async (event) => {
        event.preventDefault();
        card.classList.remove("is-drop-target");
        const targetId = Number(card.dataset.id || 0);

        if (!dragSourceId || !targetId || dragSourceId === targetId) {
          return;
        }

        await saveReorder(dragSourceId, targetId);
      });
    });
  };

  const bindUploadZone = () => {
    const zone = document.getElementById("upload-zone");
    const fileInput = document.getElementById("gallery-file-input");
    if (!zone || !fileInput) {
      return;
    }

    const openPicker = () => fileInput.click();

    zone.addEventListener("click", openPicker);
    zone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openPicker();
      }
    });

    fileInput.addEventListener("change", async (event) => {
      await handleFiles(Array.from(event.target.files || []));
      fileInput.value = "";
    });

    zone.addEventListener("dragover", (event) => {
      event.preventDefault();
      zone.classList.add("is-dragging");
    });

    zone.addEventListener("dragleave", () => {
      zone.classList.remove("is-dragging");
    });

    zone.addEventListener("drop", async (event) => {
      event.preventDefault();
      zone.classList.remove("is-dragging");
      const files = Array.from(event.dataTransfer?.files || []).filter((file) =>
        file.type.startsWith("image/")
      );

      if (files.length === 0) {
        window.showToast("Only image files can be dropped here.", "warning");
        return;
      }

      await handleFiles(files);
    });
  };

  const bindFilterBar = () => {
    const filterBar = document.getElementById("gallery-filter-bar");
    if (!filterBar) {
      return;
    }

    filterBar.addEventListener("click", (event) => {
      const button = event.target.closest("[data-filter]");
      if (!button) {
        return;
      }

      state.currentFilter = button.dataset.filter || "all";
      updateUi();
    });
  };

  const bindGridActions = () => {
    const grid = document.getElementById("gallery-grid");
    if (!grid) {
      return;
    }

    grid.addEventListener("click", (event) => {
      const actionButton = event.target.closest("[data-action]");
      if (!actionButton) {
        return;
      }

      const imageId = Number(actionButton.dataset.id || 0);
      if (!imageId) {
        return;
      }

      if (actionButton.dataset.action === "edit") {
        openEditModal(imageId);
        return;
      }

      if (actionButton.dataset.action === "delete") {
        deleteGalleryItem(imageId);
      }
    });
  };

  const boot = async () => {
    renderShell();
    bindUploadZone();
    bindFilterBar();
    bindGridActions();
    await window.MKT_CMS_AUTH.ready;
    await loadGallery();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})(window, document);
