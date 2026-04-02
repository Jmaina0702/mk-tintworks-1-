(function initServicesProducts(window, document) {
  if (!document.body.classList.contains("services-page")) {
    return;
  }

  const API_BASE = "https://mktintworks-cms-api.mktintworks.workers.dev";
  const initialState =
    window.CMS_PRODUCTS_STATE && typeof window.CMS_PRODUCTS_STATE === "object"
      ? window.CMS_PRODUCTS_STATE
      : { products: [], groups: {} };

  let timerId = null;
  let timerRefreshPromise = null;
  const completedTimerTransitions = new Set();

  const escapeHtml = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const formatKSh = (value) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      maximumFractionDigits: 0,
    }).format(Number(value || 0));

  const titleCase = (value) =>
    String(value || "")
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  const badgeClass = (tier) => {
    const normalized = String(tier || "").toLowerCase();
    if (normalized === "premium") {
      return "badge-premium";
    }
    if (normalized === "high") {
      return "badge-high";
    }
    if (normalized === "specialty") {
      return "badge-specialty";
    }
    if (normalized === "mid") {
      return "badge-mid";
    }
    if (normalized === "entry") {
      return "badge-entry";
    }
    return "badge-high";
  };

  const formatDuration = (milliseconds) => {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts = [];
    if (days > 0) {
      parts.push(`${days}d`);
    }
    parts.push(`${String(hours).padStart(2, "0")}h`);
    parts.push(`${String(minutes).padStart(2, "0")}m`);
    parts.push(`${String(seconds).padStart(2, "0")}s`);
    return parts.join(" ");
  };

  const renderDiscountBlock = (product) => {
    const discount = product.discount;
    const basePrice = formatKSh(product.base_price);
    const priceKey = `services:product_${product.product_key}_price`;

    if (!discount || discount.status === "expired") {
      return `
        <p class="product-price" data-cms-key="${escapeHtml(
          priceKey
        )}" data-cms-type="price">${basePrice}</p>
        <p class="product-discount-note" hidden></p>
        <p class="product-discount-timer" hidden></p>
      `;
    }

    if (discount.status === "scheduled") {
      const label = discount.label
        ? `Coming Soon · ${escapeHtml(discount.label)}`
        : "Coming Soon";

      return `
        <p class="product-price" data-cms-key="${escapeHtml(
          priceKey
        )}" data-cms-type="price">${basePrice}</p>
        <p class="product-discount-note">${label}</p>
        <p
          class="product-discount-timer"
          data-discount-timer="scheduled"
          data-target="${escapeHtml(discount.start_datetime)}"
        >Starts soon</p>
      `;
    }

    const discountLabel = discount.label
      ? `${escapeHtml(discount.label)} · ${discount.percentage}% Off`
      : `${discount.percentage}% Off`;

    return `
      <p class="product-price">
        <span class="product-price-original">${basePrice}</span>
        <span class="product-price-current" data-cms-key="${escapeHtml(
          priceKey
        )}" data-cms-type="price">${formatKSh(product.current_price)}</span>
      </p>
      <p class="product-discount-note">${discountLabel}</p>
      <p
        class="product-discount-timer"
        data-discount-timer="active"
        data-target="${escapeHtml(discount.end_datetime)}"
      >Ends soon</p>
    `;
  };

  const renderMoreInfo = (product) => {
    const extended = String(product.extended_description || "").trim();
    if (!extended) {
      return "";
    }

    return `
      <details class="more-info">
        <summary>More Info <span aria-hidden="true">＋</span></summary>
        <div class="more-info-body" data-cms-key="services:product_${escapeHtml(
          product.product_key
        )}_details" data-cms-type="html">${extended}</div>
      </details>
    `;
  };

  const renderBenefits = (benefits) =>
    (Array.isArray(benefits) ? benefits : [])
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join("");

  const renderProductCard = (product, index) => {
    const imageKey = `services:product_${product.product_key}_image`;
    const nameKey = `services:product_${product.product_key}_name`;
    const taglineKey = `services:product_${product.product_key}_tagline`;
    const descriptionKey = `services:product_${product.product_key}_description`;
    const warrantyKey = `services:product_${product.product_key}_warranty`;
    const ctaKey = `services:product_${product.product_key}_cta`;
    const badge =
      product.tier && product.tier !== "entry"
        ? `<span class="badge ${badgeClass(product.tier)}">${escapeHtml(
            titleCase(product.tier)
          )}</span>`
        : "";

    return `
      <article
        class="product-card ${index % 2 === 1 ? "reverse" : ""} is-visible"
        data-product-key="${escapeHtml(product.product_key)}"
      >
        <div class="product-image">
          <img
            src="${escapeHtml(product.image_url)}"
            alt="${escapeHtml(product.image_alt || product.name)}"
            loading="lazy"
            decoding="async"
            width="520"
            height="390"
            data-cms-key="${escapeHtml(imageKey)}"
            data-cms-type="image"
          >
          ${badge}
        </div>
        <div class="product-details">
          <h3 data-cms-key="${escapeHtml(nameKey)}" data-cms-type="text">${escapeHtml(
            product.name
          )}</h3>
          <p class="product-tagline" data-cms-key="${escapeHtml(
            taglineKey
          )}" data-cms-type="text">${escapeHtml(product.tagline)}</p>
          <p data-cms-key="${escapeHtml(descriptionKey)}" data-cms-type="text">${escapeHtml(
            product.short_description
          )}</p>
          <ul class="product-benefits">${renderBenefits(product.benefits)}</ul>
          ${renderDiscountBlock(product)}
          <p class="product-meta">Professional installation included · Sedan</p>
          <p class="product-warranty" data-cms-key="${escapeHtml(
            warrantyKey
          )}" data-cms-type="text">${escapeHtml(product.warranty_text)}</p>
          <a href="/book.html" class="btn-primary" data-cms-key="${escapeHtml(
            ctaKey
          )}" data-cms-type="link">Book Now</a>
          ${renderMoreInfo(product)}
        </div>
      </article>
    `;
  };

  const renderGroup = (brand, products) => {
    const host = document.querySelector(`[data-product-stack="${brand}"]`);
    if (!host) {
      return;
    }

    if (!Array.isArray(products) || products.length === 0) {
      host.innerHTML = "";
      return;
    }

    host.innerHTML = products.map(renderProductCard).join("");
  };

  const syncFilmTabs = (groups) => {
    const buttons = Array.from(
      document.querySelectorAll('[data-tab-group="films"] [data-tab-target]')
    );
    const panels = Array.from(
      document.querySelectorAll('[data-tab-panel="films"]')
    );
    const tabs = document.querySelector('[data-tab-group="films"]');

    if (!buttons.length || !panels.length) {
      return;
    }

    const visibleTargets = buttons
      .map((button) => button.dataset.tabTarget)
      .filter((target) => Array.isArray(groups[target]) && groups[target].length > 0);

    buttons.forEach((button) => {
      const isVisible = visibleTargets.includes(button.dataset.tabTarget);
      button.hidden = !isVisible;
      button.disabled = !isVisible;
      if (!isVisible) {
        button.classList.remove("active");
        button.setAttribute("aria-selected", "false");
      }
    });

    const currentButton = buttons.find(
      (button) =>
        !button.hidden && button.getAttribute("aria-selected") === "true"
    );
    const activeTarget =
      currentButton?.dataset.tabTarget && visibleTargets.includes(currentButton.dataset.tabTarget)
        ? currentButton.dataset.tabTarget
        : visibleTargets[0] || null;

    panels.forEach((panel) => {
      const isVisible = visibleTargets.includes(panel.dataset.tabPanelTarget);
      const isActive = activeTarget === panel.dataset.tabPanelTarget;
      panel.hidden = !isVisible || !isActive;
    });

    buttons.forEach((button) => {
      const isActive = button.dataset.tabTarget === activeTarget;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-selected", String(isActive));
    });

    if (tabs) {
      tabs.hidden = visibleTargets.length <= 1;
    }
  };

  const syncOtherProductsSection = (products) => {
    const section = document.querySelector("#chameleon");
    if (!section) {
      return;
    }

    section.hidden = !Array.isArray(products) || products.length === 0;
  };

  const refreshProductsForTimerTransition = async (transitionKey) => {
    if (completedTimerTransitions.has(transitionKey) || timerRefreshPromise) {
      return;
    }

    completedTimerTransitions.add(transitionKey);

    if (timerId) {
      window.clearInterval(timerId);
      timerId = null;
    }

    timerRefreshPromise = (async () => {
      try {
        const latest = await fetchLatest({ fresh: true });
        window.CMS_PRODUCTS_STATE = latest;
        render(latest);
      } catch {
        const expiredTimers = document.querySelectorAll("[data-discount-timer]");
        expiredTimers.forEach((element) => {
          element.textContent = "Offer update in progress";
        });
      } finally {
        timerRefreshPromise = null;
      }
    })();

    await timerRefreshPromise;
  };

  const hasRenderableProducts = (payload) => {
    const products = Array.isArray(payload?.products) ? payload.products : [];
    if (products.length > 0) {
      return true;
    }

    const groups = payload?.groups || {};
    return Object.values(groups).some(
      (items) => Array.isArray(items) && items.length > 0
    );
  };

  const updateTimers = () => {
    const timers = Array.from(document.querySelectorAll("[data-discount-timer]"));
    if (timerId) {
      window.clearInterval(timerId);
      timerId = null;
    }

    if (timers.length === 0) {
      return;
    }

    const tick = () => {
      timers.forEach((element) => {
        const target = new Date(element.dataset.target || "");
        if (Number.isNaN(target.getTime())) {
          return;
        }

        const remaining = target.getTime() - Date.now();
        if (remaining <= 0) {
          element.textContent = "Updating offer...";
          void refreshProductsForTimerTransition(
            `${element.dataset.discountTimer || "timer"}:${element.dataset.target || ""}`
          );
          return;
        }

        const prefix =
          element.dataset.discountTimer === "scheduled" ? "Starts in " : "Ends in ";
        element.textContent = `${prefix}${formatDuration(remaining)}`;
      });
    };

    tick();
    timerId = window.setInterval(tick, 1000);
  };

  const render = (payload, { preserveExistingMarkup = false } = {}) => {
    const groups = payload?.groups || {};
    if (preserveExistingMarkup && !hasRenderableProducts(payload)) {
      updateTimers();
      window.MKT_CMS_PREPARE_PAGE?.();
      return;
    }

    renderGroup("3m", groups["3m"] || []);
    renderGroup("llumar", groups.llumar || []);
    renderGroup("other", groups.other || []);
    syncFilmTabs(groups);
    syncOtherProductsSection(groups.other || []);
    updateTimers();
    window.MKT_CMS_PREPARE_PAGE?.();
  };

  const fetchLatest = async ({ fresh = false } = {}) => {
    const url = new URL(`${API_BASE}/api/products/site-data`);
    url.searchParams.set("_", Date.now());
    if (fresh) {
      url.searchParams.set("fresh", "1");
    }

    const response = await fetch(url.toString(), {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Product refresh failed: ${response.status}`);
    }

    return response.json();
  };

  const boot = async () => {
    render(initialState, { preserveExistingMarkup: true });

    try {
      const latest = await fetchLatest({ fresh: true });
      window.CMS_PRODUCTS_STATE = latest;
      render(latest);
    } catch {
      // The static fallback or injected build state remains in place.
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})(window, document);
