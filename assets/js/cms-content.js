(function initCmsContent(window, document) {
  const API_BASE = "https://mktintworks-cms-api.mktintworks.workers.dev";
  const pageSlug = String(window.CMS_PAGE_SLUG || "").trim();
  const isPreviewMode = new URLSearchParams(window.location.search).get(
    "cms_preview"
  ) === "true";
  const AUTO_EDITABLE_SELECTOR = [
    "main h1",
    "main h2",
    "main h3",
    "main h4",
    "main h5",
    "main h6",
    "main p",
    "main a",
    "main button",
    "main label",
    "main summary",
    "main li",
    "main figcaption",
    "main span",
    "main time",
    ".book-cta-band h2",
    ".book-cta-band p",
    ".book-cta-band a",
    ".site-footer h4",
    ".site-footer p",
    ".site-footer a",
    ".site-footer li",
    ".wa-tooltip",
  ].join(", ");
  const BLOCKING_CHILD_TAGS = new Set([
    "SECTION",
    "ARTICLE",
    "DIV",
    "UL",
    "OL",
    "DL",
    "TABLE",
    "FORM",
    "FIGURE",
    "PICTURE",
    "BLOCKQUOTE",
    "DETAILS",
    "NAV",
    "HEADER",
    "FOOTER",
    "MAIN",
  ]);
  const INLINE_ONLY_TAGS = new Set([
    "A",
    "SPAN",
    "STRONG",
    "EM",
    "SMALL",
    "B",
    "I",
    "MARK",
    "SUP",
    "SUB",
    "CODE",
  ]);
  const hasOwn = (object, key) =>
    Object.prototype.hasOwnProperty.call(object || {}, key);
  const buildFreshContentUrl = (slug) => {
    const url = new URL(`${API_BASE}/api/pages/content`);
    url.searchParams.set("slug", slug);
    if (isPreviewMode) {
      url.searchParams.set("fresh", "1");
    }
    url.searchParams.set("_ts", String(Date.now()));
    return url;
  };
  const normalizeWhitespace = (value) =>
    String(value || "").replace(/\s+/g, " ").trim();
  const slugify = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .substring(0, 60);
  const getDirectText = (element) =>
    normalizeWhitespace(
      Array.from(element.childNodes || [])
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent)
        .join(" ")
    );

  const getNodeFragment = (element) => {
    const tag = element.tagName.toLowerCase();
    if (element.id) {
      return `${tag}-${slugify(element.id)}`;
    }

    if (element.dataset.tabTarget) {
      return `${tag}-${slugify(element.dataset.tabTarget)}`;
    }

    const siblings = element.parentElement
      ? Array.from(element.parentElement.children).filter(
          (sibling) => sibling.tagName === element.tagName
        )
      : [element];
    const index = Math.max(1, siblings.indexOf(element) + 1);
    return `${tag}-${index}`;
  };

  const buildAutoSectionKey = (element) => {
    const fragments = [];
    let current = element;

    while (current && current !== document.body) {
      fragments.unshift(getNodeFragment(current));

      if (
        current.id ||
        current.matches("main, footer, .book-cta-band, .wa-float")
      ) {
        break;
      }

      current = current.parentElement;
    }

    return `auto_${fragments.join("_")}`;
  };

  const hasBlockingChild = (element) =>
    Array.from(element.children || []).some(
      (child) => BLOCKING_CHILD_TAGS.has(child.tagName)
    );

  const hasSingleInlineChildOnly = (element) => {
    const children = Array.from(element.children || []);
    return (
      children.length === 1 &&
      !getDirectText(element) &&
      INLINE_ONLY_TAGS.has(children[0].tagName)
    );
  };

  const inferAutoType = (element) => {
    if (element.tagName === "A") {
      return "link";
    }

    if (element.children.length > 0) {
      return "html";
    }

    return "text";
  };

  const shouldAutoTag = (element) => {
    if (!pageSlug || !element || element.hasAttribute("data-cms-key")) {
      return false;
    }

    if (
      element.closest("[data-cms-auto='true']") ||
      element.closest("script, style, template, svg, defs, noscript")
    ) {
      return false;
    }

    if (!normalizeWhitespace(element.textContent)) {
      return false;
    }

    if (hasSingleInlineChildOnly(element) || hasBlockingChild(element)) {
      return false;
    }

    return true;
  };

  const registerAutoEditableElements = () => {
    if (!pageSlug) {
      return;
    }

    document.querySelectorAll(AUTO_EDITABLE_SELECTOR).forEach((element) => {
      if (!shouldAutoTag(element)) {
        return;
      }

      element.dataset.cmsKey = `${pageSlug}:${buildAutoSectionKey(element)}`;
      element.dataset.cmsType = inferAutoType(element);
      element.dataset.cmsAuto = "true";
    });
  };

  const setElementValue = (element, cmsType, value) => {
    if (cmsType === "image") {
      if (element.tagName === "IMG") {
        element.src = value;
      } else {
        element.style.backgroundImage = `url(${value})`;
      }
      return;
    }

    if (cmsType === "html") {
      element.innerHTML = value;
      return;
    }

    element.textContent = value;
  };

  const applyContentMap = (slug, contentMap) => {
    if (!slug || !contentMap || typeof contentMap !== "object") {
      return;
    }

    document.querySelectorAll(`[data-cms-key^="${slug}:"]`).forEach((element) => {
      const [, sectionKey = ""] = String(element.dataset.cmsKey || "").split(":");
      if (!sectionKey || !hasOwn(contentMap, sectionKey)) {
        return;
      }

      setElementValue(element, element.dataset.cmsType, contentMap[sectionKey]);
    });
  };

  const fetchContent = async (slug) => {
    const response = await fetch(buildFreshContentUrl(slug), {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to load CMS content for ${slug}`);
    }

    const payload = await response.json();
    return payload.content || {};
  };

  let refreshPromise = null;

  const readSharedContent = () =>
    Object.assign({ nav: {}, footer: {} }, window.CMS_SHARED_CONTENT || {});

  const readPageContent = () =>
    window.CMS_PAGE_CONTENT && typeof window.CMS_PAGE_CONTENT === "object"
      ? Object.assign({}, window.CMS_PAGE_CONTENT)
      : {};

  const applyKnownContent = () => {
    const sharedContent = readSharedContent();
    const pageContent = readPageContent();

    applyContentMap("nav", sharedContent.nav);
    applyContentMap("footer", sharedContent.footer);
    if (pageSlug) {
      applyContentMap(pageSlug, pageContent);
    }
  };

  const preparePage = () => {
    registerAutoEditableElements();
    applyKnownContent();
  };

  const refreshContent = async () => {
    if (refreshPromise) {
      return refreshPromise;
    }

    const requests = [
      ["nav", fetchContent("nav")],
      ["footer", fetchContent("footer")],
    ];

    if (pageSlug) {
      requests.push(["page", fetchContent(pageSlug)]);
    }

    refreshPromise = Promise.allSettled(
      requests.map(([, requestPromise]) => requestPromise)
    )
      .then((results) => {
        let didUpdate = false;
        const sharedContent = readSharedContent();
        let pageContent = readPageContent();

        results.forEach((result, index) => {
          if (result.status !== "fulfilled") {
            return;
          }

          const [kind] = requests[index];
          if (kind === "nav") {
            sharedContent.nav = result.value;
            didUpdate = true;
            return;
          }

          if (kind === "footer") {
            sharedContent.footer = result.value;
            didUpdate = true;
            return;
          }

          if (kind === "page") {
            pageContent = result.value;
            didUpdate = true;
          }
        });

        if (!didUpdate) {
          return;
        }

        window.CMS_SHARED_CONTENT = sharedContent;
        if (pageSlug) {
          window.CMS_PAGE_CONTENT = pageContent;
        }

        preparePage();
      })
      .finally(() => {
        refreshPromise = null;
      });

    return refreshPromise;
  };

  const hydrate = () => {
    preparePage();
    void refreshContent();
  };

  window.MKT_CMS_PREPARE_PAGE = preparePage;
  window.MKT_CMS_REFRESH_CONTENT = refreshContent;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", hydrate, { once: true });
  } else {
    hydrate();
  }
})(window, document);
