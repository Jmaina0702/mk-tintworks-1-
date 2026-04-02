(function initGallery(window, document) {
  const API_BASE = "https://mktintworks-cms-api.mktintworks.workers.dev";
  const initialState =
    window.CMS_GALLERY_STATE && Array.isArray(window.CMS_GALLERY_STATE.images)
      ? window.CMS_GALLERY_STATE
      : { images: [] };

  let galleryCleanup = null;

  const escapeHtml = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const normalizeImage = (image, index = 0) => ({
    id: Number(image?.id || index + 1),
    image_url: String(image?.image_url || "").trim(),
    thumbnail_url: String(image?.thumbnail_url || image?.image_url || "").trim(),
    caption: String(image?.caption || "").trim(),
    category: String(image?.category || "automotive").trim().toLowerCase(),
    alt_text: String(image?.alt_text || image?.caption || "").trim(),
    display_order: Number(image?.display_order || index),
    is_placeholder: Number(image?.is_placeholder || 0) === 1,
  });

  const parseFallbackItems = () =>
    Array.from(document.querySelectorAll("#gallery-grid .gallery-item")).map(
      (item, index) =>
        normalizeImage(
          {
            id: item.dataset.id || index + 1,
            image_url: item.querySelector("img")?.getAttribute("src") || "",
            thumbnail_url: item.querySelector("img")?.getAttribute("src") || "",
            caption:
              item.dataset.caption ||
              item.querySelector(".gallery-caption")?.textContent ||
              "",
            category: item.dataset.category || "automotive",
            alt_text: item.querySelector("img")?.getAttribute("alt") || "",
            display_order: index,
          },
          index
        )
    );

  const renderItems = (images) => {
    const grid = document.getElementById("gallery-grid");
    if (!grid) {
      return;
    }

    if (!Array.isArray(images) || images.length === 0) {
      grid.innerHTML = `
        <div class="gallery-empty-state">
          Portfolio images will appear here as soon as the gallery library is populated.
        </div>
      `;
      return;
    }

    grid.innerHTML = images
      .slice()
      .sort((left, right) => left.display_order - right.display_order)
      .map(
        (image) => `
          <figure
            class="gallery-item"
            data-id="${image.id}"
            data-category="${escapeHtml(image.category)}"
            data-caption="${escapeHtml(image.caption || image.alt_text)}"
          >
            <img
              src="${escapeHtml(image.thumbnail_url || image.image_url)}"
              data-full-src="${escapeHtml(image.image_url)}"
              alt="${escapeHtml(image.alt_text || image.caption || "MK Tintworks gallery image")}"
              loading="lazy"
              decoding="async"
              width="600"
              height="450"
              data-cms-key="gallery:item_${image.id}_image"
              data-cms-type="image"
            >
            <figcaption class="gallery-caption" data-cms-key="gallery:item_${image.id}_caption" data-cms-type="text">
              ${escapeHtml(image.caption || image.alt_text || "MK Tintworks installation image")}
            </figcaption>
          </figure>
        `
      )
      .join("");
  };

  const bindInteractions = () => {
    galleryCleanup?.();

    const galleryItems = Array.from(document.querySelectorAll(".gallery-item"));
    const galleryButtons = Array.from(document.querySelectorAll(".filter-btn"));
    const lightbox = document.getElementById("lightbox");

    if (!galleryItems.length || !lightbox) {
      galleryCleanup = null;
      return;
    }

    const lightboxImage = lightbox.querySelector(".lb-img");
    const lightboxCaption = lightbox.querySelector(".lb-caption");
    const lightboxClose = lightbox.querySelector(".lb-close");
    const lightboxPrev = lightbox.querySelector(".lb-prev");
    const lightboxNext = lightbox.querySelector(".lb-next");
    let activeItems = [...galleryItems];
    let currentIndex = 0;

    const getVisibleItems = () =>
      galleryItems.filter((item) => !item.classList.contains("is-hidden"));

    const applyFilter = (filter) => {
      galleryButtons.forEach((button) => {
        button.classList.toggle("active", button.dataset.filter === filter);
      });

      galleryItems.forEach((item) => {
        const show = filter === "all" || item.dataset.category === filter;
        item.classList.toggle("is-hidden", !show);
      });
    };

    const openLightbox = (index) => {
      activeItems = getVisibleItems();
      currentIndex = index;
      const item = activeItems[currentIndex];
      if (!item || !lightboxImage) {
        return;
      }

      const image = item.querySelector("img");
      lightboxImage.src =
        image?.dataset.fullSrc || image?.getAttribute("src") || "";
      lightboxImage.alt = image?.getAttribute("alt") || "";
      if (lightboxCaption) {
        lightboxCaption.textContent =
          item.dataset.caption || image?.getAttribute("alt") || "";
      }

      lightbox.removeAttribute("hidden");
      document.body.style.overflow = "hidden";
      lightboxClose?.focus();
    };

    const closeLightbox = () => {
      lightbox.setAttribute("hidden", "");
      document.body.style.overflow = "";
    };

    const move = (direction) => {
      activeItems = getVisibleItems();
      if (!activeItems.length) {
        return;
      }

      currentIndex =
        (currentIndex + direction + activeItems.length) % activeItems.length;
      openLightbox(currentIndex);
    };

    const itemHandlers = galleryItems.map((item) => {
      const clickHandler = () => {
        const visibleIndex = getVisibleItems().indexOf(item);
        if (visibleIndex >= 0) {
          openLightbox(visibleIndex);
        }
      };

      const keyHandler = (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          const visibleIndex = getVisibleItems().indexOf(item);
          if (visibleIndex >= 0) {
            openLightbox(visibleIndex);
          }
        }
      };

      item.setAttribute("tabindex", "0");
      item.addEventListener("click", clickHandler);
      item.addEventListener("keydown", keyHandler);
      return { item, clickHandler, keyHandler };
    });

    const buttonHandlers = galleryButtons.map((button) => {
      const handler = () => applyFilter(button.dataset.filter || "all");
      button.addEventListener("click", handler);
      return { button, handler };
    });

    const closeHandler = () => closeLightbox();
    const prevHandler = () => move(-1);
    const nextHandler = () => move(1);
    const overlayHandler = (event) => {
      if (event.target === lightbox) {
        closeLightbox();
      }
    };
    const keydownHandler = (event) => {
      if (lightbox.hasAttribute("hidden")) {
        return;
      }

      if (event.key === "Escape") {
        closeLightbox();
      }
      if (event.key === "ArrowLeft") {
        move(-1);
      }
      if (event.key === "ArrowRight") {
        move(1);
      }
    };

    lightboxClose?.addEventListener("click", closeHandler);
    lightboxPrev?.addEventListener("click", prevHandler);
    lightboxNext?.addEventListener("click", nextHandler);
    lightbox.addEventListener("click", overlayHandler);
    document.addEventListener("keydown", keydownHandler);

    const defaultFilter =
      galleryButtons.find((button) => button.classList.contains("active"))
        ?.dataset.filter || "all";
    applyFilter(defaultFilter);

    galleryCleanup = () => {
      itemHandlers.forEach(({ item, clickHandler, keyHandler }) => {
        item.removeEventListener("click", clickHandler);
        item.removeEventListener("keydown", keyHandler);
      });
      buttonHandlers.forEach(({ button, handler }) => {
        button.removeEventListener("click", handler);
      });
      lightboxClose?.removeEventListener("click", closeHandler);
      lightboxPrev?.removeEventListener("click", prevHandler);
      lightboxNext?.removeEventListener("click", nextHandler);
      lightbox.removeEventListener("click", overlayHandler);
      document.removeEventListener("keydown", keydownHandler);
    };
  };

  const fetchLatest = async () => {
    const url = new URL(`${API_BASE}/api/gallery/public`);
    url.searchParams.set("_ts", String(Date.now()));
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Gallery refresh failed: ${response.status}`);
    }

    const payload = await response.json();
    return Array.isArray(payload.images)
      ? payload.images.map(normalizeImage)
      : [];
  };

  const boot = async () => {
    const fallbackItems = parseFallbackItems();
    const initialItems = Array.isArray(initialState.images)
      ? initialState.images.map(normalizeImage)
      : [];

    if (initialItems.length > 0) {
      renderItems(initialItems);
    }

    bindInteractions();

    try {
      const latest = await fetchLatest();
      if (latest.length > 0) {
        window.CMS_GALLERY_STATE = { images: latest };
        renderItems(latest);
        bindInteractions();
        window.MKT_CMS_PREPARE_PAGE?.();
      } else if (!initialItems.length && !fallbackItems.length) {
        renderItems([]);
        bindInteractions();
      }
    } catch {
      if (!initialItems.length && fallbackItems.length) {
        renderItems(fallbackItems);
        bindInteractions();
      }
    }
  };

  window.MKGallery = { init: boot };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})(window, document);
