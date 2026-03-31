(function initBlogManager(window, document) {
  const shell = document.querySelector("[data-module-shell]");
  if (!shell) {
    return;
  }

  const state = {
    articles: [],
  };

  const escapeHtml = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const formatCategory = (value) =>
    String(value || "general")
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  const normalizeArticle = (article) => ({
    id: Number(article?.id || 0),
    slug: String(article?.slug || "").trim(),
    title: String(article?.title || "").trim(),
    category: String(article?.category || "general").trim().toLowerCase(),
    status: String(article?.status || "draft").trim().toLowerCase(),
    read_time_minutes: Number(article?.read_time_minutes || 0) || 0,
    published_at: article?.published_at || null,
    created_at: article?.created_at || null,
  });

  const renderShell = () => {
    shell.innerHTML = `
      <section class="blog-manager">
        <div class="blog-header">
          <div class="blog-header-copy">
            <p class="section-kicker">Editorial Control</p>
            <h1>Blog & Articles</h1>
            <p>
              Write, import, review, and publish expert content that supports both SEO and trust-building for MK Tintworks.
            </p>
          </div>
          <a class="btn btn-primary" href="/pages/blog-editor.html?new=true">+ New Article</a>
        </div>

        <div class="blog-stats">
          <article class="blog-stat">
            <strong id="stat-published">0</strong>
            <span>Published articles currently live on the website.</span>
          </article>
          <article class="blog-stat">
            <strong id="stat-draft" style="color:var(--gold)">0</strong>
            <span>Drafts still being refined before publication.</span>
          </article>
          <article class="blog-stat">
            <strong id="stat-total">0</strong>
            <span>Total articles tracked in the CMS editorial pipeline.</span>
          </article>
        </div>

        <section class="blog-card-panel">
          <div class="blog-header-copy" style="margin-bottom:16px">
            <h2 style="margin-bottom:8px">Article Library</h2>
            <p class="blog-table-note">
              Published rows deploy to the public blog after the build cycle. Drafts stay private until you publish.
            </p>
          </div>
          <div class="blog-table-wrap">
            <table class="cms-table blog-table" style="width:100%">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Read Time</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="articles-tbody"></tbody>
            </table>
          </div>
        </section>
      </section>
    `;
  };

  const renderStats = () => {
    const published = state.articles.filter(
      (article) => article.status === "published"
    ).length;
    const drafts = state.articles.filter(
      (article) => article.status === "draft"
    ).length;

    const publishedEl = document.getElementById("stat-published");
    const draftEl = document.getElementById("stat-draft");
    const totalEl = document.getElementById("stat-total");

    if (publishedEl) {
      publishedEl.textContent = String(published);
    }
    if (draftEl) {
      draftEl.textContent = String(drafts);
    }
    if (totalEl) {
      totalEl.textContent = String(state.articles.length);
    }
  };

  const renderTable = () => {
    const tbody = document.getElementById("articles-tbody");
    if (!tbody) {
      return;
    }

    if (!state.articles.length) {
      tbody.innerHTML = `
        <tr class="blog-empty-row">
          <td colspan="6">
            No articles yet. Click New Article to write your first post.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = state.articles
      .map(
        (article) => `
          <tr>
            <td>
              <a href="/pages/blog-editor.html?id=${article.id}">
                ${escapeHtml(article.title || "Untitled article")}
              </a>
              <span class="blog-table-meta">/blog/${escapeHtml(article.slug)}.html</span>
            </td>
            <td>${escapeHtml(formatCategory(article.category))}</td>
            <td>${window.statusBadge ? window.statusBadge(article.status) : escapeHtml(article.status)}</td>
            <td>${article.read_time_minutes ? `${article.read_time_minutes} min` : "—"}</td>
            <td>${escapeHtml(window.formatDate(article.published_at || article.created_at))}</td>
            <td>
              <div class="blog-actions-inline">
                <a class="btn btn-ghost btn-sm" href="/pages/blog-editor.html?id=${article.id}">Edit</a>
                <button class="btn btn-danger btn-sm" type="button" data-delete-id="${article.id}">
                  Delete
                </button>
              </div>
            </td>
          </tr>
        `
      )
      .join("");
  };

  const updateUi = () => {
    renderStats();
    renderTable();
  };

  const loadArticles = async () => {
    try {
      const payload = await window.GET("/api/blog");
      state.articles = Array.isArray(payload?.articles)
        ? payload.articles.map(normalizeArticle)
        : [];
      updateUi();
    } catch (error) {
      window.showToast(error.message || "Failed to load articles.", "error");
    }
  };

  const deleteArticle = (articleId) => {
    window.confirmAction(
      "This will permanently delete this article from the website and CMS. This cannot be undone.",
      async () => {
        try {
          await window.DELETE(`/api/blog/${articleId}`);
          state.articles = state.articles.filter((article) => article.id !== articleId);
          updateUi();
          window.showToast("Article deleted.", "success");
        } catch (error) {
          window.showToast(error.message || "Delete failed.", "error");
        }
      }
    );
  };

  const bindActions = () => {
    shell.addEventListener("click", (event) => {
      const deleteButton = event.target.closest("[data-delete-id]");
      if (!deleteButton) {
        return;
      }

      const articleId = Number(deleteButton.dataset.deleteId || 0);
      if (!articleId) {
        return;
      }

      deleteArticle(articleId);
    });
  };

  const boot = async () => {
    renderShell();
    bindActions();
    await window.MKT_CMS_AUTH.ready;
    await loadArticles();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})(window, document);
