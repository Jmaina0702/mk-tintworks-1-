(function initProductsManager(window, document) {
  const host = document.querySelector("[data-module-shell]");
  if (!host) return;

  const PUBLIC_SITE_BASE = "https://mk-tintworks-1.pages.dev";
  const brandMeta = {
    "3m": ["3M Films", "3M catalog", "Manage the flagship 3M ladder."],
    llumar: ["Llumar Films", "Llumar catalog", "Manage the full Llumar stack."],
    other: ["Other Products", "Specialty products", "Control Chameleon and future specialty offers."],
  };
  const state = {
    loading: true,
    products: [],
    groups: { "3m": [], llumar: [], other: [] },
    totals: { total: 0, active: 0, discounted: 0 },
    error: "",
  };

  const escapeHtml = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  const previewImageUrl = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith("/")) return `${PUBLIC_SITE_BASE}${raw}`;
    return raw;
  };
  const toLocalDateTimeInput = (value) => {
    const date = new Date(value || "");
    if (Number.isNaN(date.getTime())) return "";
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  };
  const toIsoDateTime = (value) => {
    const date = new Date(value || "");
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  };

  const metricCard = (label, value, hint, tone = "neutral") => `
    <article class="metric-card" data-tone="${escapeHtml(tone)}">
      <span class="metric-label">${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <p>${escapeHtml(hint)}</p>
    </article>
  `;

  const discountSummary = (product) => {
    const discount = product.discount;
    if (!discount || discount.status === "expired") {
      return `<div class="catalog-note"><strong>No live discount</strong>Base price is live on the website.</div>`;
    }
    if (discount.status === "scheduled") {
      return `<div class="catalog-note" data-tone="warning"><strong>Campaign scheduled</strong>${escapeHtml(
        discount.percentage
      )}% off starts ${escapeHtml(window.formatDateTime(discount.start_datetime))}.</div>`;
    }
    return `<div class="catalog-note" data-tone="success"><strong>Campaign live</strong>${escapeHtml(
      discount.percentage
    )}% off ends ${escapeHtml(window.formatDateTime(discount.end_datetime))}.</div>`;
  };

  const productCard = (product) => `
    <article class="catalog-card">
      <div class="catalog-card-media">
        <img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(
          product.image_alt || product.name
        )}">
      </div>
      <div class="catalog-card-body">
        <div class="catalog-card-heading">
          <div>
            <h3>${escapeHtml(product.name)}</h3>
            <p class="catalog-card-tagline">${escapeHtml(product.tagline)}</p>
          </div>
          ${window.tierBadge(product.tier)}
        </div>
        <p class="catalog-card-summary">${escapeHtml(product.short_description)}</p>
        <ul class="catalog-card-benefits">
          ${product.benefits
            .slice(0, 3)
            .map((item) => `<li>${escapeHtml(item)}</li>`)
            .join("")}
        </ul>
        <div class="catalog-price-grid">
          <div class="catalog-price-box"><span>Base price</span><strong>${escapeHtml(
            window.formatKSh(product.base_price)
          )}</strong></div>
          <div class="catalog-price-box"><span>Current website price</span><strong>${escapeHtml(
            window.formatKSh(product.current_price)
          )}</strong></div>
        </div>
        ${discountSummary(product)}
        <div class="catalog-card-status">
          ${window.statusBadge(product.is_active ? "Active" : "Hidden")}
          ${product.discount ? window.statusBadge(product.discount.status) : ""}
        </div>
        <p class="catalog-card-meta">Updated ${escapeHtml(
          window.formatRelativeTime(product.updated_at)
        )} · Order ${escapeHtml(product.display_order)}</p>
        <div class="catalog-card-actions">
          <button class="btn btn-primary btn-sm" type="button" data-edit-product="${
            product.id
          }">Edit Product</button>
          <button class="btn btn-secondary btn-sm" type="button" data-manage-discount="${
            product.id
          }">Manage Discount</button>
        </div>
      </div>
    </article>
  `;

  const groupSection = (brand) => {
    const products = state.groups[brand] || [];
    const [eyebrow, title, description] = brandMeta[brand];
    return `
      <section class="panel-card catalog-group">
        <div class="catalog-group-header">
          <div>
            <span class="eyebrow">${escapeHtml(eyebrow)}</span>
            <h2>${escapeHtml(title)}</h2>
            <p>${escapeHtml(description)}</p>
          </div>
          ${window.statusBadge(`${products.length} products`)}
        </div>
        ${
          products.length
            ? `<div class="catalog-grid">${products.map(productCard).join("")}</div>`
            : `<div class="catalog-empty"><strong>No products in this group</strong>Add or restore products before they can appear on the services page.</div>`
        }
      </section>
    `;
  };

  const renderShell = () => {
    host.innerHTML = `
      <section class="hero-banner">
        <div class="content-cluster">
          <span class="eyebrow">Pricing + Promotions</span>
          <h2>Manage the live tint catalog and scheduled discount timers.</h2>
          <p>This page now reads real D1 product rows, uploads images to R2, and controls timed discounts that the Worker cron expires automatically.</p>
        </div>
        <div class="hero-actions">
          <button class="btn btn-secondary" type="button" data-refresh-products>Refresh Catalog</button>
          <a class="btn btn-primary" href="${PUBLIC_SITE_BASE}/services.html" target="_blank" rel="noopener noreferrer">Open Live Services Page</a>
        </div>
      </section>
      <section class="summary-grid">
        ${metricCard("Catalog items", state.totals.total || state.products.length || 0, "All PRD products stay in one D1 catalog.", "gold")}
        ${metricCard("Visible on site", state.totals.active || 0, "Hidden products stay in CMS history only.", "success")}
        ${metricCard("Discounted now", state.products.filter((product) => product.discount && product.discount.status === "active").length, "Live campaigns override base price.", "warning")}
        ${metricCard("Scheduled next", state.products.filter((product) => product.discount && product.discount.status === "scheduled").length, "Upcoming campaigns show as Coming Soon.", "neutral")}
      </section>
      <section class="panel-card">
        <div class="catalog-toolbar">
          <div class="catalog-toolbar-copy">
            <span class="eyebrow">Live Catalog</span>
            <h3>Grouped exactly like the public services page</h3>
            <p>Edit any product, upload its image, and schedule promotions from one screen.</p>
          </div>
          <div class="catalog-toolbar-actions">
            <button class="btn btn-secondary btn-sm" type="button" data-refresh-products>Reload D1 data</button>
          </div>
        </div>
        ${
          state.loading && !state.products.length
            ? `<div class="catalog-empty"><strong>Loading catalog...</strong>Pulling the latest products and discount states from the Worker.</div>`
            : state.error
              ? `<div class="catalog-empty"><strong>Catalog load failed</strong>${escapeHtml(state.error)}</div>`
              : `<div class="catalog-groups">${["3m", "llumar", "other"].map(groupSection).join("")}</div>`
        }
      </section>
    `;
    bindPageEvents();
  };

  const loadProducts = async ({ silent = false } = {}) => {
    state.loading = true;
    state.error = "";
    if (!silent) renderShell();
    try {
      const payload = await window.GET("/api/products");
      state.products = Array.isArray(payload.products) ? payload.products : [];
      state.groups = payload.groups || { "3m": [], llumar: [], other: [] };
      state.totals = payload.totals || {
        total: state.products.length,
        active: state.products.filter((product) => product.is_active).length,
        discounted: 0,
      };
    } catch (error) {
      state.error = error.message || "Unknown error";
      window.showToast(state.error, "error");
    } finally {
      state.loading = false;
      renderShell();
    }
  };

  const benefitRows = (benefits) => {
    const items = Array.isArray(benefits) ? benefits.filter(Boolean) : [];
    while (items.length < 3) items.push("");
    return items
      .map(
        (benefit, index) => `
          <div class="benefit-row">
            <input type="text" value="${escapeHtml(benefit)}" data-benefit-input maxlength="220" placeholder="Benefit ${
              index + 1
            }">
            <button class="btn btn-ghost btn-sm" type="button" data-remove-benefit>Remove</button>
          </div>
        `
      )
      .join("");
  };

  const editModalBody = (detail) => {
    const product = detail.product;
    return `
      <form class="catalog-form" data-product-form>
        <input type="hidden" name="id" value="${escapeHtml(product.id)}">
        <input type="hidden" name="product_key" value="${escapeHtml(product.product_key)}">
        <div class="modal-split">
          <div class="catalog-form-grid" data-columns="2">
            <div class="field"><label>Product name</label><input name="name" type="text" value="${escapeHtml(product.name)}" maxlength="180" required></div>
            <div class="field"><label>Tagline</label><input name="tagline" type="text" value="${escapeHtml(product.tagline)}" maxlength="180"></div>
            <div class="field catalog-form-span"><label>Short description</label><textarea name="short_description" maxlength="1800">${escapeHtml(product.short_description)}</textarea></div>
            <div class="field catalog-form-span"><label>Extended description / more-info HTML</label><textarea name="extended_description">${escapeHtml(product.extended_description)}</textarea><span class="field-hint">HTML is allowed here.</span></div>
            <div class="field"><label>Base price</label><input name="base_price" type="number" min="0" step="1" value="${escapeHtml(product.base_price)}" required></div>
            <div class="field"><label>Tier</label><select name="tier">${["premium", "high", "mid", "entry", "specialty"]
              .map((tier) => `<option value="${tier}" ${product.tier === tier ? "selected" : ""}>${escapeHtml(tier.charAt(0).toUpperCase() + tier.slice(1))}</option>`)
              .join("")}</select></div>
            <div class="field"><label>Image URL</label><input name="image_url" type="text" value="${escapeHtml(product.raw_image_url || product.image_url)}" data-image-url></div>
            <div class="field"><label>Image alt text</label><input name="image_alt" type="text" value="${escapeHtml(product.image_alt)}" maxlength="180"></div>
            <div class="field"><label>Warranty text</label><input name="warranty_text" type="text" value="${escapeHtml(product.warranty_text)}" maxlength="240"></div>
            <div class="field"><label>Display order</label><input name="display_order" type="number" min="0" max="100" step="1" value="${escapeHtml(product.display_order)}"></div>
            <div class="field catalog-form-span">
              <label>Benefits</label>
              <div class="benefits-editor" data-benefits-list>${benefitRows(product.benefits)}</div>
              <div class="inline-actions"><button class="btn btn-secondary btn-sm" type="button" data-add-benefit>Add benefit</button></div>
              <span class="field-hint">Keep between 3 and 10 benefits.</span>
            </div>
            <div class="field catalog-form-span">
              <label class="switch-row">
                <span><strong>Visibility</strong><br>Hide the product from the public site without deleting it.</span>
                <span class="switch"><input type="checkbox" name="is_active" ${product.is_active ? "checked" : ""}><span class="switch-track"></span></span>
              </label>
            </div>
          </div>
          <aside class="catalog-preview-card">
            <img class="catalog-preview-image" src="${escapeHtml(product.image_url)}" alt="${escapeHtml(
              product.image_alt || product.name
            )}" data-image-preview>
            <div class="catalog-preview-meta">
              <strong>Current website preview</strong>
              <span>${escapeHtml(window.formatKSh(product.current_price))}</span>
              <span>${escapeHtml(product.product_key)}</span>
            </div>
            <div class="field"><label>Upload new product image</label><input type="file" accept="image/*" data-image-file></div>
            <div class="inline-actions"><button class="btn btn-secondary btn-sm" type="button" data-upload-image>Upload selected image to R2</button></div>
            ${discountSummary(product)}
          </aside>
        </div>
        <div class="inline-actions">
          <button class="btn btn-secondary" type="button" data-modal-close>Cancel</button>
          <button class="btn btn-primary" type="submit" data-save-product>Save Product</button>
        </div>
      </form>
    `;
  };

  const discountModalBody = (detail) => {
    const product = detail.product;
    const currentDiscount =
      (detail.discounts || []).find((discount) => ["scheduled", "active"].includes(discount.status)) ||
      null;
    const startDefault = currentDiscount
      ? toLocalDateTimeInput(currentDiscount.start_datetime)
      : toLocalDateTimeInput(new Date(Date.now() + 5 * 60000).toISOString());
    const endDefault = currentDiscount
      ? toLocalDateTimeInput(currentDiscount.end_datetime)
      : toLocalDateTimeInput(new Date(Date.now() + 7 * 86400000).toISOString());
    return `
      <form class="catalog-form" data-discount-form>
        <input type="hidden" name="product_id" value="${escapeHtml(product.id)}">
        <div class="modal-split">
          <div class="catalog-form-grid" data-columns="2">
            <div class="field"><label>Base price</label><input type="text" value="${escapeHtml(window.formatKSh(product.base_price))}" readonly></div>
            <div class="field"><label>Current website price</label><input type="text" value="${escapeHtml(window.formatKSh(product.current_price))}" readonly></div>
            <div class="field"><label>Discount percentage</label><input name="percentage" type="number" min="1" max="99" step="0.1" value="${escapeHtml(currentDiscount?.percentage || "")}" data-discount-percentage required></div>
            <div class="field"><label>Discount label</label><input name="label" type="text" maxlength="80" value="${escapeHtml(currentDiscount?.label || "")}" placeholder="OFF"></div>
            <div class="field"><label>Start date & time</label><input name="start_datetime" type="datetime-local" value="${escapeHtml(startDefault)}" required></div>
            <div class="field"><label>End date & time</label><input name="end_datetime" type="datetime-local" value="${escapeHtml(endDefault)}" required></div>
            <div class="field catalog-form-span">
              <div class="discount-preview" data-discount-preview>
                <strong>Live price preview</strong>
                <span class="discount-preview-amount">${escapeHtml(window.formatKSh(product.base_price))}</span>
                <span class="discount-preview-meta">Enter a percentage to preview the discounted price.</span>
              </div>
            </div>
          </div>
          <aside class="catalog-form-grid">
            <div class="campaign-card">
              <strong>${currentDiscount ? "Current campaign" : "No campaign scheduled"}</strong>
              <span>${
                currentDiscount
                  ? `${escapeHtml(currentDiscount.status)} · ${escapeHtml(currentDiscount.percentage)}% off`
                  : "The website is currently showing the base price only."
              }</span>
            </div>
            <div class="campaign-card">
              <strong>Behavior</strong>
              <span>Scheduled discounts show as Coming Soon.</span>
              <span>Active discounts show the old price, new price, and a countdown timer.</span>
              <span>Worker cron expires the campaign automatically every minute.</span>
            </div>
          </aside>
        </div>
        <div class="inline-actions">
          ${
            currentDiscount && ["scheduled", "active"].includes(currentDiscount.status)
              ? `<button class="btn btn-danger" type="button" data-remove-discount="${escapeHtml(currentDiscount.id)}">Remove Current Discount</button>`
              : ""
          }
          <button class="btn btn-secondary" type="button" data-modal-close>Cancel</button>
          <button class="btn btn-primary" type="submit" data-save-discount>Create / Replace Discount</button>
        </div>
      </form>
    `;
  };

  const collectBenefits = (panel) =>
    window
      .$$("[data-benefit-input]", panel)
      .map((input) => input.value.trim())
      .filter(Boolean);

  const openProductModal = async (productId) => {
    try {
      const detail = await window.GET(`/api/products/${productId}`);
      const modal = window.openModal({
        title: `Edit ${detail.product.name}`,
        size: "xl",
        body: editModalBody(detail),
      });
      const { panel } = modal;
      const form = panel.querySelector("[data-product-form]");
      const benefitsList = panel.querySelector("[data-benefits-list]");
      const imageUrlInput = panel.querySelector("[data-image-url]");
      const imagePreview = panel.querySelector("[data-image-preview]");
      const imageFileInput = panel.querySelector("[data-image-file]");
      const uploadButton = panel.querySelector("[data-upload-image]");

      panel.addEventListener("click", async (event) => {
        const addButton = event.target.closest("[data-add-benefit]");
        if (addButton) {
          const rows = window.$$("[data-benefit-input]", benefitsList);
          if (rows.length >= 10) return window.showToast("Benefits are capped at 10 points.", "warning");
          const row = document.createElement("div");
          row.className = "benefit-row";
          row.innerHTML = `<input type="text" data-benefit-input maxlength="220" placeholder="Benefit ${
            rows.length + 1
          }"><button class="btn btn-ghost btn-sm" type="button" data-remove-benefit>Remove</button>`;
          benefitsList.appendChild(row);
          return;
        }

        const removeButton = event.target.closest("[data-remove-benefit]");
        if (removeButton) {
          const rows = window.$$("[data-benefit-input]", benefitsList);
          if (rows.length <= 3) return window.showToast("Keep at least 3 benefits on every product.", "warning");
          removeButton.closest(".benefit-row")?.remove();
          return;
        }

        const uploadAction = event.target.closest("[data-upload-image]");
        if (!uploadAction) return;
        const file = imageFileInput.files?.[0];
        if (!file) return window.showToast("Choose an image file first.", "warning");
        const body = new FormData();
        body.append("image", file);
        body.append("product_id", String(detail.product.id));
        body.append("product_key", detail.product.product_key);
        try {
          window.setButtonLoading(uploadButton, true, "Uploading...");
          const response = await window.POST("/api/products/upload-image", body);
          imageUrlInput.value = response.image_url || "";
          imagePreview.src = previewImageUrl(imageUrlInput.value);
          window.showToast("Image uploaded to R2.", "success");
        } catch (error) {
          window.showToast(error.message || "Image upload failed.", "error");
        } finally {
          window.setButtonLoading(uploadButton, false);
        }
      });

      imageUrlInput.addEventListener("input", () => {
        const nextUrl = previewImageUrl(imageUrlInput.value);
        if (nextUrl) imagePreview.src = nextUrl;
      });

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const saveButton = panel.querySelector("[data-save-product]");
        const benefits = collectBenefits(panel);
        if (benefits.length < 3 || benefits.length > 10) {
          return window.showToast("Each product needs between 3 and 10 benefits.", "warning");
        }

        const payload = {
          id: Number(form.elements.id.value),
          name: form.elements.name.value.trim(),
          tagline: form.elements.tagline.value.trim(),
          short_description: form.elements.short_description.value.trim(),
          extended_description: form.elements.extended_description.value,
          benefits,
          base_price: Number(form.elements.base_price.value),
          image_url: form.elements.image_url.value.trim(),
          image_alt: form.elements.image_alt.value.trim(),
          tier: form.elements.tier.value,
          warranty_text: form.elements.warranty_text.value.trim(),
          display_order: Number(form.elements.display_order.value),
          is_active: form.elements.is_active.checked,
        };

        try {
          window.setButtonLoading(saveButton, true, "Saving...");
          await window.POST("/api/products/update", payload);
          window.closeModal();
          window.showToast("Product saved successfully.", "success");
          await loadProducts({ silent: true });
        } catch (error) {
          window.showToast(error.message || "Product save failed.", "error");
        } finally {
          window.setButtonLoading(saveButton, false);
        }
      });
    } catch (error) {
      window.showToast(error.message || "Could not load product detail.", "error");
    }
  };

  const openDiscountModal = async (productId) => {
    try {
      const detail = await window.GET(`/api/products/${productId}`);
      const modal = window.openModal({
        title: `Manage Discount · ${detail.product.name}`,
        size: "wide",
        body: discountModalBody(detail),
      });
      const { panel } = modal;
      const form = panel.querySelector("[data-discount-form]");
      const percentageInput = panel.querySelector("[data-discount-percentage]");
      const preview = panel.querySelector("[data-discount-preview]");

      const updatePreview = () => {
        const percentage = Number(percentageInput.value || 0);
        const hasValue = Number.isFinite(percentage) && percentage > 0;
        const discounted = hasValue
          ? Math.round(detail.product.base_price * (1 - percentage / 100))
          : detail.product.base_price;
        preview.innerHTML = `<strong>Live price preview</strong><span class="discount-preview-amount">${escapeHtml(
          window.formatKSh(discounted)
        )}</span><span class="discount-preview-meta">${
          hasValue
            ? `${escapeHtml(String(percentage))}% off from ${escapeHtml(window.formatKSh(detail.product.base_price))}`
            : "Enter a percentage to preview the discounted price."
        }</span>`;
      };

      updatePreview();
      percentageInput.addEventListener("input", updatePreview);

      panel.addEventListener("click", (event) => {
        const removeButton = event.target.closest("[data-remove-discount]");
        if (!removeButton) return;
        const discountId = Number(removeButton.dataset.removeDiscount);
        window.confirmAction("Remove the current discount from this product?", async () => {
          try {
            await window.POST("/api/discounts/remove", {
              discount_id: discountId,
              product_id: detail.product.id,
            });
            window.showToast("Discount removed.", "success");
            await loadProducts({ silent: true });
          } catch (error) {
            window.showToast(error.message || "Discount removal failed.", "error");
          }
        });
      });

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const saveButton = panel.querySelector("[data-save-discount]");
        const payload = {
          product_id: Number(form.elements.product_id.value),
          percentage: Number(form.elements.percentage.value),
          label: form.elements.label.value.trim(),
          start_datetime: toIsoDateTime(form.elements.start_datetime.value),
          end_datetime: toIsoDateTime(form.elements.end_datetime.value),
        };

        try {
          window.setButtonLoading(saveButton, true, "Scheduling...");
          await window.POST("/api/discounts/create", payload);
          window.closeModal();
          window.showToast("Discount campaign saved.", "success");
          await loadProducts({ silent: true });
        } catch (error) {
          window.showToast(error.message || "Discount save failed.", "error");
        } finally {
          window.setButtonLoading(saveButton, false);
        }
      });
    } catch (error) {
      window.showToast(error.message || "Could not load discount detail.", "error");
    }
  };

  const bindPageEvents = () => {
    window.$$("[data-refresh-products]", host).forEach((button) => {
      button.addEventListener("click", () => loadProducts());
    });
    window.$$("[data-edit-product]", host).forEach((button) => {
      button.addEventListener("click", () => openProductModal(Number(button.dataset.editProduct)));
    });
    window.$$("[data-manage-discount]", host).forEach((button) => {
      button.addEventListener("click", () => openDiscountModal(Number(button.dataset.manageDiscount)));
    });
  };

  renderShell();
  loadProducts();
})(window, document);
