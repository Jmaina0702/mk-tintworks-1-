(function initRecordsSystem(window, document) {
  const elements = {
    status: document.getElementById("records-status"),
    tabButtons: Array.from(document.querySelectorAll(".records-tab-btn[data-tab]")),
    revenueSummary: document.getElementById("revenue-summary"),
    invoiceCount: document.getElementById("invoice-count"),
    sumCollected: document.getElementById("sum-collected"),
    sumOutstanding: document.getElementById("sum-outstanding"),
    sumJobs: document.getElementById("sum-jobs"),
    search: document.getElementById("records-search"),
    filterStatus: document.getElementById("filter-status"),
    filterFrom: document.getElementById("filter-from"),
    filterTo: document.getElementById("filter-to"),
    exportCsv: document.getElementById("export-csv-btn"),
    clearFilters: document.getElementById("clear-filters-btn"),
    invoicesWrap: document.getElementById("invoices-wrap"),
    warrantiesWrap: document.getElementById("warranties-wrap"),
    clientsWrap: document.getElementById("clients-wrap"),
    invoicePanel: document.getElementById("tab-invoices"),
    warrantyPanel: document.getElementById("tab-warranties"),
    clientsPanel: document.getElementById("tab-clients"),
  };

  if (!elements.invoicesWrap) {
    return;
  }

  const state = {
    currentTab: "invoices",
    allData: {
      invoices: [],
      warranties: [],
      clients: [],
    },
  };

  const searchPlaceholders = {
    invoices: "Search by client, invoice number, registration, or film",
    warranties: "Search by client, certificate number, registration, or film",
    clients: "Search by client name, phone, email, or registration",
  };

  const escapeHtml = (value) =>
    String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const setStatus = (message, tone = "info") => {
    if (!elements.status) {
      return;
    }

    elements.status.textContent = message || "";
    elements.status.dataset.tone = tone;
  };

  const titleCase = (value) => {
    const text = String(value || "").trim().toLowerCase();
    return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : "—";
  };

  const paymentBadge = (status) =>
    window.statusBadge ? window.statusBadge(titleCase(status)) : escapeHtml(titleCase(status));

  const renderEmptyState = (message) =>
    `<div class="empty-state records-empty">${escapeHtml(message)}</div>`;

  const getDateValue = (value) => {
    const text = String(value || "").trim();
    return text ? text.slice(0, 10) : "";
  };

  const updateSummary = () => {
    const paidTotal = state.allData.invoices
      .filter((invoice) => invoice.payment_status === "paid")
      .reduce((sum, invoice) => sum + Number(invoice.total_amount || 0), 0);

    const unpaidTotal = state.allData.invoices
      .filter((invoice) => invoice.payment_status === "unpaid")
      .reduce((sum, invoice) => sum + Number(invoice.total_amount || 0), 0);

    elements.sumCollected.textContent = window.formatKSh(paidTotal);
    elements.sumOutstanding.textContent = window.formatKSh(unpaidTotal);
    elements.sumJobs.textContent = String(state.allData.invoices.length);
  };

  const updateInvoiceCount = () => {
    const count = state.allData.invoices.length;
    elements.invoiceCount.textContent = String(count);
    elements.invoiceCount.hidden = count === 0;
  };

  const renderInvoices = (invoices) => {
    if (!invoices.length) {
      elements.invoicesWrap.innerHTML = renderEmptyState("No invoices match the current filters.");
      return;
    }

    elements.invoicesWrap.innerHTML = `
      <div class="table-wrap">
        <table class="data-table records-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Client</th>
              <th>Film / Service</th>
              <th>Total</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${invoices
              .map(
                (invoice) => `
                  <tr>
                    <td class="records-mono">${escapeHtml(invoice.invoice_number)}</td>
                    <td>
                      <div class="records-cell-stack">
                        <strong class="records-strong">${escapeHtml(invoice.client_name || "—")}</strong>
                        <span class="records-muted">${escapeHtml(invoice.registration_no || "—")}</span>
                      </div>
                    </td>
                    <td>
                      <div class="records-cell-stack">
                        <span>${escapeHtml(invoice.film_used || "—")}</span>
                        <span class="records-muted">${escapeHtml(titleCase(invoice.service_type))}</span>
                      </div>
                    </td>
                    <td class="records-strong">${escapeHtml(window.formatKSh(invoice.total_amount || 0))}</td>
                    <td>${paymentBadge(invoice.payment_status)}</td>
                    <td>${escapeHtml(window.formatDate(invoice.service_date))}</td>
                    <td>
                      <div class="records-actions">
                        ${
                          invoice.pdf_r2_key
                            ? `<button class="btn btn-ghost btn-sm" type="button" data-action="download-invoice" data-identifier="${escapeHtml(
                                invoice.invoice_number
                              )}">PDF</button>`
                            : ""
                        }
                        <button class="btn btn-ghost btn-sm" type="button" data-action="open-warranty" data-id="${invoice.id}">Warranty</button>
                        <button class="btn btn-danger btn-sm" type="button" data-action="delete-invoice" data-id="${invoice.id}">Delete</button>
                      </div>
                    </td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  };

  const renderWarranties = (warranties) => {
    if (!warranties.length) {
      elements.warrantiesWrap.innerHTML = renderEmptyState("No certificates match the current filters.");
      return;
    }

    elements.warrantiesWrap.innerHTML = `
      <div class="table-wrap">
        <table class="data-table records-table">
          <thead>
            <tr>
              <th>Certificate #</th>
              <th>Client</th>
              <th>Vehicle</th>
              <th>Film</th>
              <th>Period</th>
              <th>Install Date</th>
              <th>PDF</th>
            </tr>
          </thead>
          <tbody>
            ${warranties
              .map(
                (warranty) => `
                  <tr>
                    <td class="records-mono">${escapeHtml(warranty.certificate_number)}</td>
                    <td><strong class="records-strong">${escapeHtml(warranty.client_name || "—")}</strong></td>
                    <td>
                      <div class="records-cell-stack">
                        <span>${escapeHtml(
                          `${warranty.vehicle_make || ""} ${warranty.vehicle_model || ""}`.trim() || "—"
                        )}</span>
                        <span class="records-muted">${escapeHtml(warranty.registration_no || "—")}</span>
                      </div>
                    </td>
                    <td>${escapeHtml(warranty.film_installed || "—")}</td>
                    <td>${escapeHtml(warranty.warranty_period || "—")}</td>
                    <td>${escapeHtml(window.formatDate(warranty.installation_date))}</td>
                    <td>
                      ${
                        warranty.pdf_r2_key
                          ? `<button class="btn btn-ghost btn-sm" type="button" data-action="download-warranty" data-identifier="${escapeHtml(
                              warranty.certificate_number
                            )}">PDF</button>`
                          : "—"
                      }
                    </td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  };

  const renderClients = (clients) => {
    if (!clients.length) {
      elements.clientsWrap.innerHTML = renderEmptyState(
        "No clients yet. Clients are added automatically when invoices are created."
      );
      return;
    }

    elements.clientsWrap.innerHTML = `
      <div class="table-wrap">
        <table class="data-table records-table">
          <thead>
            <tr>
              <th>Client Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Vehicles</th>
              <th>Jobs</th>
              <th>Total Spent</th>
              <th>Since</th>
            </tr>
          </thead>
          <tbody>
            ${clients
              .map(
                (client) => `
                  <tr>
                    <td><strong class="records-strong">${escapeHtml(client.full_name || "—")}</strong></td>
                    <td>${escapeHtml(client.phone_display || client.phone || "—")}</td>
                    <td>${escapeHtml(client.email || "—")}</td>
                    <td>${escapeHtml(client.registrations || "—")}</td>
                    <td class="records-strong">${escapeHtml(String(client.job_count || 0))}</td>
                    <td class="records-total">${escapeHtml(window.formatKSh(client.total_spent || 0))}</td>
                    <td>${escapeHtml(window.formatDate(client.first_service || client.created_at))}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  };

  const getFilteredData = () => {
    const query = elements.search.value.trim().toLowerCase();
    const status = elements.filterStatus.value;
    const from = elements.filterFrom.value;
    const to = elements.filterTo.value;

    if (state.currentTab === "invoices") {
      return state.allData.invoices.filter((invoice) => {
        const haystack = [
          invoice.client_name,
          invoice.invoice_number,
          invoice.registration_no,
          invoice.film_used,
          invoice.service_type,
        ]
          .join(" ")
          .toLowerCase();

        if (query && !haystack.includes(query)) {
          return false;
        }

        if (status && invoice.payment_status !== status) {
          return false;
        }

        const serviceDate = getDateValue(invoice.service_date);
        if (from && serviceDate < from) {
          return false;
        }

        if (to && serviceDate > to) {
          return false;
        }

        return true;
      });
    }

    if (state.currentTab === "warranties") {
      return state.allData.warranties.filter((warranty) => {
        const haystack = [
          warranty.client_name,
          warranty.certificate_number,
          warranty.registration_no,
          warranty.vehicle_make,
          warranty.vehicle_model,
          warranty.film_installed,
          warranty.warranty_period,
        ]
          .join(" ")
          .toLowerCase();

        if (query && !haystack.includes(query)) {
          return false;
        }

        const installDate = getDateValue(warranty.installation_date);
        if (from && installDate < from) {
          return false;
        }

        if (to && installDate > to) {
          return false;
        }

        return true;
      });
    }

    return state.allData.clients.filter((client) => {
      const haystack = [
        client.full_name,
        client.phone,
        client.phone_display,
        client.email,
        client.registrations,
      ]
        .join(" ")
        .toLowerCase();

      if (query && !haystack.includes(query)) {
        return false;
      }

      const referenceDate = getDateValue(client.first_service || client.created_at);
      if (from && referenceDate < from) {
        return false;
      }

      if (to && referenceDate > to) {
        return false;
      }

      return true;
    });
  };

  const applyFilters = () => {
    const filtered = getFilteredData();

    if (state.currentTab === "invoices") {
      renderInvoices(filtered);
      return;
    }

    if (state.currentTab === "warranties") {
      renderWarranties(filtered);
      return;
    }

    renderClients(filtered);
  };

  const updateToolbarForTab = () => {
    elements.search.placeholder = searchPlaceholders[state.currentTab];
    elements.filterStatus.disabled = state.currentTab !== "invoices";
    elements.revenueSummary.hidden = state.currentTab !== "invoices";
  };

  const setActiveTab = (tabKey) => {
    state.currentTab = tabKey;

    elements.invoicePanel.hidden = tabKey !== "invoices";
    elements.warrantyPanel.hidden = tabKey !== "warranties";
    elements.clientsPanel.hidden = tabKey !== "clients";

    elements.tabButtons.forEach((button) => {
      const isActive = button.dataset.tab === tabKey;
      button.className = isActive
        ? "btn btn-secondary records-tab-btn is-active"
        : "btn btn-ghost records-tab-btn";
    });

    updateToolbarForTab();
    applyFilters();
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

  const redownloadPdf = async (type, identifier) => {
    const token = await window.MKT_CMS_AUTH.ensureToken();
    const endpoint =
      type === "invoice"
        ? `/api/invoices/pdf/${encodeURIComponent(identifier)}`
        : `/api/warranties/pdf/${encodeURIComponent(identifier)}`;

    const response = await fetch(`${window.MKT_CMS_AUTH.API_BASE}${endpoint}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      credentials: "include",
    });

    if (response.status === 401) {
      window.MKT_CMS_AUTH.clearToken();
      window.MKT_CMS_AUTH.redirectToLogin();
      throw new Error("Session expired");
    }

    if (!response.ok) {
      throw new Error(await parseErrorResponse(response));
    }

    const blob = await response.blob();
    const filename =
      type === "invoice"
        ? `MKT-Invoice-${identifier}.pdf`
        : `MK-Warranty-${identifier}.pdf`;
    downloadBlob(blob, filename);
  };

  const deleteInvoiceRecord = async (invoiceId) => {
    await window.DELETE(`/api/invoices/${encodeURIComponent(invoiceId)}`);
    await loadAll();
  };

  const escapeCsvValue = (value) => {
    const text = String(value == null ? "" : value);
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const exportCurrentTabCsv = () => {
    const today = new Date().toISOString().slice(0, 10);
    const rows = getFilteredData();
    let headers = [];
    let dataRows = [];
    let filename = "";

    if (state.currentTab === "invoices") {
      headers = [
        "Invoice No",
        "Client",
        "Phone",
        "Reg No",
        "Service",
        "Film",
        "Subtotal",
        "VAT",
        "Total",
        "Payment",
        "Status",
        "Date",
      ];
      dataRows = rows.map((invoice) => [
        invoice.invoice_number,
        invoice.client_name || "",
        invoice.client_phone_display || invoice.client_phone || "",
        invoice.registration_no || "",
        invoice.service_type || "",
        invoice.film_used || "",
        invoice.subtotal || 0,
        invoice.vat_amount || 0,
        invoice.total_amount || 0,
        invoice.payment_method || "",
        invoice.payment_status || "",
        invoice.service_date || "",
      ]);
      filename = `mktintworks-invoices-${today}.csv`;
    } else if (state.currentTab === "warranties") {
      headers = [
        "Certificate No",
        "Client",
        "Reg No",
        "Film",
        "Period",
        "Install Date",
        "Issue Date",
      ];
      dataRows = rows.map((warranty) => [
        warranty.certificate_number,
        warranty.client_name || "",
        warranty.registration_no || "",
        warranty.film_installed || "",
        warranty.warranty_period || "",
        warranty.installation_date || "",
        warranty.issue_date || "",
      ]);
      filename = `mktintworks-warranties-${today}.csv`;
    } else {
      headers = [
        "Name",
        "Phone",
        "Email",
        "Vehicles",
        "Jobs",
        "Total Spent",
        "Since",
      ];
      dataRows = rows.map((client) => [
        client.full_name || "",
        client.phone_display || client.phone || "",
        client.email || "",
        client.registrations || "",
        client.job_count || 0,
        client.total_spent || 0,
        getDateValue(client.first_service || client.created_at || ""),
      ]);
      filename = `mktintworks-clients-${today}.csv`;
    }

    const csv = [headers, ...dataRows]
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);

    window.showToast("CSV exported.", "success");
  };

  async function loadAll() {
    setStatus("Loading invoice, warranty, and client records…", "info");

    try {
      const [invoiceData, warrantyData, clientData] = await Promise.all([
        window.GET("/api/records/invoices"),
        window.GET("/api/records/warranties"),
        window.GET("/api/records/clients?limit=500"),
      ]);

      state.allData.invoices = invoiceData?.invoices || [];
      state.allData.warranties = warrantyData?.warranties || [];
      state.allData.clients = clientData?.clients || [];

      updateInvoiceCount();
      updateSummary();
      updateToolbarForTab();
      applyFilters();

      setStatus("Archive loaded. Search, export, or open a record action.", "success");
    } catch (error) {
      setStatus(`Failed to load records: ${error.message}`, "error");
      window.showToast(`Failed to load records: ${error.message}`, "error");
    }
  }

  const bindTableActions = () => {
    elements.invoicesWrap.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) {
        return;
      }

      const action = button.dataset.action;

      if (action === "open-warranty") {
        window.location.assign(`/pages/warranty.html?invoice_id=${encodeURIComponent(button.dataset.id || "")}`);
        return;
      }

      if (action === "download-invoice") {
        try {
          await redownloadPdf("invoice", button.dataset.identifier || "");
        } catch (error) {
          window.showToast(`Download failed: ${error.message}`, "error");
        }
        return;
      }

      if (action === "delete-invoice") {
        const invoiceId = button.dataset.id || "";
        window.confirmAction(
          "Permanently delete this invoice? This also removes the stored PDF from the documents bucket. This cannot be undone.",
          async () => {
            try {
              await deleteInvoiceRecord(invoiceId);
              window.showToast("Invoice deleted.", "success");
            } catch (error) {
              window.showToast(`Delete failed: ${error.message}`, "error");
            }
          }
        );
      }
    });

    elements.warrantiesWrap.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action='download-warranty']");
      if (!button) {
        return;
      }

      try {
        await redownloadPdf("warranty", button.dataset.identifier || "");
      } catch (error) {
        window.showToast(`Download failed: ${error.message}`, "error");
      }
    });
  };

  const bindFilters = () => {
    elements.search.addEventListener("input", window.debounce(applyFilters, 180));
    [elements.filterStatus, elements.filterFrom, elements.filterTo].forEach((control) => {
      control.addEventListener("change", applyFilters);
    });

    elements.clearFilters.addEventListener("click", () => {
      elements.search.value = "";
      elements.filterStatus.value = "";
      elements.filterFrom.value = "";
      elements.filterTo.value = "";
      applyFilters();
    });

    elements.exportCsv.addEventListener("click", exportCurrentTabCsv);
  };

  const bindTabs = () => {
    elements.tabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        setActiveTab(button.dataset.tab || "invoices");
      });
    });
  };

  const init = async () => {
    bindTableActions();
    bindFilters();
    bindTabs();
    updateToolbarForTab();
    await (window.MKT_CMS_AUTH?.ready || Promise.resolve());
    await loadAll();
  };

  init();
})(window, document);
