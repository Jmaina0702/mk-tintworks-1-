(function initInvoiceGenerator(window, document) {
  const form = document.getElementById("invoice-form");
  if (!form) {
    return;
  }

  const currencyFormatter = new Intl.NumberFormat("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const state = {
    clients: [],
    clientsByName: new Map(),
    productsByName: new Map(),
    currentPdfBlob: null,
    currentInvoiceId: "",
    currentInvoiceNumber: "",
    selectedPaymentMethod: "mpesa",
  };

  const elements = {
    invoiceNumber: document.getElementById("invoice-number"),
    serviceDate: document.getElementById("service-date"),
    clientName: document.getElementById("client-name"),
    clientPhone: document.getElementById("client-phone"),
    clientEmail: document.getElementById("client-email"),
    clientSuggestions: document.getElementById("client-suggestions"),
    vehicleMake: document.getElementById("vehicle-make"),
    vehicleModel: document.getElementById("vehicle-model"),
    vehicleReg: document.getElementById("vehicle-reg"),
    vehicleType: document.getElementById("vehicle-type"),
    serviceType: document.getElementById("service-type"),
    filmUsed: document.getElementById("film-used"),
    windowsCount: document.getElementById("windows-count"),
    unitPrice: document.getElementById("unit-price"),
    paymentReference: document.getElementById("payment-reference"),
    paymentStatus: document.getElementById("payment-status"),
    notes: document.getElementById("notes"),
    displaySubtotal: document.getElementById("display-subtotal"),
    displayVat: document.getElementById("display-vat"),
    displayTotal: document.getElementById("display-total"),
    summaryInvoiceNumber: document.getElementById("summary-invoice-number"),
    generateButton: document.getElementById("generate-btn"),
    status: document.getElementById("invoice-status"),
    sendOptions: document.getElementById("send-options"),
    openWarranty: document.getElementById("open-warranty-btn"),
    sendWhatsapp: document.getElementById("send-wa-btn"),
    sendEmail: document.getElementById("send-email-btn"),
    download: document.getElementById("download-btn"),
    paymentButtons: Array.from(document.querySelectorAll(".payment-btn")),
  };

  const formatMoney = (value) => `KSh ${currencyFormatter.format(Number(value || 0))}`;

  const roundMoney = (value) =>
    Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

  const todayValue = () => new Date().toISOString().split("T")[0];

  const normalizeNameKey = (value) => String(value || "").trim().toLowerCase();

  const setStatus = (message, tone = "info") => {
    if (!elements.status) {
      return;
    }

    elements.status.textContent = message || "";
    elements.status.dataset.tone = tone;
  };

  const setInvoiceNumber = (number) => {
    state.currentInvoiceNumber = String(number || "").trim();
    elements.invoiceNumber.value = state.currentInvoiceNumber;
    elements.summaryInvoiceNumber.textContent =
      state.currentInvoiceNumber || "Awaiting invoice number…";
  };

  const recalcTotals = () => {
    const units = Math.max(1, parseInt(elements.windowsCount.value || "1", 10) || 1);
    const unitPrice = roundMoney(elements.unitPrice.value);
    const subtotal = roundMoney(units * unitPrice);
    const vatAmount = roundMoney(subtotal * 0.16);
    const totalAmount = roundMoney(subtotal + vatAmount);

    elements.displaySubtotal.textContent = formatMoney(subtotal);
    elements.displayVat.textContent = formatMoney(vatAmount);
    elements.displayTotal.textContent = formatMoney(totalAmount);

    return {
      windows_count: units,
      unit_price: unitPrice,
      subtotal,
      vat_amount: vatAmount,
      total_amount: totalAmount,
    };
  };

  const invalidateGeneratedPdf = () => {
    if (!state.currentPdfBlob) {
      return;
    }

    state.currentPdfBlob = null;
    state.currentInvoiceId = "";
    elements.sendOptions.hidden = true;
    setStatus("Draft changed. Generate the PDF again to save the latest invoice.", "warning");
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

  const populateFilmOptions = (products) => {
    state.productsByName.clear();
    elements.filmUsed.innerHTML = '<option value="">Select film...</option>';

    (products || []).forEach((product) => {
      const name = String(product?.name || "").trim();
      if (!name) {
        return;
      }

      const option = document.createElement("option");
      option.value = name;
      option.textContent = `${name} — ${formatMoney(product.base_price)}`;
      option.dataset.price = String(product.base_price || 0);
      elements.filmUsed.appendChild(option);
      state.productsByName.set(name, product);
    });
  };

  const populateClients = (clients) => {
    state.clients = Array.isArray(clients) ? clients : [];
    state.clientsByName = new Map();
    elements.clientSuggestions.innerHTML = "";

    state.clients.forEach((client) => {
      const key = normalizeNameKey(client.full_name);
      if (!key || state.clientsByName.has(key)) {
        return;
      }

      state.clientsByName.set(key, client);
      const option = document.createElement("option");
      option.value = client.full_name;
      elements.clientSuggestions.appendChild(option);
    });
  };

  const fillVehicleFromClient = (client) => {
    const vehicle = Array.isArray(client?.vehicles) ? client.vehicles[0] : null;
    if (!vehicle) {
      return;
    }

    if (!elements.vehicleMake.value && vehicle.make) {
      elements.vehicleMake.value = vehicle.make;
    }
    if (!elements.vehicleModel.value && vehicle.model) {
      elements.vehicleModel.value = vehicle.model;
    }
    if (!elements.vehicleReg.value && vehicle.registration_no) {
      elements.vehicleReg.value = vehicle.registration_no;
    }
    if (!elements.vehicleType.value && vehicle.vehicle_type) {
      elements.vehicleType.value = vehicle.vehicle_type;
    }
  };

  const applyClientSuggestion = () => {
    const client = state.clientsByName.get(normalizeNameKey(elements.clientName.value));
    if (!client) {
      return;
    }

    if (!elements.clientPhone.value && client.phone_display) {
      elements.clientPhone.value = client.phone_display;
    }

    if (!elements.clientEmail.value && client.email) {
      elements.clientEmail.value = client.email;
    }

    fillVehicleFromClient(client);
  };

  const collectFormData = () => {
    const totals = recalcTotals();

    return {
      invoice_number: elements.invoiceNumber.value,
      service_date: elements.serviceDate.value,
      client_name: elements.clientName.value.trim(),
      client_phone: elements.clientPhone.value.trim(),
      client_email: elements.clientEmail.value.trim(),
      vehicle_make: elements.vehicleMake.value.trim(),
      vehicle_model: elements.vehicleModel.value.trim(),
      registration_no: elements.vehicleReg.value.trim().toUpperCase(),
      vehicle_type: elements.vehicleType.value,
      service_type: elements.serviceType.value,
      film_used: elements.filmUsed.value,
      windows_count: totals.windows_count,
      unit_price: totals.unit_price,
      subtotal: totals.subtotal,
      vat_rate: 0.16,
      vat_amount: totals.vat_amount,
      total_amount: totals.total_amount,
      payment_method: state.selectedPaymentMethod,
      payment_reference: elements.paymentReference.value.trim(),
      payment_status: elements.paymentStatus.value,
      notes: elements.notes.value.trim(),
    };
  };

  const validateForm = (payload) => {
    if (!payload.client_name) {
      return "Client name is required.";
    }

    if (!payload.service_date) {
      return "Service date is required.";
    }

    if (!payload.unit_price || payload.unit_price <= 0) {
      return "Enter a valid unit price.";
    }

    return null;
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

  const requestInvoicePdf = async (payload) => {
    const token = await window.MKT_CMS_AUTH.ensureToken();
    const response = await fetch(`${window.MKT_CMS_AUTH.API_BASE}/api/invoices/generate`, {
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
      invoiceId: response.headers.get("X-MKT-Invoice-Id") || "",
      invoiceNumber:
        response.headers.get("X-MKT-Invoice-Number") || payload.invoice_number,
    };
  };

  const initDefaults = () => {
    elements.serviceDate.value = todayValue();
    elements.vehicleReg.value = elements.vehicleReg.value.toUpperCase();
    recalcTotals();
  };

  const loadDependencies = async () => {
    const results = await Promise.allSettled([
      window.GET("/api/invoices/next-number"),
      window.GET("/api/products"),
      window.GET("/api/records/clients?limit=150"),
    ]);

    const [invoiceNumberResult, productsResult, clientsResult] = results;

    if (invoiceNumberResult.status === "fulfilled") {
      setInvoiceNumber(invoiceNumberResult.value?.number || "");
    } else {
      throw invoiceNumberResult.reason;
    }

    if (productsResult.status === "fulfilled") {
      populateFilmOptions(productsResult.value?.products || []);
    } else {
      window.showToast(`Products could not be loaded: ${productsResult.reason.message}`, "warning");
    }

    if (clientsResult.status === "fulfilled") {
      populateClients(clientsResult.value?.clients || []);
    } else {
      window.showToast(`Client suggestions unavailable: ${clientsResult.reason.message}`, "warning");
    }
  };

  const bindFilmPricing = () => {
    elements.filmUsed.addEventListener("change", () => {
      const selected = elements.filmUsed.selectedOptions[0];
      const price = Number(selected?.dataset?.price || 0);
      if (price > 0) {
        elements.unitPrice.value = String(price);
      }
      recalcTotals();
    });
  };

  const bindTotals = () => {
    [elements.windowsCount, elements.unitPrice].forEach((input) => {
      input.addEventListener("input", () => {
        recalcTotals();
      });
    });
  };

  const bindPaymentButtons = () => {
    elements.paymentButtons.forEach((button) => {
      button.addEventListener("click", () => {
        elements.paymentButtons.forEach((item) => item.classList.remove("is-active"));
        button.classList.add("is-active");
        state.selectedPaymentMethod = button.dataset.method || "mpesa";
      });
    });
  };

  const bindClientLookup = () => {
    ["change", "blur"].forEach((eventName) => {
      elements.clientName.addEventListener(eventName, () => {
        applyClientSuggestion();
      });
    });
  };

  const bindTransforms = () => {
    elements.vehicleReg.addEventListener("input", () => {
      elements.vehicleReg.value = elements.vehicleReg.value.toUpperCase();
    });
  };

  const bindGenerate = () => {
    elements.generateButton.addEventListener("click", async () => {
      const payload = collectFormData();
      const validationError = validateForm(payload);

      if (validationError) {
        window.showToast(validationError, "warning");
        setStatus(validationError, "warning");
        return;
      }

      window.setButtonLoading(elements.generateButton, true, "Generating...");
      setStatus("Generating the PDF and saving the invoice record...", "info");

      try {
        const result = await requestInvoicePdf(payload);
        state.currentPdfBlob = result.blob;
        state.currentInvoiceId = String(result.invoiceId || "");
        setInvoiceNumber(result.invoiceNumber);
        elements.sendOptions.hidden = false;
        setStatus(
          `Invoice ${result.invoiceNumber} generated and saved to records.`,
          "success"
        );
        window.showToast("Invoice generated and saved to records.", "success");
      } catch (error) {
        setStatus(`Failed to generate invoice: ${error.message}`, "error");
        window.showToast(`Failed to generate invoice: ${error.message}`, "error");
      } finally {
        window.setButtonLoading(elements.generateButton, false);
      }
    });
  };

  const ensurePdfReady = () => {
    if (state.currentPdfBlob) {
      return true;
    }

    window.showToast("Generate the invoice PDF first.", "warning");
    return false;
  };

  const currentFilename = () =>
    `MKT-Invoice-${state.currentInvoiceNumber || elements.invoiceNumber.value || "draft"}.pdf`;

  const bindDownloadActions = () => {
    elements.openWarranty?.addEventListener("click", () => {
      if (!state.currentInvoiceId) {
        window.showToast("Generate the invoice first so it can pre-fill the warranty form.", "warning");
        return;
      }

      window.location.assign(`/pages/warranty.html?invoice_id=${encodeURIComponent(state.currentInvoiceId)}`);
    });

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
      const invoiceNumber = state.currentInvoiceNumber || elements.invoiceNumber.value;
      const waNumber = normalizePhoneForWhatsapp(elements.clientPhone.value);
      const message = encodeURIComponent(
        `Hello, your MK Tintworks invoice ${invoiceNumber} is ready. Please attach the downloaded PDF when sending.`
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

      const invoiceNumber = state.currentInvoiceNumber || elements.invoiceNumber.value;
      const subject = encodeURIComponent(`Invoice ${invoiceNumber} — MK Tintworks`);
      const body = encodeURIComponent(
        `Dear Client,\n\nPlease find attached your invoice ${invoiceNumber} from MK Tintworks.\n\nThank you for choosing us.\n\nMK Tintworks\n+254 703 900 575`
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
    initDefaults();
    bindFilmPricing();
    bindTotals();
    bindPaymentButtons();
    bindClientLookup();
    bindTransforms();
    bindGenerate();
    bindDownloadActions();

    form.addEventListener("input", invalidateGeneratedPdf);
    form.addEventListener("change", invalidateGeneratedPdf);

    try {
      await (window.MKT_CMS_AUTH?.ready || Promise.resolve());
      await loadDependencies();
      recalcTotals();
      setStatus("Invoice number loaded. The form is ready.", "success");
    } catch (error) {
      setStatus(`Failed to initialise invoice form: ${error.message}`, "error");
      window.showToast(`Failed to initialise invoice form: ${error.message}`, "error");
    }
  };

  init();
})(window, document);
