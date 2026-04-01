(function bootstrapCmsUtils(window, document) {
  const formatterWhole = new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  });

  const formatterDecimal = new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const dateFormatter = new Intl.DateTimeFormat("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const dateTimeFormatter = new Intl.DateTimeFormat("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const relativeFormatter = new Intl.RelativeTimeFormat("en", {
    numeric: "auto",
  });

  const escapeHtml = (value) =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const normalizeDate = (value) => {
    if (!value) {
      return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const statusToneMap = {
    active: "success",
    approved: "success",
    published: "success",
    sent: "success",
    live: "success",
    queued: "warning",
    pending: "warning",
    draft: "warning",
    review: "warning",
    archived: "neutral",
    idle: "neutral",
    paused: "danger",
    expired: "danger",
    rejected: "danger",
    blocked: "danger",
  };

  const tierToneMap = {
    premium: "gold",
    high: "info",
    mid: "neutral",
    entry: "warning",
    standard: "neutral",
    elite: "gold",
    ceramic: "info",
    essential: "warning",
    economy: "warning",
    specialty: "gold",
  };

  window.$ = (selector, scope = document) => scope.querySelector(selector);
  window.$$ = (selector, scope = document) =>
    Array.from(scope.querySelectorAll(selector));

  window.formatKSh = (value) => formatterWhole.format(Number(value || 0));
  window.formatKShDecimal = (value) =>
    formatterDecimal.format(Number(value || 0));

  window.formatDate = (value) => {
    const date = normalizeDate(value);
    return date ? dateFormatter.format(date) : "—";
  };

  window.formatDateTime = (value) => {
    const date = normalizeDate(value);
    return date ? dateTimeFormatter.format(date) : "—";
  };

  window.formatRelativeTime = (value) => {
    const date = normalizeDate(value);
    if (!date) {
      return "—";
    }

    const diffMs = date.getTime() - Date.now();
    const diffMinutes = Math.round(diffMs / 60000);

    if (Math.abs(diffMinutes) < 60) {
      return relativeFormatter.format(diffMinutes, "minute");
    }

    const diffHours = Math.round(diffMinutes / 60);
    if (Math.abs(diffHours) < 24) {
      return relativeFormatter.format(diffHours, "hour");
    }

    const diffDays = Math.round(diffHours / 24);
    return relativeFormatter.format(diffDays, "day");
  };

  window.formatFileSize = (bytes) => {
    const value = Number(bytes || 0);
    if (value < 1024) {
      return `${value} B`;
    }

    if (value < 1024 * 1024) {
      return `${(value / 1024).toFixed(1)} KB`;
    }

    if (value < 1024 * 1024 * 1024) {
      return `${(value / (1024 * 1024)).toFixed(1)} MB`;
    }

    return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  window.renderStars = (value) => {
    const score = Math.max(0, Math.min(5, Number(value || 0)));
    const fullStars = Math.round(score);
    return `<span aria-label="${score} out of 5 stars">${"★".repeat(
      fullStars
    )}<span class="muted">${"☆".repeat(5 - fullStars)}</span></span>`;
  };

  window.setButtonLoading = (button, isLoading, loadingLabel = "Working...") => {
    if (!button) {
      return;
    }

    if (!button.dataset.originalLabel) {
      button.dataset.originalLabel = button.textContent || "";
    }

    button.classList.toggle("is-loading", Boolean(isLoading));
    button.disabled = Boolean(isLoading);
    button.textContent = isLoading
      ? loadingLabel
      : button.dataset.originalLabel || "";
  };

  window.debounce = (fn, wait = 200) => {
    let timer = null;

    return (...args) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => fn(...args), wait);
    };
  };

  window.compressImage = (file, targetKb = 200, maxSide = 1920) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);

      image.onload = () => {
        URL.revokeObjectURL(objectUrl);

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

        const targetBytes = Math.max(1, Number(targetKb || 0)) * 1024;
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

      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Failed to load image"));
      };
      image.src = objectUrl;
    });

  window.statusBadge = (status) => {
    const key = String(status || "neutral").toLowerCase();
    const tone = statusToneMap[key] || "neutral";
    return `<span class="badge badge-${tone}">${escapeHtml(status || "Unknown")}</span>`;
  };

  window.tierBadge = (tier) => {
    const key = String(tier || "standard").toLowerCase();
    const tone = tierToneMap[key] || "neutral";
    return `<span class="badge badge-${tone}">${escapeHtml(tier || "Standard")}</span>`;
  };
})(window, document);
