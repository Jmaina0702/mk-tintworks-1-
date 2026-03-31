(function initVisualEditor(window, document) {
  const DEFAULT_PREVIEW_ORIGIN = "https://mk-tintworks-1.pages.dev";
  const TRUSTED_PREVIEW_ORIGINS = new Set([
    "https://mk-tintworks-1.pages.dev",
    "https://mktintworks.com",
    "https://www.mktintworks.com",
  ]);
  const PREVIEW_ORIGIN_SOURCES = [
    "/data/section-7-status.json",
    "/data/section-6-status.json",
  ];
  const PREVIEW_READY_TIMEOUT_MS = 8000;

  const iframe = document.getElementById("ve-preview-frame");
  const editPanel = document.getElementById("ve-edit-panel");
  const pageSelect = document.getElementById("ve-page-select");
  const loading = document.getElementById("ve-loading");
  const statusBar = document.getElementById("ve-status");

  let currentKey = null;
  let currentCmsType = null;
  let currentPage = pageSelect?.value || "home";
  let currentWebsiteOrigin = DEFAULT_PREVIEW_ORIGIN;
  let previewLoadId = 0;
  let previewReadyTimer = null;

  const escapeHtml = (value) =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const escapeAttribute = (value) =>
    escapeHtml(String(value)).replace(/`/g, "&#96;");

  const isAllowedPreviewOrigin = (value) => {
    try {
      const url = new URL(String(value).trim());
      return (
        url.protocol === "https:" &&
        (url.hostname === "mktintworks.com" ||
          url.hostname === "www.mktintworks.com" ||
          url.hostname.endsWith(".pages.dev"))
      );
    } catch {
      return false;
    }
  };

  const addTrustedPreviewOrigin = (value) => {
    if (!isAllowedPreviewOrigin(value)) {
      return;
    }

    TRUSTED_PREVIEW_ORIGINS.add(new URL(value).origin);
  };

  const canEmbedOrigin = async (origin) => {
    if (!isAllowedPreviewOrigin(origin)) {
      return false;
    }

    try {
      const probeUrl = new URL("/?cms_preview=true", origin);
      const response = await fetch(probeUrl, {
        cache: "no-store",
        mode: "cors",
      });
      const xFrameOptions = String(response.headers.get("x-frame-options") || "")
        .trim()
        .toUpperCase();
      const csp = String(response.headers.get("content-security-policy") || "");

      if (xFrameOptions === "DENY") {
        return false;
      }

      if (!csp.includes("frame-ancestors")) {
        return true;
      }

      return /frame-ancestors[^;]*(admin\.mktintworks-cms\.pages\.dev|admin\.mktintworks\.com|mktintworks-cms\.pages\.dev)/i.test(
        csp
      );
    } catch {
      return false;
    }
  };

  const buildWebsitePages = (origin) => ({
    home: `${origin}/?cms_preview=true`,
    services: `${origin}/services.html?cms_preview=true`,
    gallery: `${origin}/gallery.html?cms_preview=true`,
    testimonials: `${origin}/testimonials.html?cms_preview=true`,
    book: `${origin}/book.html?cms_preview=true`,
    blog: `${origin}/blog/?cms_preview=true`,
    "blog-3m-vs-llumar-kenya": `${origin}/blog/3m-vs-llumar-kenya.html?cms_preview=true`,
    "blog-ntsa-tint-regulations-kenya-2026": `${origin}/blog/ntsa-tint-regulations-kenya-2026.html?cms_preview=true`,
    "404": `${origin}/404.html?cms_preview=true`,
  });

  const clearPreviewReadyTimer = () => {
    if (!previewReadyTimer) {
      return;
    }

    window.clearTimeout(previewReadyTimer);
    previewReadyTimer = null;
  };

  const setStatus = (message) => {
    if (statusBar) {
      statusBar.textContent = message;
    }
  };

  const hideLoading = () => {
    loading?.classList.add("is-hidden");
  };

  const showLoading = () => {
    loading?.classList.remove("is-hidden");
  };

  const showPrompt = () => {
    editPanel.innerHTML = `
      <div class="ve-edit-prompt">
        <div class="ve-edit-prompt-icon">✏</div>
        <p style="font-size:0.9rem">
          Click any highlighted element in the preview to edit it
        </p>
        <p style="font-size:0.78rem;color:var(--dark-grey)">
          Text, images, prices and link labels
        </p>
      </div>
    `;
  };

  const showPreviewBlockedState = (pageUrl) => {
    editPanel.innerHTML = `
      <div class="ve-edit-panel-inner">
        <div>
          <p style="font-size:0.78rem;color:var(--mid-grey);margin-bottom:4px">
            Preview connection issue
          </p>
          <span class="ve-key-label">${escapeHtml(pageUrl)}</span>
        </div>
        <p style="line-height:1.7;color:var(--light-grey)">
          The website preview did not finish the CMS handshake. This usually means the target site is sending frame-blocking headers or is on an older deployment.
        </p>
        <div class="ve-edit-actions">
          <a class="btn btn-primary btn-sm" href="${escapeAttribute(pageUrl)}" target="_blank" rel="noreferrer">
            Open Preview In New Tab
          </a>
        </div>
        <p class="field-hint">
          The visual editor now targets the latest embeddable Pages deployment instead of the blocked production alias.
        </p>
      </div>
    `;
  };

  const resolvePreviewOrigin = async () => {
    const configuredOrigin = String(window.MKT_VISUAL_EDITOR_PREVIEW_ORIGIN || "").trim();
    if (isAllowedPreviewOrigin(configuredOrigin)) {
      const configured = new URL(configuredOrigin).origin;
      if (await canEmbedOrigin(configured)) {
        addTrustedPreviewOrigin(configured);
        return configured;
      }
    }

    const candidates = [
      "https://mk-tintworks-1.pages.dev",
      "https://mktintworks.com",
      "https://www.mktintworks.com",
    ];

    for (const source of PREVIEW_ORIGIN_SOURCES) {
      try {
        const response = await fetch(source, { cache: "no-store" });
        if (!response.ok) {
          continue;
        }

        const payload = await response.json();
        [
          payload?.public_site?.production_host,
          payload?.publicWebsite?.productionPagesUrl,
          payload?.public_site?.latest_deployment,
          payload?.publicWebsite?.previewDeploymentUrl,
        ]
          .filter(Boolean)
          .forEach((candidate) => candidates.push(candidate));
      } catch {
        // Fall through to the next source or default preview origin.
      }
    }

    for (const candidate of candidates) {
      if (!isAllowedPreviewOrigin(candidate)) {
        continue;
      }

      const normalized = new URL(candidate).origin;
      if (!(await canEmbedOrigin(normalized))) {
        continue;
      }

      addTrustedPreviewOrigin(normalized);
      return normalized;
    }

    addTrustedPreviewOrigin(DEFAULT_PREVIEW_ORIGIN);
    return DEFAULT_PREVIEW_ORIGIN;
  };

  const loadPage = (pageKey) => {
    const url = buildWebsitePages(currentWebsiteOrigin)[pageKey];
    if (!url) {
      return;
    }

    previewLoadId += 1;
    currentPage = pageKey;
    currentKey = null;
    currentCmsType = null;
    showPrompt();
    showLoading();
    clearPreviewReadyTimer();
    previewReadyTimer = window.setTimeout(() => {
      setStatus("Preview host did not complete the live-editor handshake");
      hideLoading();
      showPreviewBlockedState(url);
    }, PREVIEW_READY_TIMEOUT_MS);
    setStatus(`Loading ${pageKey} page from ${new URL(currentWebsiteOrigin).host}...`);
    iframe.src = url;
  };

  const formatPrice = (value) => {
    const amount = Math.max(0, parseInt(String(value).replace(/[^0-9]/g, ""), 10) || 0);
    return `KSh ${amount.toLocaleString("en-KE")}`;
  };

  const postPreviewUpdate = (payload) => {
    if (!iframe.contentWindow) {
      return;
    }

    iframe.contentWindow.postMessage(payload, currentWebsiteOrigin);
  };

  const saveElement = async (key, cmsType, value, button) => {
    if (!key) {
      window.showToast("Select an element in the preview first.", "warning");
      return;
    }

    if (button) {
      window.setButtonLoading(button, true, "Saving...");
    }

    try {
      await window.POST("/api/pages/update", {
        key,
        type: cmsType,
        value,
      });

      postPreviewUpdate({
        type: "cms:element:update",
        key,
        cmsType,
        value,
      });

      window.showToast("Saved — live on website in ~30 seconds", "success");
      setStatus(`Saved: ${key}`);
    } catch (error) {
      window.showToast(`Save failed: ${error.message}`, "error");
    } finally {
      if (button) {
        window.setButtonLoading(button, false);
      }
    }
  };

  const compressImage = (file, targetKb = 200) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);

      image.onload = () => {
        URL.revokeObjectURL(url);

        const maxSide = 1920;
        let { width, height } = image;
        if (width > maxSide || height > maxSide) {
          const ratio = Math.min(maxSide / width, maxSide / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");

        if (!context) {
          reject(new Error("Canvas is unavailable in this browser"));
          return;
        }

        context.drawImage(image, 0, 0, width, height);
        const targetBytes = targetKb * 1024;
        let quality = 0.88;

        const attempt = (mimeType) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                if (mimeType === "image/webp") {
                  attempt("image/jpeg");
                  return;
                }
                reject(new Error("Canvas compression failed"));
                return;
              }

              if (blob.size <= targetBytes || quality <= 0.35) {
                resolve(blob);
                return;
              }

              quality -= 0.06;
              attempt(mimeType);
            },
            mimeType,
            quality
          );
        };

        attempt("image/webp");
      };

      image.onerror = () => reject(new Error("Failed to load image"));
      image.src = url;
    });

  const renderTextEditor = (key, currentValue) => {
    editPanel.innerHTML = `
      <div class="ve-edit-panel-inner">
        <div>
          <p style="font-size:0.78rem;color:var(--mid-grey);margin-bottom:4px">
            Editing element
          </p>
          <span class="ve-key-label">${escapeHtml(key)}</span>
        </div>
        <div class="field">
          <label for="ve-text-value">
            Content
            <span style="font-weight:400;text-transform:none;margin-left:8px;color:var(--mid-grey)" id="ve-char-count">
              ${String(currentValue).length} characters
            </span>
          </label>
          <textarea
            id="ve-text-value"
            rows="6"
            style="font-size:0.9rem;line-height:1.6"
          >${escapeHtml(currentValue)}</textarea>
        </div>
        <div class="ve-edit-actions">
          <button class="btn btn-primary btn-sm" id="ve-save-btn" type="button">
            Save Changes
          </button>
          <button class="btn btn-ghost btn-sm" id="ve-cancel-btn" type="button">
            Cancel
          </button>
        </div>
      </div>
    `;

    const textarea = document.getElementById("ve-text-value");
    const saveBtn = document.getElementById("ve-save-btn");
    textarea?.focus();

    textarea?.addEventListener("input", (event) => {
      document.getElementById("ve-char-count").textContent =
        `${event.target.value.length} characters`;
    });

    saveBtn?.addEventListener("click", () => {
      saveElement(key, "text", textarea.value, saveBtn);
    });

    document.getElementById("ve-cancel-btn")?.addEventListener("click", showPrompt);
  };

  const renderPriceEditor = (key, currentValue) => {
    const numericValue = parseInt(String(currentValue).replace(/[^0-9]/g, ""), 10) || 0;

    editPanel.innerHTML = `
      <div class="ve-edit-panel-inner">
        <div>
          <p style="font-size:0.78rem;color:var(--mid-grey);margin-bottom:4px">
            Editing price
          </p>
          <span class="ve-key-label">${escapeHtml(key)}</span>
        </div>
        <div class="field">
          <label for="ve-price-value">Price (KSh) — Sedan installation</label>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="color:var(--light-grey);font-weight:600;font-size:1rem">KSh</span>
            <input
              type="number"
              id="ve-price-value"
              value="${numericValue}"
              min="0"
              max="10000000"
              step="500"
              style="flex:1"
            >
          </div>
          <p class="field-hint">Current: ${escapeHtml(currentValue)}</p>
        </div>
        <div class="field">
          <p style="font-size:0.78rem;color:var(--mid-grey)">Formatted preview:</p>
          <p style="font-size:1.3rem;font-weight:700;color:var(--wine)" id="ve-price-preview">
            ${escapeHtml(formatPrice(currentValue))}
          </p>
        </div>
        <div class="ve-edit-actions">
          <button class="btn btn-primary btn-sm" id="ve-save-btn" type="button">
            Save Price
          </button>
          <button class="btn btn-ghost btn-sm" id="ve-cancel-btn" type="button">
            Cancel
          </button>
        </div>
        <p style="font-size:0.75rem;color:var(--warning);line-height:1.5">
          This updates the display price only. Scheduled discounts still belong in the Products Manager.
        </p>
      </div>
    `;

    const input = document.getElementById("ve-price-value");
    const saveBtn = document.getElementById("ve-save-btn");

    input?.addEventListener("input", (event) => {
      document.getElementById("ve-price-preview").textContent = formatPrice(event.target.value);
    });

    saveBtn?.addEventListener("click", () => {
      saveElement(key, "price", formatPrice(input.value), saveBtn);
    });

    document.getElementById("ve-cancel-btn")?.addEventListener("click", showPrompt);
  };

  const renderImageEditor = (key, currentSrc) => {
    editPanel.innerHTML = `
      <div class="ve-edit-panel-inner">
        <div>
          <p style="font-size:0.78rem;color:var(--mid-grey);margin-bottom:4px">
            Editing image
          </p>
          <span class="ve-key-label">${escapeHtml(key)}</span>
        </div>
        <div>
          <p style="font-size:0.78rem;color:var(--mid-grey);margin-bottom:8px">
            Current image
          </p>
          <img
            id="ve-img-preview"
            class="ve-img-preview"
            src="${escapeAttribute(currentSrc)}"
            alt="Current image"
          >
        </div>
        <div class="ve-img-upload-zone" id="ve-upload-zone" role="button" tabindex="0">
          <p style="font-size:1.5rem;margin-bottom:8px">📷</p>
          <p style="font-size:0.875rem;color:var(--light-grey)">
            Click to select a replacement image
          </p>
          <p style="font-size:0.75rem;color:var(--mid-grey);margin-top:4px">
            JPG, PNG, WebP or GIF · Max 15MB · Client-side compressed first
          </p>
        </div>
        <input
          type="file"
          id="ve-file-input"
          accept="image/jpeg,image/png,image/webp,image/gif"
          style="display:none"
        >
        <div id="ve-upload-progress" style="display:none">
          <div style="height:4px;background:var(--charcoal-2);border-radius:2px">
            <div
              id="ve-progress-bar"
              style="height:100%;background:var(--wine);border-radius:2px;width:0%;transition:width 0.3s ease"
            ></div>
          </div>
          <p style="font-size:0.78rem;color:var(--mid-grey);margin-top:6px" id="ve-progress-text">
            Compressing image...
          </p>
        </div>
        <div class="ve-edit-actions">
          <button class="btn btn-ghost btn-sm" id="ve-cancel-btn" type="button">Cancel</button>
        </div>
      </div>
    `;

    const uploadZone = document.getElementById("ve-upload-zone");
    const fileInput = document.getElementById("ve-file-input");
    const uploadProgress = document.getElementById("ve-upload-progress");
    const previewImage = document.getElementById("ve-img-preview");

    const openPicker = () => fileInput?.click();
    uploadZone?.addEventListener("click", openPicker);
    uploadZone?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openPicker();
      }
    });

    fileInput?.addEventListener("change", async (event) => {
      const [file] = event.target.files || [];
      if (!file) {
        return;
      }

      const setProgress = (pct, text) => {
        document.getElementById("ve-progress-bar").style.width = `${pct}%`;
        document.getElementById("ve-progress-text").textContent = text;
      };

      uploadProgress.style.display = "block";
      uploadZone.style.display = "none";

      try {
        setProgress(20, "Compressing image...");
        const compressed = await compressImage(file, 200);

        setProgress(52, "Uploading to server...");
        const extension = compressed.type === "image/webp" ? "webp" : "jpg";
        const formData = new FormData();
        formData.append("image", compressed, `visual-editor-upload.${extension}`);
        formData.append("cms_key", key);
        formData.append("section", "pages");

        const token = await window.MKT_CMS_AUTH.ensureToken();
        const response = await fetch(
          `${window.MKT_CMS_AUTH.API_BASE}/api/media/upload-image`,
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

        setProgress(80, "Saving to website...");
        await saveElement(key, "image", payload.cdn_url);

        setProgress(100, "Done!");
        previewImage.src = payload.cdn_url;
        uploadProgress.style.display = "none";
        uploadZone.style.display = "block";
        window.showToast("Image updated in preview and queued for site rebuild.", "success");
      } catch (error) {
        window.showToast(`Upload failed: ${error.message}`, "error");
        uploadZone.style.display = "block";
        uploadProgress.style.display = "none";
      } finally {
        fileInput.value = "";
      }
    });

    document.getElementById("ve-cancel-btn")?.addEventListener("click", showPrompt);
  };

  const renderHtmlEditor = (key, currentValue) => {
    editPanel.innerHTML = `
      <div class="ve-edit-panel-inner">
        <div>
          <p style="font-size:0.78rem;color:var(--mid-grey);margin-bottom:4px">
            Editing rich content
          </p>
          <span class="ve-key-label">${escapeHtml(key)}</span>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" type="button" data-ve-format="bold" title="Bold"><b>B</b></button>
          <button class="btn btn-ghost btn-sm" type="button" data-ve-format="italic" title="Italic"><i>I</i></button>
          <button class="btn btn-ghost btn-sm" type="button" data-ve-format="insertUnorderedList" title="Bullet list">• List</button>
        </div>
        <div
          id="ve-html-editor"
          contenteditable="true"
          style="
            background:var(--charcoal-2);
            border:1px solid var(--border-strong);
            border-radius:8px;
            padding:12px;
            min-height:120px;
            font-size:0.9rem;
            line-height:1.65;
            color:var(--white);
            outline:none;
          "
        >${currentValue}</div>
        <div class="ve-edit-actions">
          <button class="btn btn-primary btn-sm" id="ve-save-btn" type="button">
            Save Changes
          </button>
          <button class="btn btn-ghost btn-sm" id="ve-cancel-btn" type="button">
            Cancel
          </button>
        </div>
      </div>
    `;

    const editor = document.getElementById("ve-html-editor");
    const saveBtn = document.getElementById("ve-save-btn");
    editor?.focus();

    document.querySelectorAll("[data-ve-format]").forEach((button) => {
      button.addEventListener("click", () => {
        document.execCommand(button.dataset.veFormat, false, null);
        editor?.focus();
      });
    });

    saveBtn?.addEventListener("click", () => {
      saveElement(key, "html", editor.innerHTML, saveBtn);
    });

    document.getElementById("ve-cancel-btn")?.addEventListener("click", showPrompt);
  };

  const renderLinkEditor = (key, currentValue) => {
    editPanel.innerHTML = `
      <div class="ve-edit-panel-inner">
        <div>
          <p style="font-size:0.78rem;color:var(--mid-grey);margin-bottom:4px">
            Editing link label
          </p>
          <span class="ve-key-label">${escapeHtml(key)}</span>
        </div>
        <div class="field">
          <label for="ve-link-text">Link Label (visible text)</label>
          <input type="text" id="ve-link-text" value="${escapeAttribute(currentValue)}">
        </div>
        <div class="ve-edit-actions">
          <button class="btn btn-primary btn-sm" id="ve-save-btn" type="button">
            Save Label
          </button>
          <button class="btn btn-ghost btn-sm" id="ve-cancel-btn" type="button">
            Cancel
          </button>
        </div>
        <p class="field-hint">
          Link destinations stay fixed in code. This editor only changes the visible label.
        </p>
      </div>
    `;

    const input = document.getElementById("ve-link-text");
    const saveBtn = document.getElementById("ve-save-btn");

    saveBtn?.addEventListener("click", () => {
      saveElement(key, "link", input.value, saveBtn);
    });

    document.getElementById("ve-cancel-btn")?.addEventListener("click", showPrompt);
  };

  pageSelect?.addEventListener("change", () => {
    loadPage(pageSelect.value);
  });

  iframe?.addEventListener("load", () => {
    window.setTimeout(() => {
      hideLoading();
      setStatus(`Preview loaded. Waiting for live editor on ${currentPage}...`);
    }, 500);
  });

  window.addEventListener("message", (event) => {
    if (!TRUSTED_PREVIEW_ORIGINS.has(event.origin)) {
      return;
    }

    const msg = event.data;
    if (!msg || !msg.type) {
      return;
    }

    switch (msg.type) {
      case "cms:overlay:ready":
        clearPreviewReadyTimer();
        hideLoading();
        setStatus(`Ready — ${msg.count} editable elements on this page`);
        break;
      case "cms:no_editables":
        clearPreviewReadyTimer();
        hideLoading();
        setStatus("No editable elements found on this page");
        showPrompt();
        break;
      case "cms:element:selected":
        currentKey = msg.key;
        currentCmsType = msg.cmsType;
        setStatus(`Editing: ${msg.key}`);

        switch (msg.cmsType) {
          case "text":
            renderTextEditor(msg.key, msg.currentValue);
            break;
          case "html":
            renderHtmlEditor(msg.key, msg.currentValue);
            break;
          case "image":
            renderImageEditor(msg.key, msg.currentValue);
            break;
          case "price":
            renderPriceEditor(msg.key, msg.currentValue);
            break;
          case "link":
            renderLinkEditor(msg.key, msg.currentValue);
            break;
          default:
            renderTextEditor(msg.key, msg.currentValue);
        }
        break;
      default:
        break;
    }
  });

  const bootstrapPreview = async () => {
    showPrompt();
    currentWebsiteOrigin = await resolvePreviewOrigin();
    loadPage(currentPage);
  };

  bootstrapPreview();
})(window, document);
