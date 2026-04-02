(function mountAuthGateway(window, document) {
  const canonicalCmsOrigin = String(
    window.MKT_CMS_CONFIG?.canonicalCmsOrigin ||
      "https://mktintworks-cms.pages.dev"
  ).replace(/\/$/, "");
  const preferredCustomOrigin = String(
    window.MKT_CMS_CONFIG?.preferredCustomOrigin ||
      "https://admin.mktintworks.com"
  ).replace(/\/$/, "");
  const currentOrigin = String(window.location.origin || "").replace(/\/$/, "");
  const currentHost = String(window.location.hostname || "").toLowerCase();
  const canonicalHost = new URL(canonicalCmsOrigin).hostname.toLowerCase();
  const customHost = new URL(preferredCustomOrigin).hostname.toLowerCase();
  const nextParam = new URLSearchParams(window.location.search).get("next");
  const nextUrl = nextParam || "/dashboard.html";
  const statusNode = document.getElementById("auth-status");
  const detailNode = document.getElementById("auth-detail");
  const actionNode = document.getElementById("auth-action");
  const linkNode = document.getElementById("cms-entry-link");
  const customLinkNode = document.getElementById("cms-custom-link");
  const hostHintNode = document.getElementById("auth-host-hint");

  const isPagesPreviewHost =
    currentHost.endsWith(".mktintworks-cms.pages.dev") &&
    currentHost !== canonicalHost;

  const buildEntryUrl = (origin, next) => {
    const target = new URL("/index.html", `${origin}/`);
    if (next) {
      target.searchParams.set("next", next);
    }
    return target.toString();
  };

  const redirectToCanonicalOrigin = () => {
    const target = buildEntryUrl(canonicalCmsOrigin, nextUrl);
    if (window.location.href !== target) {
      window.location.replace(target);
    }
  };

  const setState = (status, detail, variant) => {
    if (statusNode) {
      statusNode.textContent = status;
    }

    if (detailNode) {
      detailNode.textContent = detail;
    }

    if (actionNode) {
      actionNode.className = `btn btn-${variant || "primary"} btn-lg`;
    }
  };

  const renderHostHints = () => {
    if (linkNode) {
      linkNode.textContent = canonicalCmsOrigin;
      linkNode.href = canonicalCmsOrigin;
    }

    if (customLinkNode) {
      customLinkNode.textContent = preferredCustomOrigin;
      customLinkNode.href = preferredCustomOrigin;
    }

    if (!hostHintNode) {
      return;
    }

    if (currentHost === canonicalHost) {
      hostHintNode.textContent =
        "This is the live CMS Pages hostname. Protect this exact host with Cloudflare Access until the custom admin domain is attached.";
      return;
    }

    if (currentHost === customHost) {
      hostHintNode.textContent =
        "This is the intended custom admin hostname. It must be attached to the Pages project and protected by Cloudflare Access before it can serve the CMS.";
      return;
    }

    if (isPagesPreviewHost) {
      hostHintNode.textContent =
        "Preview deployment hosts are not the stable admin entry point. The CMS will redirect you to the canonical Pages hostname.";
      return;
    }

    hostHintNode.textContent =
      "Use the canonical CMS Pages hostname for now, or attach the custom admin hostname and protect it with Cloudflare Access.";
  };

  const redirectToNext = () => {
    window.location.assign(nextUrl);
  };

  const buildAccessFailureMessage = (message) => {
    const normalized = String(message || "").trim();
    const isAccessMissing =
      normalized.includes("Access denied") ||
      normalized.includes("Invalid access token");

    if (isPagesPreviewHost) {
      return `This preview host is not the stable admin entry point. Use ${canonicalCmsOrigin} instead.`;
    }

    if (currentHost === customHost && isAccessMissing) {
      return `The custom admin hostname is not attached or not protected yet. Use ${canonicalCmsOrigin} for now, or attach and protect ${preferredCustomOrigin}.`;
    }

    if (currentHost === canonicalHost && isAccessMissing) {
      return `Cloudflare Access is not active on ${canonicalHost}. Protect this exact host in Zero Trust, then retry.`;
    }

    return (
      normalized ||
      `Cloudflare Access did not attach the admin assertion to this request. Use ${canonicalCmsOrigin} and protect that exact host.`
    );
  };

  const exchange = async () => {
    setState(
      "Checking Cloudflare Access",
      "Requesting a fresh worker token for this browser session.",
      "secondary"
    );

    try {
      if (window.MKT_CMS_AUTH?.isTokenValid()) {
        redirectToNext();
        return;
      }

      const data = await window.MKT_CMS_AUTH.requestToken();
      window.MKT_CMS_AUTH.storeToken(data.token, data.expires);
      setState(
        "Access granted",
        "JWT issued successfully. Redirecting into the CMS dashboard now.",
        "success"
      );
      window.setTimeout(redirectToNext, 500);
    } catch (error) {
      const failureMessage = buildAccessFailureMessage(error.message);
      setState(
        "Access verification failed",
        failureMessage,
        "primary"
      );
      window.showToast(failureMessage, "warning", 6000);
    }
  };

  renderHostHints();

  if (isPagesPreviewHost) {
    setState(
      "Redirecting to live CMS",
      `Preview deployments are not the stable admin entry point. Redirecting to ${canonicalCmsOrigin}.`,
      "secondary"
    );
    window.setTimeout(redirectToCanonicalOrigin, 150);
    return;
  }

  actionNode?.addEventListener("click", async () => {
    const button = actionNode;
    window.setButtonLoading(button, true, "Checking...");

    try {
      await exchange();
    } finally {
      window.setButtonLoading(button, false);
    }
  });

  exchange().catch(() => {});
})(window, document);
