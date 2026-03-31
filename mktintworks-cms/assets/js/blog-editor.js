(function initBlogEditor(window, document) {
  const shell = document.querySelector("[data-module-shell]");
  if (!shell) {
    return;
  }

  const FEATURED_IMAGE_TARGET_KB = 300;
  const urlParams = new URLSearchParams(window.location.search);
  const editId = urlParams.get("id");

  const state = {
    currentArticleId: editId ? Number(editId) : null,
    currentFeaturedImageUrl: "",
    sourceType: "written",
    activeMethod: "write",
    slugTouched: false,
  };

  const escapeHtml = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const normalizeSlug = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 100);

  const stripHtml = (value) => {
    const probe = document.createElement("div");
    probe.innerHTML = String(value || "");
    return (probe.innerText || probe.textContent || "").replace(/\s+/g, " ").trim();
  };

  const setEditorStatus = (message = "", tone = "") => {
    const status = document.getElementById("editor-status");
    if (!status) {
      return;
    }

    status.textContent = message;
    status.className = ["editor-status", tone ? `is-${tone}` : ""]
      .filter(Boolean)
      .join(" ");
  };

  const setUploadStatus = (id, message = "", tone = "") => {
    const status = document.getElementById(id);
    if (!status) {
      return;
    }

    status.textContent = message;
    status.className = ["upload-status", "featured-upload-status", tone ? `is-${tone}` : ""]
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

  const renderShell = () => {
    shell.innerHTML = `
      <section class="blog-editor">
        <div class="blog-header">
          <div class="blog-header-copy">
            <p class="section-kicker">Editorial Workflow</p>
            <h1 id="editor-page-title">${state.currentArticleId ? "Edit Article" : "New Article"}</h1>
            <p>
              Write directly, import from Word, or extract from PDF. Then generate SEO, review it, and publish.
            </p>
          </div>
          <div class="blog-actions-inline">
            <button class="btn btn-secondary" type="button" id="save-draft-btn">Save Draft</button>
            <button class="btn btn-primary" type="button" id="publish-btn">Publish</button>
          </div>
        </div>

        <div class="blog-editor-shell">
          <div class="blog-editor-left">
            <section class="blog-card-panel">
              <label class="field" for="article-title" style="margin:0">
                <span class="editor-supporting-copy">Article title</span>
                <input
                  type="text"
                  id="article-title"
                  class="blog-title-input"
                  placeholder="Article title..."
                >
              </label>
            </section>

            <section class="blog-card-panel">
              <div class="editor-method-tabs" id="editor-method-tabs">
                <button class="editor-method-tab is-active" type="button" data-method="write">Write</button>
                <button class="editor-method-tab" type="button" data-method="docx">Upload Word (.docx)</button>
                <button class="editor-method-tab" type="button" data-method="pdf">Upload PDF</button>
              </div>

              <div class="editor-method-panel" id="method-write">
                <div class="editor-toolbar">
                  <button type="button" data-format="bold" title="Bold"><b>B</b></button>
                  <button type="button" data-format="italic" title="Italic"><i>I</i></button>
                  <button type="button" data-format="underline" title="Underline"><u>U</u></button>
                  <span class="toolbar-sep"></span>
                  <button type="button" data-block="H2" title="Heading 2">H2</button>
                  <button type="button" data-block="H3" title="Heading 3">H3</button>
                  <span class="toolbar-sep"></span>
                  <button type="button" data-format="insertUnorderedList" title="Bullet list">• List</button>
                  <button type="button" data-format="insertOrderedList" title="Numbered list">1. List</button>
                  <span class="toolbar-sep"></span>
                  <button type="button" id="insert-link-btn" title="Insert link">Link</button>
                </div>
                <div
                  id="article-content"
                  class="article-editor-body"
                  contenteditable="true"
                  data-placeholder="Start writing your article here..."
                ></div>
              </div>

              <div class="editor-method-panel" id="method-docx" hidden>
                <div class="blog-upload-zone" id="docx-zone" role="button" tabindex="0" aria-label="Upload Word document">
                  <p>Drop your Word document here or click to browse</p>
                  <p class="editor-supporting-copy">.docx files only</p>
                  <input type="file" id="docx-input" accept=".docx" hidden>
                </div>
                <p id="docx-status" class="upload-status"></p>
              </div>

              <div class="editor-method-panel" id="method-pdf" hidden>
                <div class="blog-upload-zone" id="pdf-zone" role="button" tabindex="0" aria-label="Upload PDF document">
                  <p>Drop your PDF here or click to browse</p>
                  <p class="editor-supporting-copy">.pdf files only</p>
                  <input type="file" id="pdf-input" accept=".pdf" hidden>
                </div>
                <p id="pdf-status" class="upload-status"></p>
              </div>

              <div id="editor-status" class="editor-status"></div>
            </section>
          </div>

          <div class="blog-editor-right">
            <section class="blog-card-panel">
              <h3 style="margin-bottom:12px">SEO Metadata</h3>
              <button class="btn btn-gold" type="button" id="generate-seo-btn" style="width:100%;margin-bottom:16px">
                Generate SEO with AI
              </button>
              <div class="field">
                <label for="seo-title">
                  SEO Title
                  <span class="char-count" id="seo-title-count">0 / 60</span>
                </label>
                <input type="text" id="seo-title" maxlength="60" placeholder="Under 60 characters for Google">
              </div>
              <div class="field">
                <label for="meta-description">
                  Meta Description
                  <span class="char-count" id="meta-desc-count">0 / 160</span>
                </label>
                <textarea id="meta-description" rows="3" maxlength="160" placeholder="Under 160 characters"></textarea>
              </div>
              <div class="field">
                <label for="article-summary">Article Summary (for listing page)</label>
                <textarea id="article-summary" rows="3" placeholder="2-3 sentence summary"></textarea>
              </div>
              <div class="field">
                <label for="seo-keywords">Keywords</label>
                <input type="text" id="seo-keywords" placeholder="keyword1, keyword2, keyword3">
              </div>
              <div class="field">
                <label for="article-slug">URL Slug</label>
                <div style="display:flex;align-items:center;gap:6px">
                  <span class="editor-supporting-copy">/blog/</span>
                  <input type="text" id="article-slug" placeholder="url-friendly-slug">
                </div>
              </div>
            </section>

            <section class="blog-card-panel">
              <h3 style="margin-bottom:12px">Settings</h3>
              <div class="blog-settings-grid">
                <div class="field">
                  <label for="article-category">Category</label>
                  <select id="article-category">
                    <option value="automotive">Automotive</option>
                    <option value="residential">Residential</option>
                    <option value="commercial">Commercial</option>
                    <option value="maintenance">Maintenance & Care</option>
                    <option value="general" selected>General</option>
                  </select>
                </div>
              </div>
            </section>

            <section class="blog-card-panel">
              <h3 style="margin-bottom:12px">Featured Image</h3>
              <img id="featured-img-preview" class="featured-preview" src="" alt="" hidden>
              <div class="field">
                <input type="file" id="featured-image-input" accept="image/*">
              </div>
              <div class="field">
                <label for="featured-image-alt">Image Alt Text</label>
                <input type="text" id="featured-image-alt" placeholder="Describe the image for SEO">
              </div>
              <div id="featured-upload-status" class="featured-upload-status"></div>
            </section>
          </div>
        </div>
      </section>
    `;
  };

  const switchMethod = (method) => {
    state.activeMethod = method;

    document.querySelectorAll("[data-method]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.method === method);
    });

    document.querySelectorAll(".editor-method-panel").forEach((panel) => {
      panel.hidden = panel.id !== `method-${method}`;
    });
  };

  const inferSourceTypeFromMethod = (method) => {
    if (method === "docx") {
      return "docx_upload";
    }
    if (method === "pdf") {
      return "pdf_upload";
    }
    return "written";
  };

  const maybeAutoFillSlug = () => {
    if (state.slugTouched) {
      return;
    }

    const title = document.getElementById("article-title")?.value || "";
    const slugInput = document.getElementById("article-slug");
    if (!slugInput) {
      return;
    }

    slugInput.value = normalizeSlug(title);
  };

  const updateFeaturedPreview = (url, alt = "") => {
    const preview = document.getElementById("featured-img-preview");
    if (!preview) {
      return;
    }

    if (!url) {
      preview.src = "";
      preview.alt = "";
      preview.hidden = true;
      return;
    }

    preview.src = url;
    preview.alt = alt;
    preview.hidden = false;
  };

  const processDocx = async (file) => {
    setUploadStatus("docx-status", "", "");

    if (!/\.docx$/i.test(file.name || "")) {
      setUploadStatus("docx-status", "Please upload a .docx file.", "error");
      return;
    }

    setUploadStatus("docx-status", "Reading document...", "");

    try {
      if (!window.mammoth || typeof window.mammoth.convertToHtml !== "function") {
        throw new Error("mammoth.js is unavailable");
      }

      const result = await window.mammoth.convertToHtml({
        arrayBuffer: await file.arrayBuffer(),
      });

      const html = String(result?.value || "").trim();
      if (!html) {
        throw new Error("Document appears to be empty");
      }

      document.getElementById("article-content").innerHTML = html;
      const titleInput = document.getElementById("article-title");
      if (titleInput && !titleInput.value.trim()) {
        titleInput.value = String(file.name || "")
          .replace(/\.docx$/i, "")
          .replace(/[-_]+/g, " ");
        maybeAutoFillSlug();
      }

      state.sourceType = "docx_upload";
      switchMethod("write");
      setUploadStatus(
        "docx-status",
        `Document loaded — ${Number(result?.messages?.length || 0)} conversion notes.`,
        "success"
      );
      window.showToast(
        "Word document loaded. Review content then generate SEO.",
        "success"
      );
    } catch (error) {
      setUploadStatus(
        "docx-status",
        `Failed to read document: ${error.message}`,
        "error"
      );
    }
  };

  const processPdf = async (file) => {
    setUploadStatus("pdf-status", "", "");

    if (!/\.pdf$/i.test(file.name || "")) {
      setUploadStatus("pdf-status", "Please upload a .pdf file.", "error");
      return;
    }

    setUploadStatus("pdf-status", "Reading PDF...", "");

    try {
      if (!window.pdfjsLib || typeof window.pdfjsLib.getDocument !== "function") {
        throw new Error("PDF.js is unavailable");
      }

      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

      const pdf = await window.pdfjsLib.getDocument({
        data: await file.arrayBuffer(),
      }).promise;
      let fullText = "";

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        const pageText = content.items
          .map((item) => String(item.str || ""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

        if (pageText) {
          fullText += `<p>${escapeHtml(pageText)}</p>`;
        }
      }

      if (!fullText.trim()) {
        throw new Error(
          "Could not extract text from PDF. The PDF may be scanned or image-based."
        );
      }

      document.getElementById("article-content").innerHTML = fullText;
      const titleInput = document.getElementById("article-title");
      if (titleInput && !titleInput.value.trim()) {
        titleInput.value = String(file.name || "")
          .replace(/\.pdf$/i, "")
          .replace(/[-_]+/g, " ");
        maybeAutoFillSlug();
      }

      state.sourceType = "pdf_upload";
      switchMethod("write");
      setUploadStatus(
        "pdf-status",
        `PDF loaded — ${pdf.numPages} page${pdf.numPages === 1 ? "" : "s"} extracted.`,
        "success"
      );
      window.showToast("PDF loaded. Review content then generate SEO.", "success");
    } catch (error) {
      setUploadStatus("pdf-status", `Failed to read PDF: ${error.message}`, "error");
    }
  };

  const bindDropZone = (zoneId, inputId, handler) => {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    if (!zone || !input) {
      return;
    }

    const openPicker = () => input.click();

    zone.addEventListener("click", openPicker);
    zone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openPicker();
      }
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
      const file = event.dataTransfer?.files?.[0];
      if (file) {
        await handler(file);
      }
    });

    input.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (file) {
        await handler(file);
      }
      input.value = "";
    });
  };

  const uploadFeaturedImage = async (file) => {
    setUploadStatus("featured-upload-status", "Compressing and uploading image...", "");

    try {
      if (typeof window.compressImage !== "function") {
        throw new Error("Shared image compression helper is unavailable");
      }

      const compressed = await window.compressImage(file, FEATURED_IMAGE_TARGET_KB, 2200);
      const extension = compressed.type === "image/webp" ? "webp" : "jpg";
      const safeBase = String(file.name || "blog-featured").replace(/\.[^.]+$/, "");
      const formData = new FormData();
      const token = await window.MKT_CMS_AUTH.ensureToken();

      formData.append("image", compressed, `${safeBase}.${extension}`);
      formData.append("section", "blog");
      formData.append("cms_key", "blog:featured_image");

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
        throw new Error(payload.error || "Image upload failed");
      }

      state.currentFeaturedImageUrl = payload.cdn_url || "";
      const alt = document.getElementById("featured-image-alt")?.value.trim() || "";
      updateFeaturedPreview(state.currentFeaturedImageUrl, alt);
      setUploadStatus("featured-upload-status", "Featured image uploaded.", "success");
      window.showToast("Featured image uploaded.", "success");
    } catch (error) {
      setUploadStatus(
        "featured-upload-status",
        `Image upload failed: ${error.message}`,
        "error"
      );
    }
  };

  const collectArticleData = (status) => {
    const contentEl = document.getElementById("article-content");
    const htmlContent = contentEl?.innerHTML || "";
    const wordCount = stripHtml(htmlContent)
      .split(/\s+/)
      .filter(Boolean).length;
    const readMinutes = Math.max(1, Math.ceil(wordCount / 200));

    return {
      id: state.currentArticleId,
      title: document.getElementById("article-title")?.value.trim() || "",
      content: htmlContent,
      ai_title: document.getElementById("seo-title")?.value.trim() || "",
      meta_description:
        document.getElementById("meta-description")?.value.trim() || "",
      summary: document.getElementById("article-summary")?.value.trim() || "",
      keywords: document.getElementById("seo-keywords")?.value.trim() || "",
      slug: normalizeSlug(document.getElementById("article-slug")?.value || ""),
      category: document.getElementById("article-category")?.value || "general",
      read_time_minutes: readMinutes,
      status,
      source_type: state.sourceType,
      featured_image_url: state.currentFeaturedImageUrl || null,
      featured_image_alt:
        document.getElementById("featured-image-alt")?.value.trim() || "",
    };
  };

  const saveArticle = async (status) => {
    setEditorStatus("", "");
    const data = collectArticleData(status);

    if (!data.title) {
      window.showToast("Article needs a title before saving.", "warning");
      return;
    }

    if (!data.slug) {
      data.slug = normalizeSlug(data.title);
      const slugInput = document.getElementById("article-slug");
      if (slugInput) {
        slugInput.value = data.slug;
      }
    }

    if (status === "published" && !data.meta_description) {
      window.showToast(
        "Meta description is needed for SEO. Generate or write it first.",
        "warning"
      );
      return;
    }

    const button = document.getElementById(
      status === "published" ? "publish-btn" : "save-draft-btn"
    );
    window.setButtonLoading(
      button,
      true,
      status === "published" ? "Publishing..." : "Saving..."
    );

    try {
      const result = await window.POST("/api/blog/save", data);
      state.currentArticleId = Number(result?.id || state.currentArticleId || 0);

      if (result?.slug) {
        const slugInput = document.getElementById("article-slug");
        if (slugInput) {
          slugInput.value = result.slug;
        }
      }

      const pageTitle = document.getElementById("editor-page-title");
      if (pageTitle) {
        pageTitle.textContent = `Editing: ${data.title}`;
      }

      const successMessage =
        status === "published"
          ? "Article published — live on website after the build cycle."
          : "Draft saved.";
      setEditorStatus(successMessage, "success");
      window.showToast(successMessage, "success");

      if (!editId && state.currentArticleId) {
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set("id", String(state.currentArticleId));
        nextUrl.searchParams.delete("new");
        window.history.replaceState({}, "", nextUrl);
      }
    } catch (error) {
      setEditorStatus(`Save failed: ${error.message}`, "error");
      window.showToast(`Save failed: ${error.message}`, "error");
    } finally {
      window.setButtonLoading(button, false);
    }
  };

  const generateSeo = async () => {
    const rawHtml = document.getElementById("article-content")?.innerHTML || "";
    const plainText = stripHtml(rawHtml);

    if (plainText.length < 100) {
      window.showToast(
        "Article is too short. Write at least 100 characters first.",
        "warning"
      );
      return;
    }

    const button = document.getElementById("generate-seo-btn");
    window.setButtonLoading(button, true, "Generating...");

    try {
      const result = await window.POST("/api/blog/generate-seo", {
        text: plainText.substring(0, 4000),
        title: document.getElementById("article-title")?.value.trim() || "",
      });

      document.getElementById("seo-title").value = result?.title || "";
      document.getElementById("meta-description").value =
        result?.meta_description || "";
      document.getElementById("article-summary").value = result?.summary || "";
      document.getElementById("seo-keywords").value = result?.keywords || "";

      const slugInput = document.getElementById("article-slug");
      if (slugInput && (!slugInput.value || !state.slugTouched)) {
        slugInput.value = result?.slug || "";
      }

      updateCounter("seo-title", "seo-title-count", 60);
      updateCounter("meta-description", "meta-desc-count", 160);
      window.showToast(
        "SEO metadata generated. Review and edit before publishing.",
        "success"
      );
    } catch (error) {
      window.showToast(`AI generation failed: ${error.message}`, "error");
    } finally {
      window.setButtonLoading(button, false);
    }
  };

  const hydrateArticle = async (articleId) => {
    if (!articleId) {
      return;
    }

    try {
      const payload = await window.GET(`/api/blog/${articleId}`);
      const article = payload?.article;
      if (!article) {
        throw new Error("Article not found");
      }

      state.currentArticleId = Number(article.id || 0);
      state.currentFeaturedImageUrl = article.featured_image_url || "";
      state.sourceType = article.source_type || "written";

      document.getElementById("editor-page-title").textContent = `Editing: ${article.title}`;
      document.getElementById("article-title").value = article.title || "";
      document.getElementById("article-content").innerHTML = article.content || "";
      document.getElementById("seo-title").value = article.ai_title || "";
      document.getElementById("meta-description").value =
        article.meta_description || "";
      document.getElementById("article-summary").value = article.summary || "";
      document.getElementById("seo-keywords").value = article.keywords || "";
      document.getElementById("article-slug").value = article.slug || "";
      document.getElementById("article-category").value =
        article.category || "general";
      document.getElementById("featured-image-alt").value =
        article.featured_image_alt || "";

      updateFeaturedPreview(
        state.currentFeaturedImageUrl,
        article.featured_image_alt || ""
      );
      updateCounter("seo-title", "seo-title-count", 60);
      updateCounter("meta-description", "meta-desc-count", 160);
    } catch (error) {
      setEditorStatus(`Could not load article: ${error.message}`, "error");
      window.showToast(`Could not load article: ${error.message}`, "error");
    }
  };

  const bindToolbar = () => {
    const toolbar = shell.querySelector(".editor-toolbar");
    const editor = document.getElementById("article-content");
    if (!toolbar || !editor) {
      return;
    }

    const runCommand = (command, value = null) => {
      editor.focus();
      document.execCommand(command, false, value);
    };

    toolbar.addEventListener("click", (event) => {
      const formatButton = event.target.closest("[data-format]");
      if (formatButton) {
        runCommand(formatButton.dataset.format);
        return;
      }

      const blockButton = event.target.closest("[data-block]");
      if (blockButton) {
        runCommand("formatBlock", blockButton.dataset.block);
      }
    });

    document.getElementById("insert-link-btn")?.addEventListener("click", () => {
      const url = window.prompt("Enter URL:");
      if (url) {
        runCommand("createLink", url);
      }
    });
  };

  const bindEvents = () => {
    document.getElementById("save-draft-btn")?.addEventListener("click", () => {
      saveArticle("draft");
    });
    document.getElementById("publish-btn")?.addEventListener("click", () => {
      saveArticle("published");
    });
    document
      .getElementById("generate-seo-btn")
      ?.addEventListener("click", generateSeo);

    document
      .getElementById("editor-method-tabs")
      ?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-method]");
        if (!button) {
          return;
        }

        const method = button.dataset.method || "write";
        switchMethod(method);
        if (method !== "write") {
          state.sourceType = inferSourceTypeFromMethod(method);
        } else if (!state.currentArticleId) {
          state.sourceType = "written";
        }
      });

    document.getElementById("article-title")?.addEventListener("input", () => {
      maybeAutoFillSlug();
    });

    document.getElementById("article-slug")?.addEventListener("input", (event) => {
      state.slugTouched = true;
      event.target.value = normalizeSlug(event.target.value);
    });

    document
      .getElementById("featured-image-alt")
      ?.addEventListener("input", (event) => {
        updateFeaturedPreview(state.currentFeaturedImageUrl, event.target.value.trim());
      });

    document
      .getElementById("featured-image-input")
      ?.addEventListener("change", async (event) => {
        const file = event.target.files?.[0];
        if (file) {
          await uploadFeaturedImage(file);
        }
        event.target.value = "";
      });

    document.getElementById("seo-title")?.addEventListener("input", () => {
      updateCounter("seo-title", "seo-title-count", 60);
    });
    document.getElementById("meta-description")?.addEventListener("input", () => {
      updateCounter("meta-description", "meta-desc-count", 160);
    });

    bindDropZone("docx-zone", "docx-input", processDocx);
    bindDropZone("pdf-zone", "pdf-input", processPdf);
    bindToolbar();
  };

  const boot = async () => {
    renderShell();
    switchMethod("write");
    bindEvents();
    updateCounter("seo-title", "seo-title-count", 60);
    updateCounter("meta-description", "meta-desc-count", 160);
    await window.MKT_CMS_AUTH.ready;
    await hydrateArticle(state.currentArticleId);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})(window, document);
