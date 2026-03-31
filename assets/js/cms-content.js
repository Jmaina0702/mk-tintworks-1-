(function initCmsContent(window, document) {
  const API_BASE = "https://mktintworks-cms-api.mktintworks.workers.dev";
  const pageSlug = String(window.CMS_PAGE_SLUG || "").trim();
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
      headers: {
        "Cache-Control": "no-cache",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to load CMS content for ${slug}`);
    }

    const payload = await response.json();
    return payload.content || {};
  };

  const hydrate = async () => {
    registerAutoEditableElements();

    const sharedContent = Object.assign(
      { nav: {}, footer: {} },
      window.CMS_SHARED_CONTENT || {}
    );
    let pageContent = Object.assign({}, window.CMS_PAGE_CONTENT || {});

    applyContentMap("nav", sharedContent.nav);
    applyContentMap("footer", sharedContent.footer);
    if (pageSlug) {
      applyContentMap(pageSlug, pageContent);
    }

    const needsNav = Object.keys(sharedContent.nav).length === 0;
    const needsFooter = Object.keys(sharedContent.footer).length === 0;
    const needsPage = pageSlug && Object.keys(pageContent).length === 0;

    if (!needsNav && !needsFooter && !needsPage) {
      return;
    }

    try {
      const [navContent, footerContent, currentPageContent] = await Promise.all([
        needsNav ? fetchContent("nav") : Promise.resolve(sharedContent.nav),
        needsFooter ? fetchContent("footer") : Promise.resolve(sharedContent.footer),
        needsPage ? fetchContent(pageSlug) : Promise.resolve(pageContent),
      ]);

      window.CMS_SHARED_CONTENT = {
        nav: navContent,
        footer: footerContent,
      };
      window.CMS_PAGE_CONTENT = currentPageContent;

      applyContentMap("nav", navContent);
      applyContentMap("footer", footerContent);
      if (pageSlug) {
        pageContent = currentPageContent;
        applyContentMap(pageSlug, pageContent);
      }
    } catch {
      // Static source content remains visible if the CMS API is unavailable.
    }
  };

  const preparePage = () => {
    registerAutoEditableElements();
  };

  window.MKT_CMS_PREPARE_PAGE = preparePage;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", hydrate, { once: true });
  } else {
    hydrate();
  }
})(window, document);
