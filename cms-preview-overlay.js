(function initCMSOverlay() {
  if (!window.location.search.includes("cms_preview=true")) {
    return;
  }

  if (window.__cmsOverlayActive) {
    return;
  }
  window.__cmsOverlayActive = true;

  const allowedParentOrigins = new Set([
    "https://admin.mktintworks-cms.pages.dev",
    "https://admin.mktintworks.com",
    "https://mktintworks-cms.pages.dev",
  ]);
  const parentOrigin = (() => {
    try {
      return document.referrer ? new URL(document.referrer).origin : "*";
    } catch {
      return "*";
    }
  })();
  const targetOrigin = allowedParentOrigins.has(parentOrigin) ? parentOrigin : "*";
  const escapeSelector = (value) => {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }

    return String(value).replace(/["\\]/g, "\\$&");
  };

  const postToParent = (payload) => {
    window.parent.postMessage(payload, targetOrigin);
  };

  let selectedEl = null;

  window.addEventListener("message", (event) => {
    if (targetOrigin !== "*" && event.origin !== targetOrigin) {
      return;
    }

    if (event.data?.type !== "cms:element:update") {
      return;
    }

    const { key, cmsType, value } = event.data;
    const selector = `[data-cms-key="${escapeSelector(key)}"]`;
    const element = document.querySelector(selector);
    if (!element) {
      return;
    }

    if (cmsType === "image") {
      if (element.tagName === "IMG") {
        element.src = value;
      } else {
        element.style.backgroundImage = `url(${value})`;
      }
    } else if (cmsType === "html") {
      element.innerHTML = value;
    } else {
      element.textContent = value;
    }

    element.style.outline = "2px solid #C9A84C";
    window.setTimeout(() => {
      element.style.outline = "2px solid #7A0C1E";
    }, 800);
  });

  const activateOverlay = () => {
    if (typeof window.MKT_CMS_PREPARE_PAGE === "function") {
      window.MKT_CMS_PREPARE_PAGE();
    }

    const bar = document.createElement("div");
    bar.style.cssText = [
      "position:fixed",
      "top:0",
      "left:0",
      "right:0",
      "height:3px",
      "background:linear-gradient(90deg,#7A0C1E,#C9A84C,#7A0C1E)",
      "z-index:2147483647",
      "pointer-events:none",
    ].join(";");
    document.body.appendChild(bar);

    const deselect = () => {
      if (!selectedEl) {
        return;
      }

      selectedEl.style.outline = "";
      selectedEl.style.outlineOffset = "";
      selectedEl.classList.remove("cms-selected");
      selectedEl = null;
    };

    const bindEditables = (editables) => {
      editables.forEach((element) => {
        if (element.dataset.cmsBound === "true") {
          return;
        }

        element.dataset.cmsBound = "true";

        if (element.tagName === "A") {
          element.addEventListener("click", (event) => event.preventDefault());
        }

        element.addEventListener("mouseenter", () => {
          if (element === selectedEl) {
            return;
          }

          element.style.outline = "2px dashed rgba(122,12,30,0.6)";
          element.style.outlineOffset = "2px";
          element.style.cursor = "pointer";
        });

        element.addEventListener("mouseleave", () => {
          if (element === selectedEl) {
            return;
          }

          element.style.outline = "";
          element.style.outlineOffset = "";
          element.style.cursor = "";
        });

        element.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();

          deselect();
          selectedEl = element;
          element.style.outline = "2px solid #7A0C1E";
          element.style.outlineOffset = "2px";
          element.classList.add("cms-selected");

          let currentValue = "";
          const cmsType = element.dataset.cmsType;

          if (cmsType === "image") {
            if (element.tagName === "IMG") {
              currentValue = element.src;
            } else {
              const background = window.getComputedStyle(element).backgroundImage;
              currentValue = background
                .replace(/^url\(["']?/, "")
                .replace(/["']?\)$/, "");
            }
          } else if (cmsType === "html") {
            currentValue = element.innerHTML.trim();
          } else {
            currentValue = (element.innerText || element.textContent || "").trim();
          }

          postToParent({
            type: "cms:element:selected",
            key: element.dataset.cmsKey,
            cmsType,
            currentValue,
            tagName: element.tagName.toLowerCase(),
          });
        });
      });
    };

    const waitForEditables = (attempt = 0) => {
      if (typeof window.MKT_CMS_PREPARE_PAGE === "function") {
        window.MKT_CMS_PREPARE_PAGE();
      }

      const editables = Array.from(document.querySelectorAll("[data-cms-key]"));
      if (editables.length === 0 && attempt < 10) {
        window.setTimeout(() => waitForEditables(attempt + 1), 80);
        return;
      }

      if (editables.length === 0) {
        postToParent({ type: "cms:no_editables" });
        return;
      }

      bindEditables(editables);
      postToParent({ type: "cms:overlay:ready", count: editables.length });
    };

    waitForEditables();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", activateOverlay, { once: true });
  } else {
    activateOverlay();
  }
})();
