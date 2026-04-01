(function initWarrantyGenerator(window, document) {
  const form = document.getElementById("warranty-form");
  if (!form) {
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const prefillInvoiceId = /^\d+$/.test(urlParams.get("invoice_id") || "")
    ? urlParams.get("invoice_id")
    : "";

  const state = {
    currentPdfBlob: null,
    generatedCertNumber: "",
    prefillInvoiceId,
    prefillInvoiceNumber: "",
  };

  const elements = {
    prefillNotice: document.getElementById("prefill-notice"),
    clientName: document.getElementById("w-client-name"),
    clientPhone: document.getElementById("w-client-phone"),
    clientEmail: document.getElementById("w-client-email"),
    vehicleMake: document.getElementById("w-vehicle-make"),
    vehicleModel: document.getElementById("w-vehicle-model"),
    vehicleReg: document.getElementById("w-vehicle-reg"),
    filmInstalled: document.getElementById("w-film"),
    installDate: document.getElementById("w-install-date"),
    invoiceRef: document.getElementById("w-invoice-ref"),
    issueDate: document.getElementById("w-issue-date"),
    warrantyPeriod: document.getElementById("w-period"),
    covered: document.getElementById("w-covered"),
    notCovered: document.getElementById("w-not-covered"),
    notes: document.getElementById("w-notes"),
    certNumberDisplay: document.getElementById("cert-number-display"),
    generateButton: document.getElementById("generate-warranty-btn"),
    status: document.getElementById("warranty-status"),
    sendOptions: document.getElementById("warranty-send-options"),
    sendWhatsapp: document.getElementById("w-send-wa"),
    sendEmail: document.getElementById("w-send-email"),
    download: document.getElementById("w-download"),
  };

  const todayValue = () => new Date().toISOString().split("T")[0];

  const setStatus = (message, tone = "info") => {
    if (!elements.status) {
      return;
    }

    elements.status.textContent = message || "";
    elements.status.dataset.tone = tone;
  };

  const setCertificateDisplay = (value) => {
    elements.certNumberDisplay.textContent = value || "Auto-generated";
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  };

  const normalizePhoneForWhatsapp = (value) => {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) {
      return "";
    }

    if (digits.startsWith("254")) {
      return digits;
    }

    if (digits.startsWith("0")) {
      return `254${digits.slice(1)}`;
    }

    return digits;
  };

  const parseErrorResponse = async (response) => {
    try {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const payload = await response.json();
        return payload?.error || payload?.message || `HTTP ${response.status}`;
      }

      const text = await response.text();
      return text || `HTTP ${response.status}`;
    } catch {
      return `HTTP ${response.status}`;
    }
  };

  const collectPayload = () => ({
    client_name: elements.clientName.value.trim(),
    client_phone: elements.clientPhone.value.trim(),
    client_email: elements.clientEmail.value.trim(),
    vehicle_make: elements.vehicleMake.value.trim(),
    vehicle_model: elements.vehicleModel.value.trim(),
    registration_no: elements.vehicleReg.value.trim().toUpperCase(),
    film_installed: elements.filmInstalled.value.trim(),
    installation_date: elements.installDate.value,
    invoice_ref: elements.invoiceRef.value.trim(),
    issue_date: elements.issueDate.value,
    warranty_period: elements.warrantyPeriod.value.trim(),
    what_is_covered: elements.covered.value.trim(),
    what_is_not_covered: elements.notCovered.value.trim(),
    additional_notes: elements.notes.value.trim(),
    invoice_id: state.prefillInvoiceId ? Number(state.prefillInvoiceId) : null,
  });

  const validatePayload = (payload) => {
    if (!payload.client_name) {
      return "Client name is required.";
    }

    if (!payload.film_installed) {
      return "Film installed is required.";
    }

    if (!payload.installation_date) {
      return "Installation date is required.";
    }

    if (!payload.issue_date) {
      return "Issue date is required.";
    }

    if (!payload.warranty_period) {
      return "Warranty period is required.";
    }

    if (!payload.what_is_covered) {
      return "What is covered is required.";
    }

    if (!payload.what_is_not_covered) {
      return "What is not covered is required.";
    }

    return null;
  };

  const requestWarrantyPdf = async (payload) => {
    const token = await window.MKT_CMS_AUTH.ensureToken();
    const response = await fetch(`${window.MKT_CMS_AUTH.API_BASE}/api/warranties/generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    if (response.status === 401) {
      window.MKT_CMS_AUTH.clearToken();
      window.MKT_CMS_AUTH.redirectToLogin();
      throw new Error("Session expired");
    }

    if (!response.ok) {
      throw new Error(await parseErrorResponse(response));
    }

    return {
      blob: await response.blob(),
      certificateNumber: response.headers.get("X-Certificate-Number") || "",
    };
  };

  const invalidateGeneratedPdf = () => {
    if (!state.currentPdfBlob && !state.generatedCertNumber) {
      return;
    }

    state.currentPdfBlob = null;
    state.generatedCertNumber = "";
    elements.sendOptions.hidden = true;
    setCertificateDisplay("");
    setStatus(
      "Draft changed. Generate the certificate again to save the latest version.",
      "warning"
    );
  };

  const ensurePdfReady = () => {
    if (state.currentPdfBlob) {
      return true;
    }

    window.showToast("Generate the warranty PDF first.", "warning");
    return false;
  };

  const currentFilename = () =>
    `MK-Warranty-${state.generatedCertNumber || "certificate"}.pdf`;

  const prefillFromInvoice = async (invoiceId) => {
    const data = await window.GET(`/api/invoices/${encodeURIComponent(invoiceId)}`);
    const invoice = data?.invoice;
    if (!invoice) {
      throw new Error("Invoice not found.");
    }

    state.prefillInvoiceNumber = invoice.invoice_number || "";
    elements.clientName.value = invoice.client_name || "";
    elements.clientPhone.value = invoice.client_phone_display || invoice.client_phone || "";
    elements.clientEmail.value = invoice.client_email || "";
    elements.vehicleMake.value = invoice.vehicle_make || "";
    elements.vehicleModel.value = invoice.vehicle_model || "";
    elements.vehicleReg.value = invoice.registration_no || "";
    elements.filmInstalled.value = invoice.film_used || "";
    elements.installDate.value = invoice.service_date || "";
    elements.invoiceRef.value = invoice.invoice_number || "";

    if (elements.prefillNotice) {
      elements.prefillNotice.textContent = `Pre-filled from Invoice ${invoice.invoice_number}`;
      elements.prefillNotice.hidden = false;
    }
  };

  const bindTransforms = () => {
    elements.vehicleReg.addEventListener("input", () => {
      elements.vehicleReg.value = elements.vehicleReg.value.toUpperCase();
    });
  };

  const bindGenerate = () => {
    elements.generateButton.addEventListener("click", async () => {
      const payload = collectPayload();
      const validationError = validatePayload(payload);

      if (validationError) {
        window.showToast(validationError, "warning");
        setStatus(validationError, "warning");
        return;
      }

      window.setButtonLoading(elements.generateButton, true, "Generating...");
      setStatus(
        "Generating the warranty PDF and saving the certificate record...",
        "info"
      );

      try {
        const result = await requestWarrantyPdf(payload);
        state.currentPdfBlob = result.blob;
        state.generatedCertNumber = result.certificateNumber || "";
        setCertificateDisplay(state.generatedCertNumber);
        elements.sendOptions.hidden = false;
        setStatus(
          `Certificate ${state.generatedCertNumber || "generated"} saved to records.`,
          "success"
        );
        window.showToast("Certificate generated and saved to records.", "success");
      } catch (error) {
        setStatus(`Failed to generate warranty: ${error.message}`, "error");
        window.showToast(`Failed to generate warranty: ${error.message}`, "error");
      } finally {
        window.setButtonLoading(elements.generateButton, false);
      }
    });
  };

  const bindDownloadActions = () => {
    elements.download.addEventListener("click", () => {
      if (!ensurePdfReady()) {
        return;
      }

      downloadBlob(state.currentPdfBlob, currentFilename());
    });

    elements.sendWhatsapp.addEventListener("click", () => {
      if (!ensurePdfReady()) {
        return;
      }

      downloadBlob(state.currentPdfBlob, currentFilename());
      const certNumber = state.generatedCertNumber || "your warranty certificate";
      const waNumber = normalizePhoneForWhatsapp(elements.clientPhone.value);
      const message = encodeURIComponent(
        `Hello, your MK Tintworks warranty certificate ${certNumber} is ready. Please attach the downloaded PDF when sending.`
      );
      const url = waNumber
        ? `https://wa.me/${waNumber}?text=${message}`
        : `https://wa.me/?text=${message}`;

      window.setTimeout(() => {
        window.open(url, "_blank", "noopener");
        window.showToast(
          "PDF downloaded. Attach it in WhatsApp before sending.",
          "info"
        );
      }, 700);
    });

    elements.sendEmail.addEventListener("click", () => {
      if (!ensurePdfReady()) {
        return;
      }

      const email = elements.clientEmail.value.trim();
      if (!email) {
        window.showToast("Client email is empty.", "warning");
        return;
      }

      downloadBlob(state.currentPdfBlob, currentFilename());

      const certNumber = state.generatedCertNumber || "";
      const subject = encodeURIComponent(
        `Warranty Certificate ${certNumber} — MK Tintworks`
      );
      const body = encodeURIComponent(
        `Dear Client,\n\nPlease find attached your warranty certificate ${certNumber}.\n\nKeep this certificate safe for any future warranty claims.\n\nMK Tintworks\n+254 703 900 575`
      );

      window.setTimeout(() => {
        window.location.href = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
        window.showToast(
          "Email client opened. Attach the downloaded PDF before sending.",
          "info"
        );
      }, 700);
    });
  };

  const init = async () => {
    setCertificateDisplay("");
    elements.issueDate.value = todayValue();

    try {
      await (window.MKT_CMS_AUTH?.ready || Promise.resolve());

      if (state.prefillInvoiceId) {
        await prefillFromInvoice(state.prefillInvoiceId);
      }

      if (!elements.issueDate.value) {
        elements.issueDate.value = todayValue();
      }

      setStatus(
        state.prefillInvoiceId
          ? "Invoice details loaded. Confirm the terms and generate the certificate."
          : "The form is ready. Fill the coverage terms and generate the certificate.",
        "success"
      );
    } catch (error) {
      setStatus(`Failed to initialise warranty form: ${error.message}`, "error");
      window.showToast(`Failed to initialise warranty form: ${error.message}`, "error");
    }

    bindTransforms();
    bindGenerate();
    bindDownloadActions();

    form.addEventListener("input", invalidateGeneratedPdf);
    form.addEventListener("change", invalidateGeneratedPdf);
  };

  init();
})(window, document);
