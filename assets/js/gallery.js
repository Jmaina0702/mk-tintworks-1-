let galleryCleanup = null;

const initGallery = () => {
  galleryCleanup?.();

  const galleryItems = Array.from(document.querySelectorAll(".gallery-item"));
  const galleryButtons = document.querySelectorAll(".filter-btn");
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

  const getVisibleItems = () => galleryItems.filter((item) => !item.classList.contains("is-hidden"));

  const openLightbox = (index) => {
    activeItems = getVisibleItems();
    currentIndex = index;
    const item = activeItems[currentIndex];
    if (!item || !lightboxImage) return;

    const image = item.querySelector("img");
    lightboxImage.src = image?.src ?? "";
    lightboxImage.alt = image?.alt ?? "";
    if (lightboxCaption) {
      lightboxCaption.textContent = item.dataset.caption ?? image?.alt ?? "";
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
    if (!activeItems.length) return;
    currentIndex = (currentIndex + direction + activeItems.length) % activeItems.length;
    openLightbox(currentIndex);
  };

  const itemClickHandlers = galleryItems.map((item) => {
    const clickHandler = () => {
      const visibleIndex = getVisibleItems().indexOf(item);
      if (visibleIndex >= 0) openLightbox(visibleIndex);
    };

    const keyHandler = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const visibleIndex = getVisibleItems().indexOf(item);
        if (visibleIndex >= 0) openLightbox(visibleIndex);
      }
    };

    item.setAttribute("tabindex", "0");
    item.addEventListener("click", clickHandler);
    item.addEventListener("keydown", keyHandler);
    return { item, clickHandler, keyHandler };
  });

  const buttonHandlers = Array.from(galleryButtons).map((button) => {
    const handler = () => {
      const filter = button.dataset.filter ?? "all";
      galleryButtons.forEach((item) => item.classList.toggle("active", item === button));

      galleryItems.forEach((item) => {
        const show = filter === "all" || item.dataset.category === filter;
        item.classList.toggle("is-hidden", !show);
      });
    };

    button.addEventListener("click", handler);
    return { button, handler };
  });

  const closeHandler = () => closeLightbox();
  const prevHandler = () => move(-1);
  const nextHandler = () => move(1);
  const overlayHandler = (event) => {
    if (event.target === lightbox) closeLightbox();
  };
  const keydownHandler = (event) => {
    if (lightbox.hasAttribute("hidden")) return;
    if (event.key === "Escape") closeLightbox();
    if (event.key === "ArrowLeft") move(-1);
    if (event.key === "ArrowRight") move(1);
  };

  lightboxClose?.addEventListener("click", closeHandler);
  lightboxPrev?.addEventListener("click", prevHandler);
  lightboxNext?.addEventListener("click", nextHandler);
  lightbox.addEventListener("click", overlayHandler);
  document.addEventListener("keydown", keydownHandler);

  galleryCleanup = () => {
    itemClickHandlers.forEach(({ item, clickHandler, keyHandler }) => {
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

window.MKGallery = { init: initGallery };
initGallery();
