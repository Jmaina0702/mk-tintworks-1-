(function mountAuthGateway(window, document) {
  const nextParam = new URLSearchParams(window.location.search).get("next");
  const nextUrl = nextParam || "/dashboard.html";
  const statusNode = document.getElementById("auth-status");
  const detailNode = document.getElementById("auth-detail");
  const actionNode = document.getElementById("auth-action");

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

  const redirectToNext = () => {
    window.location.assign(nextUrl);
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
      setState(
        "Access verification failed",
        error.message ||
          "Cloudflare Access did not attach the admin assertion to this request.",
        "primary"
      );
      window.showToast(
        "Cloudflare Access is required before the CMS can issue a JWT.",
        "warning"
      );
    }
  };

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
