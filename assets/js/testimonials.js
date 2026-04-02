(function initTestimonialsPage(window, document) {
  if (document.body?.dataset.page !== "testimonials") {
    return;
  }

  const API_BASE = "https://mktintworks-cms-api.mktintworks.workers.dev";
  const initialState =
    window.CMS_TESTIMONIALS_STATE &&
    Array.isArray(window.CMS_TESTIMONIALS_STATE.testimonials)
      ? window.CMS_TESTIMONIALS_STATE
      : { testimonials: [], generated_at: null };

  const serviceLabels = {
    automotive: "Automotive Tinting",
    residential: "Residential Tinting",
    commercial: "Commercial Tinting",
  };
  const fieldErrorIds = {
    client_name: "name-error",
    service_type: "service-error",
    rating: "rating-error",
    review_text: "review-error",
  };

  const escapeHtml = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const formatService = (value) =>
    serviceLabels[String(value || "").trim().toLowerCase()] || "Tinting Service";

  const formatDate = (value) => {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) {
      return "";
    }

    return new Intl.DateTimeFormat("en-KE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  };

  const normalizeTestimonial = (item, index = 0) => ({
    id: Number(item?.id || index + 1),
    client_name: String(item?.client_name || "").trim(),
    service_type: String(item?.service_type || "").trim().toLowerCase(),
    rating: Math.max(1, Math.min(5, Number(item?.rating || 0) || 0)),
    review_text: String(item?.review_text || "").trim(),
    approved_at: item?.approved_at || null,
    display_order: Number(item?.display_order || index),
  });

  const getFieldContainer = (fieldName) =>
    document.querySelector(`.form-field[data-field="${fieldName}"]`);

  const showFieldError = (fieldName, message) => {
    const container = getFieldContainer(fieldName);
    const errorNode = document.getElementById(fieldErrorIds[fieldName] || "");

    if (container) {
      container.classList.add("has-error");
    }

    if (errorNode) {
      errorNode.textContent = message;
    }
  };

  const clearFieldError = (fieldName) => {
    const container = getFieldContainer(fieldName);
    const errorNode = document.getElementById(fieldErrorIds[fieldName] || "");

    if (container) {
      container.classList.remove("has-error");
    }

    if (errorNode) {
      errorNode.textContent = "";
    }
  };

  const clearAllErrors = () => {
    ["client_name", "service_type", "rating", "review_text"].forEach(clearFieldError);
  };

  const setStatus = (type, title, detail = "") => {
    const node = document.getElementById("review-status");
    if (!node) {
      return;
    }

    node.className = `form-status is-visible is-${type}`;
    node.innerHTML = detail
      ? `<strong>${escapeHtml(title)}</strong><br>${escapeHtml(detail)}`
      : `<strong>${escapeHtml(title)}</strong>`;
  };

  const clearStatus = () => {
    const node = document.getElementById("review-status");
    if (!node) {
      return;
    }

    node.className = "form-status";
    node.textContent = "";
  };

  const updateCounter = () => {
    const textarea = document.getElementById("review-text");
    const counter = document.getElementById("review-counter");
    if (!textarea || !counter) {
      return;
    }

    counter.textContent = `${textarea.value.length} / 1000`;
  };

  const renderTestimonials = (items) => {
    const host = document.getElementById("approved-testimonials");
    if (!host) {
      return;
    }

    if (!Array.isArray(items) || items.length === 0) {
      host.innerHTML = `
        <article class="testimonial-card glass-card testimonial-empty">
          <p>Client reviews will appear here as soon as they are approved in the CMS.</p>
        </article>
      `;
      window.MKT_CMS_PREPARE_PAGE?.();
      return;
    }

    host.innerHTML = items
      .slice()
      .sort((left, right) => left.display_order - right.display_order)
      .map(
        (item) => `
          <article class="testimonial-card glass-card">
            <div class="quote-mark" aria-hidden="true">“</div>
            <p class="testimonial-copy">${escapeHtml(item.review_text)}</p>
            <div class="stars" aria-label="${item.rating} out of 5 stars">${"★".repeat(
              item.rating
            )}${"☆".repeat(5 - item.rating)}</div>
            <div class="testimonial-meta">
              <strong>${escapeHtml(item.client_name)}</strong>
              <span class="testimonial-service-badge">${escapeHtml(
                formatService(item.service_type)
              )}</span>
              ${
                item.approved_at
                  ? `<span>Approved ${escapeHtml(formatDate(item.approved_at))}</span>`
                  : ""
              }
            </div>
          </article>
        `
      )
      .join("");

    window.MKT_CMS_PREPARE_PAGE?.();
  };

  const fetchLatestTestimonials = async () => {
    const url = new URL(`${API_BASE}/api/testimonials/public`);
    url.searchParams.set("_ts", String(Date.now()));

    const response = await fetch(url, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Testimonials refresh failed: ${response.status}`);
    }

    const payload = await response.json();
    return Array.isArray(payload?.testimonials)
      ? payload.testimonials.map(normalizeTestimonial)
      : [];
  };

  const bindForm = () => {
    const form = document.getElementById("review-form");
    const submitButton = document.getElementById("submit-review-btn");
    const textarea = document.getElementById("review-text");

    if (!form || !submitButton || !textarea) {
      return;
    }

    updateCounter();

    textarea.addEventListener("input", () => {
      updateCounter();
      clearFieldError("review_text");
    });

    document.getElementById("reviewer-name")?.addEventListener("input", () => {
      clearFieldError("client_name");
    });

    document.getElementById("service-type")?.addEventListener("change", () => {
      clearFieldError("service_type");
    });

    form.querySelectorAll('input[name="rating"]').forEach((input) => {
      input.addEventListener("change", () => {
        clearFieldError("rating");
      });
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearAllErrors();
      clearStatus();

      const honeypotValue = document.getElementById("hp-website")?.value || "";
      if (honeypotValue.trim() !== "") {
        form.reset();
        updateCounter();
        setStatus(
          "success",
          "Thank you for your review.",
          "It will appear on our website after a brief review period."
        );
        return;
      }

      const clientName =
        document.getElementById("reviewer-name")?.value.trim() || "";
      const serviceType =
        document.getElementById("service-type")?.value.trim() || "";
      const rating = form.querySelector('input[name="rating"]:checked')?.value || "";
      const reviewText = textarea.value.trim();

      let hasErrors = false;

      if (!clientName) {
        showFieldError("client_name", "Please enter your name.");
        hasErrors = true;
      }

      if (!serviceType) {
        showFieldError("service_type", "Please select a service.");
        hasErrors = true;
      }

      if (!rating) {
        showFieldError("rating", "Please select a star rating.");
        hasErrors = true;
      }

      if (reviewText.length < 20) {
        showFieldError("review_text", "Review must be at least 20 characters.");
        hasErrors = true;
      }

      if (hasErrors) {
        setStatus("error", "Please correct the highlighted fields and try again.");
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = "Submitting...";

      try {
        const response = await fetch(`${API_BASE}/api/testimonials/submit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_name: clientName,
            service_type: serviceType,
            rating: Number(rating),
            review_text: reviewText,
            website: honeypotValue,
          }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || "Submission failed.");
        }

        form.reset();
        updateCounter();
        setStatus(
          "success",
          "Thank you for your review.",
          payload?.message ||
            "It will appear on our website after a brief review period."
        );
      } catch (error) {
        setStatus(
          "error",
          "Something went wrong.",
          error?.message || "Please try again or contact us directly."
        );
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Submit Review";
      }
    });
  };

  const boot = async () => {
    renderTestimonials(initialState.testimonials.map(normalizeTestimonial));
    bindForm();

    try {
      const latest = await fetchLatestTestimonials();
      window.CMS_TESTIMONIALS_STATE = {
        testimonials: latest,
        generated_at: new Date().toISOString(),
      };
      renderTestimonials(latest);
    } catch {
      // Keep the injected build state or static fallback in place.
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})(window, document);
