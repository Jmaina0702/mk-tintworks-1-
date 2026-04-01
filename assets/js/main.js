const body = document.body;
let siteHeader;
let navToggle;
let navMenu;
let navBackdrop;
let themeToggle;
let promotionsRoot;
let promotionsTimer;
let promotionsFadeTimer;
const THEME_OVERRIDE_KEY = "theme-override";
const LEGACY_THEME_KEY = "theme";
const PROMOTIONS_ENDPOINT =
  "https://mktintworks-cms-api.mktintworks.workers.dev/api/promotions/active";
const PROMOTIONS_DISMISS_KEY = "mkt-promotions-dismissed";

const sunIcon = `
  <svg class="icon-sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <circle cx="12" cy="12" r="5"></circle>
    <line x1="12" y1="1" x2="12" y2="3"></line>
    <line x1="12" y1="21" x2="12" y2="23"></line>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
    <line x1="1" y1="12" x2="3" y2="12"></line>
    <line x1="21" y1="12" x2="23" y2="12"></line>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
  </svg>`;

const moonIcon = `
  <svg class="icon-moon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
  </svg>`;

const facebookIcon = `
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
    <path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.9.3-1.5 1.6-1.5H16.8V4.9c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.2V11H8v3h2.4v8h3.1Z"></path>
  </svg>`;

const instagramIcon = `
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="5"></rect>
    <circle cx="12" cy="12" r="4"></circle>
    <circle cx="17.4" cy="6.6" r="1"></circle>
  </svg>`;

const whatsappIcon = `
  <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347Z"></path>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.557 4.126 1.526 5.855L.054 23.447a.5.5 0 0 0 .555.61l5.658-1.481A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0Zm0 21.75a9.706 9.706 0 0 1-4.95-1.357l-.356-.21-3.681.963.984-3.595-.232-.372A9.698 9.698 0 0 1 2.25 12C2.25 6.616 6.616 2.25 12 2.25S21.75 6.616 21.75 12 17.384 21.75 12 21.75Z"></path>
  </svg>`;

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const navTemplate = (active) => `
  <header class="site-header" id="site-header">
    <div class="container nav-wrapper">
      <a href="/" class="logo" aria-label="MK Tintworks — Home">
        <img src="/assets/images/logo/mk-logo-dark.png" alt="MK Tintworks Logo" class="logo-dark" width="140" height="44" decoding="async">
        <img src="/assets/images/logo/mk-logo-light.png" alt="MK Tintworks Logo" class="logo-light" aria-hidden="true" width="140" height="44" decoding="async">
      </a>
      <button class="nav-toggle" aria-label="Open navigation" aria-expanded="false" aria-controls="nav-menu">
        <span></span><span></span><span></span>
      </button>
      <nav id="nav-menu" class="nav" role="navigation" aria-label="Main navigation">
        <a href="/" class="nav-link ${active === "home" ? "active" : ""}" data-cms-key="nav:home_label" data-cms-type="link">Home</a>
        <a href="/services.html" class="nav-link ${active === "services" ? "active" : ""}" data-cms-key="nav:services_label" data-cms-type="link">Services</a>
        <a href="/gallery.html" class="nav-link ${active === "gallery" ? "active" : ""}" data-cms-key="nav:gallery_label" data-cms-type="link">Gallery</a>
        <a href="/testimonials.html" class="nav-link ${active === "testimonials" ? "active" : ""}" data-cms-key="nav:reviews_label" data-cms-type="link">Testimonials</a>
        <a href="/blog/" class="nav-link ${active === "blog" ? "active" : ""}" data-cms-key="nav:blog_label" data-cms-type="link">Blog</a>
        <a href="/book.html" class="nav-link nav-cta ${active === "book" ? "active" : ""}" data-cms-key="nav:book_label" data-cms-type="link">Book Now</a>
        <button class="theme-toggle" aria-label="Toggle dark/light mode" aria-pressed="false">
          <span class="theme-toggle-track" aria-hidden="true"><span class="theme-toggle-thumb"></span></span>
          ${sunIcon}
          ${moonIcon}
        </button>
      </nav>
      <div class="nav-backdrop" aria-hidden="true"></div>
    </div>
  </header>`;

const waTemplate = `
  <a href="https://wa.me/254703900575" class="wa-float" target="_blank" rel="noopener noreferrer" aria-label="Chat with us on WhatsApp">
    ${whatsappIcon}
    <span class="wa-tooltip">Chat on WhatsApp</span>
  </a>`;

const bookBandTemplate = `
  <section class="book-cta-band" aria-label="Book your appointment">
    <div class="container">
      <h2>Ready to Transform Your Vehicle?</h2>
      <p>Professional installation. Genuine 3M & Llumar films. We come to you across Nairobi.</p>
      <a href="/book.html" class="btn-primary btn-large">Book Your Appointment</a>
    </div>
  </section>`;

const footerTemplate = `
  <footer class="site-footer" role="contentinfo">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <a href="/" aria-label="MK Tintworks — Home">
            <img src="/assets/images/logo/mk-logo-dark.png" alt="MK Tintworks" class="footer-logo logo-dark" width="120" height="38" loading="lazy" decoding="async" fetchpriority="low">
            <img src="/assets/images/logo/mk-logo-light.png" alt="MK Tintworks" class="footer-logo logo-light" width="120" height="38" loading="lazy" decoding="async" fetchpriority="low">
          </a>
          <p class="footer-tagline" data-cms-key="footer:tagline" data-cms-type="text">Tint with Precision, Drive with Confidence.</p>
          <div class="social-links">
            <a href="https://facebook.com/mktintworks" target="_blank" rel="noopener noreferrer" aria-label="MK Tintworks on Facebook">${facebookIcon}</a>
            <a href="https://instagram.com/mktintworks" target="_blank" rel="noopener noreferrer" aria-label="MK Tintworks on Instagram">${instagramIcon}</a>
          </div>
        </div>
        <div class="footer-block">
          <h4>Services</h4>
          <ul>
            <li><a href="/services.html#automotive">Automotive Tinting</a></li>
            <li><a href="/services.html#residential">Residential Tinting</a></li>
            <li><a href="/services.html#commercial">Commercial Tinting</a></li>
            <li><a href="/services.html#chameleon">Chameleon Tint</a></li>
          </ul>
        </div>
        <div class="footer-block">
          <h4>Navigate</h4>
          <ul>
            <li><a href="/">Home</a></li>
            <li><a href="/services.html">Services</a></li>
            <li><a href="/gallery.html">Gallery</a></li>
            <li><a href="/blog/">Blog</a></li>
            <li><a href="/book.html">Book Now</a></li>
          </ul>
        </div>
        <div class="footer-block">
          <h4>Contact</h4>
          <ul>
            <li><a href="tel:+254703900575" data-cms-key="footer:phone_1" data-cms-type="link">+254 703 900 575</a></li>
            <li><a href="tel:+254705567956" data-cms-key="footer:phone_2" data-cms-type="link">+254 705 567 956</a></li>
            <li><a href="mailto:mktintworks.co@gmail.com" data-cms-key="footer:email" data-cms-type="link">mktintworks.co@gmail.com</a></li>
            <li data-cms-key="footer:service_area" data-cms-type="text">Serving Nairobi &amp; Surrounding Areas</li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <p data-cms-key="footer:copyright" data-cms-type="text">&copy; 2026 MK Tintworks. All rights reserved.</p>
      </div>
    </div>
  </footer>`;

document.querySelectorAll("[data-site-nav]").forEach((node) => {
  node.outerHTML = navTemplate(node.getAttribute("data-active"));
});

document.querySelectorAll("[data-wa-float]").forEach((node) => {
  node.outerHTML = waTemplate;
});

document.querySelectorAll("[data-book-cta]").forEach((node) => {
  node.outerHTML = bookBandTemplate;
});

document.querySelectorAll("[data-site-footer]").forEach((node) => {
  node.outerHTML = footerTemplate;
});

document.querySelectorAll('img[loading="lazy"]').forEach((img) => {
  if (!img.hasAttribute("decoding")) {
    img.setAttribute("decoding", "async");
  }

  if (!img.hasAttribute("fetchpriority")) {
    img.setAttribute("fetchpriority", "low");
  }
});

siteHeader = document.getElementById("site-header");
navToggle = document.querySelector(".nav-toggle");
navMenu = document.getElementById("nav-menu");
navBackdrop = document.querySelector(".nav-backdrop");
themeToggle = document.querySelector(".theme-toggle");

const systemThemeQuery = window.matchMedia("(prefers-color-scheme: light)");
const getSystemTheme = () => (systemThemeQuery.matches ? "light" : "dark");
const getThemeOverride = () => localStorage.getItem(THEME_OVERRIDE_KEY);

const applyTheme = (theme) => {
  body.classList.toggle("light", theme === "light");
  themeToggle?.setAttribute("aria-pressed", String(theme === "light"));
};

localStorage.removeItem(LEGACY_THEME_KEY);
applyTheme(getThemeOverride() ?? getSystemTheme());

const clearPromotionTimers = () => {
  if (promotionsTimer) {
    window.clearTimeout(promotionsTimer);
    promotionsTimer = null;
  }

  if (promotionsFadeTimer) {
    window.clearTimeout(promotionsFadeTimer);
    promotionsFadeTimer = null;
  }
};

const getPromotionDismissed = () => {
  try {
    return window.sessionStorage.getItem(PROMOTIONS_DISMISS_KEY) === "true";
  } catch {
    return false;
  }
};

const setPromotionDismissed = () => {
  try {
    window.sessionStorage.setItem(PROMOTIONS_DISMISS_KEY, "true");
  } catch {
    // Ignore session storage failures.
  }
};

const normalizePromotionDuration = (value) => {
  const duration = Number(value);
  if (!Number.isFinite(duration)) {
    return 5000;
  }

  return Math.max(2000, Math.min(30000, duration));
};

const getPromotionAnimation = (value) => {
  const allowed = new Set([
    "fade",
    "slide-down",
    "bounce",
    "zoom",
    "slide-right",
  ]);
  const normalized = String(value || "fade").trim().toLowerCase();
  return allowed.has(normalized) ? normalized : "fade";
};

const buildPromotionMarkup = (promotion) => {
  const label =
    promotion.custom_label || promotion.title || promotion.season || "Promotion";
  const imageUrl = escapeHtml(String(promotion.image_url || "").trim());
  const escapedLabel = escapeHtml(label);
  const imageMarkup = `
    <img
      src="${imageUrl}"
      alt="${escapedLabel}"
      loading="eager"
      decoding="async"
      fetchpriority="high"
    >
  `;
  const linkUrl = String(promotion.link_url || "").trim();
  let mediaMarkup = imageMarkup;

  if (linkUrl) {
    const isExternal = /^https?:\/\//i.test(linkUrl);
    mediaMarkup = `<a href="${escapeHtml(linkUrl)}" class="promo-banner-link"${
      isExternal ? ' target="_blank" rel="noopener noreferrer"' : ""
    }>${imageMarkup}</a>`;
  }

  return `
    <div class="container site-promotions-banner-shell">
      <div class="promo-banner promo-anim-${getPromotionAnimation(
        promotion.animation_type
      )}" data-promo-inner>
        ${mediaMarkup}
        <button class="promo-dismiss-btn" type="button" data-promo-dismiss aria-label="Dismiss promotion banner">
          &times;
        </button>
      </div>
    </div>
  `;
};

const dismissPromotionBanner = () => {
  setPromotionDismissed();
  clearPromotionTimers();
  promotionsRoot?.remove();
  promotionsRoot = null;
  updateSiteHeaderHeight();
};

const renderPromotion = (promotions, index) => {
  if (!promotionsRoot || !promotions[index]) {
    return;
  }

  promotionsRoot.innerHTML = buildPromotionMarkup(promotions[index]);
  updateSiteHeaderHeight();
  const inner = promotionsRoot.querySelector("[data-promo-inner]");
  promotionsRoot
    .querySelector("[data-promo-dismiss]")
    ?.addEventListener("click", dismissPromotionBanner, { once: true });

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      inner?.classList.add("is-visible");
    });
  });

  if (promotions.length < 2) {
    return;
  }

  clearPromotionTimers();
  promotionsTimer = window.setTimeout(() => {
    inner?.classList.remove("is-visible");
    promotionsFadeTimer = window.setTimeout(() => {
      if (!promotionsRoot) {
        return;
      }

      const nextIndex = (index + 1) % promotions.length;
      renderPromotion(promotions, nextIndex);
    }, 320);
  }, normalizePromotionDuration(promotions[index].display_duration));
};

const initPromotionsBanner = async () => {
  if (!siteHeader || getPromotionDismissed()) {
    return;
  }

  let promotions = [];
  try {
    const response = await fetch(PROMOTIONS_ENDPOINT, { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    promotions = Array.isArray(payload?.promotions)
      ? payload.promotions.filter((promotion) =>
          String(promotion?.image_url || "").trim()
        )
      : [];
  } catch {
    return;
  }

  if (!promotions.length) {
    return;
  }

  promotionsRoot = document.createElement("section");
  promotionsRoot.className = "site-promotions-banner";
  promotionsRoot.setAttribute("aria-label", "Site promotions");
  siteHeader.insertBefore(promotionsRoot, siteHeader.firstChild);
  renderPromotion(promotions, 0);
};

const updateSiteHeaderHeight = () => {
  const height = Math.max(96, Math.round(siteHeader?.getBoundingClientRect().height || 96));
  document.documentElement.style.setProperty("--site-header-height", `${height}px`);
};

const closeNav = () => {
  if (!siteHeader || !navToggle || !navMenu) return;
  siteHeader.classList.remove("nav-active");
  body.classList.remove("nav-open");
  navToggle.setAttribute("aria-expanded", "false");
};

const openNav = () => {
  if (!siteHeader || !navToggle || !navMenu) return;
  siteHeader.classList.add("nav-active");
  body.classList.add("nav-open");
  navToggle.setAttribute("aria-expanded", "true");
};

themeToggle?.addEventListener("click", () => {
  const nextTheme = body.classList.contains("light") ? "dark" : "light";
  localStorage.setItem(THEME_OVERRIDE_KEY, nextTheme);
  applyTheme(nextTheme);
});

initPromotionsBanner();

const handleSystemThemeChange = (event) => {
  if (getThemeOverride()) return;
  applyTheme(event.matches ? "light" : "dark");
};

if (typeof systemThemeQuery.addEventListener === "function") {
  systemThemeQuery.addEventListener("change", handleSystemThemeChange);
} else if (typeof systemThemeQuery.addListener === "function") {
  systemThemeQuery.addListener(handleSystemThemeChange);
}

navToggle?.addEventListener("click", () => {
  const expanded = navToggle.getAttribute("aria-expanded") === "true";
  if (expanded) {
    closeNav();
  } else {
    openNav();
  }
});

navBackdrop?.addEventListener("click", closeNav);

navMenu?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", closeNav);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeNav();
  }
});

const handleHeaderState = () => {
  if (!siteHeader) return;
  siteHeader.classList.toggle("is-scrolled", window.scrollY > 16);
  updateSiteHeaderHeight();
};

window.addEventListener("scroll", handleHeaderState, { passive: true });
handleHeaderState();

const revealItems = document.querySelectorAll("[data-reveal]");
if (revealItems.length) {
  const revealVisibleItems = () => {
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

    revealItems.forEach((item) => {
      if (item.classList.contains("is-visible")) return;

      const rect = item.getBoundingClientRect();
      const inView = rect.top <= viewportHeight * 0.92 && rect.bottom >= 0;

      if (inView) {
        item.classList.add("is-visible");
      }
    });
  };

  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: window.innerWidth <= 768 ? 0.01 : 0.12,
        rootMargin: window.innerWidth <= 768 ? "0px 0px -8% 0px" : "0px 0px -10% 0px",
      }
    );

    revealItems.forEach((item) => revealObserver.observe(item));
    revealVisibleItems();
    window.addEventListener("load", revealVisibleItems, { once: true });
    window.addEventListener("orientationchange", () => {
      window.setTimeout(revealVisibleItems, 120);
    });
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }
}

const deferredBgs = document.querySelectorAll(".deferred-bg");
if (deferredBgs.length) {
  if ("IntersectionObserver" in window) {
    const bgObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-bg-ready");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "280px 0px", threshold: 0.01 }
    );

    deferredBgs.forEach((item) => bgObserver.observe(item));
  } else {
    deferredBgs.forEach((item) => item.classList.add("is-bg-ready"));
  }
}

const tabGroups = document.querySelectorAll("[data-tab-group]");
tabGroups.forEach((group) => {
  const buttons = group.querySelectorAll("[data-tab-target]");
  const panels = document.querySelectorAll(`[data-tab-panel="${group.dataset.tabGroup}"]`);

  const activate = (target) => {
    buttons.forEach((button) => {
      const isActive = button.dataset.tabTarget === target;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-selected", String(isActive));
    });

    panels.forEach((panel) => {
      panel.hidden = panel.dataset.tabPanelTarget !== target;
    });
  };

  const defaultButton = group.querySelector("[data-default-tab='true']") || buttons[0];
  if (defaultButton) activate(defaultButton.dataset.tabTarget);

  buttons.forEach((button) => {
    button.addEventListener("click", () => activate(button.dataset.tabTarget));
  });
});

const toc = document.querySelector("[data-post-toc]");
const articleBody = document.querySelector("[data-post-body]");
if (toc && articleBody) {
  const headings = articleBody.querySelectorAll("h2");
  const fragment = document.createDocumentFragment();

  headings.forEach((heading, index) => {
    if (!heading.id) {
      heading.id = `section-${index + 1}`;
    }

    const link = document.createElement("a");
    link.href = `#${heading.id}`;
    link.textContent = heading.textContent?.trim() ?? `Section ${index + 1}`;
    fragment.appendChild(link);
  });

  if (fragment.childNodes.length) {
    toc.appendChild(fragment);
  } else {
    const fallback = document.createElement("p");
    fallback.textContent = "Outline coming soon.";
    toc.appendChild(fallback);
  }
}

document.querySelectorAll("[data-copy-url]").forEach((button) => {
  button.addEventListener("click", async () => {
    const url = button.getAttribute("data-copy-url");
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      button.textContent = "Copied";
      window.setTimeout(() => {
        button.textContent = "Copy Link";
      }, 1800);
    } catch {
      button.textContent = "Copy Failed";
      window.setTimeout(() => {
        button.textContent = "Copy Link";
      }, 1800);
    }
  });
});

window.addEventListener("resize", () => {
  updateSiteHeaderHeight();
  if (window.innerWidth > 920) {
    closeNav();
  }
});

window.requestAnimationFrame(() => {
  body.classList.add("is-ready");
});
