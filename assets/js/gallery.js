const galleryItems = Array.from(document.querySelectorAll(".gallery-item"));
const galleryButtons = document.querySelectorAll(".filter-btn");
const lightbox = document.getElementById("lightbox");

if (galleryItems.length && lightbox) {
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

  galleryItems.forEach((item) => {
    item.setAttribute("tabindex", "0");
    item.addEventListener("click", () => {
      const visibleIndex = getVisibleItems().indexOf(item);
      if (visibleIndex >= 0) openLightbox(visibleIndex);
    });
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const visibleIndex = getVisibleItems().indexOf(item);
        if (visibleIndex >= 0) openLightbox(visibleIndex);
      }
    });
  });

  lightboxClose?.addEventListener("click", closeLightbox);
  lightboxPrev?.addEventListener("click", () => move(-1));
  lightboxNext?.addEventListener("click", () => move(1));

  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) closeLightbox();
  });

  document.addEventListener("keydown", (event) => {
    if (lightbox.hasAttribute("hidden")) return;
    if (event.key === "Escape") closeLightbox();
    if (event.key === "ArrowLeft") move(-1);
    if (event.key === "ArrowRight") move(1);
  });

  galleryButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter ?? "all";
      galleryButtons.forEach((item) => item.classList.toggle("active", item === button));

      galleryItems.forEach((item) => {
        const show = filter === "all" || item.dataset.category === filter;
        item.classList.toggle("is-hidden", !show);
      });
    });
  });
}
