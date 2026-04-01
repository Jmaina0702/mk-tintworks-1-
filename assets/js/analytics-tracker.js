(function initAnalyticsTracker(window, document) {
  const ANALYTICS_URL =
    "https://mktintworks-cms-api.mktintworks.workers.dev/api/analytics/event";
  const SAME_SITE_HOSTS = new Set([
    "mktintworks.com",
    "www.mktintworks.com",
    "mk-tintworks-1.pages.dev",
  ]);

  const normalizeReferrerDomain = () => {
    const referrer = String(document.referrer || "").trim();
    if (!referrer) {
      return "direct";
    }

    try {
      const hostname = String(new URL(referrer).hostname || "")
        .replace(/^www\./i, "")
        .toLowerCase();
      const currentHost = String(window.location.hostname || "")
        .replace(/^www\./i, "")
        .toLowerCase();

      if (!hostname || hostname === currentHost || SAME_SITE_HOSTS.has(hostname)) {
        return "direct";
      }

      return hostname;
    } catch {
      return "unknown";
    }
  };

  const trackEvent = async (eventType, extra = {}) => {
    try {
      await window.fetch(ANALYTICS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        keepalive: true,
        body: JSON.stringify({
          event_type: eventType,
          page: window.location.pathname,
          referrer: normalizeReferrerDomain(),
          ...extra,
        }),
      });
    } catch {
      // Analytics must never block or visibly fail.
    }
  };

  const isBookTarget = (element) => {
    if (!element) {
      return false;
    }

    if (element.closest("#booking-form")) {
      return false;
    }

    if (element.dataset.analyticsLabel === "book_now") {
      return true;
    }

    const href = String(element.getAttribute?.("href") || "").toLowerCase();
    const text = String(element.textContent || "").toLowerCase();
    const aria = String(element.getAttribute?.("aria-label") || "").toLowerCase();

    return href.includes("book") || text.includes("book") || aria.includes("book");
  };

  window.MKT_TRACK_EVENT = trackEvent;

  trackEvent("pageview");

  document.addEventListener(
    "click",
    (event) => {
      const productTrigger = event.target.closest(
        "summary, .more-info-btn, details summary"
      );
      const productHost = productTrigger?.closest("[data-product-key]");
      if (productHost?.dataset.productKey) {
        trackEvent("product_click", {
          product_key: productHost.dataset.productKey,
        });
        return;
      }

      const whatsappTarget = event.target.closest(
        "a[href*='wa.me'], [data-analytics-label='whatsapp']"
      );
      if (whatsappTarget) {
        trackEvent("cta_click", { label: "whatsapp" });
        return;
      }

      const bookTarget = event.target.closest(
        "[data-analytics-label='book_now'], .cta-book, a[href*='book'], .btn-primary, .btn-large"
      );
      if (bookTarget && isBookTarget(bookTarget)) {
        trackEvent("cta_click", { label: "book_now" });
      }
    },
    true
  );

  if (!document.body.classList.contains("article-page")) {
    return;
  }

  let blogTracked = false;
  const trackBlogRead = () => {
    if (blogTracked) {
      return;
    }

    const scrollHeight = document.documentElement.scrollHeight;
    const viewportHeight = window.innerHeight;
    const maxScroll = Math.max(1, scrollHeight - viewportHeight);
    const scrollPct = window.scrollY / maxScroll;

    if (scrollPct >= 0.5) {
      blogTracked = true;
      trackEvent("blog_read");
      window.removeEventListener("scroll", trackBlogRead);
    }
  };

  window.addEventListener("scroll", trackBlogRead, { passive: true });
  trackBlogRead();
})(window, document);
