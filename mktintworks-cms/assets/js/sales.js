(function initSalesDashboard(window, document) {
  const elements = {
    status: document.getElementById("sales-status"),
    periodSelect: document.getElementById("period-select"),
    refreshButton: document.getElementById("sales-refresh-btn"),
    statCollected: document.getElementById("stat-collected"),
    statCollectedJobs: document.getElementById("stat-collected-jobs"),
    statOutstanding: document.getElementById("stat-outstanding"),
    statOutstandingJobs: document.getElementById("stat-outstanding-jobs"),
    statAverage: document.getElementById("stat-avg"),
    statAverageContext: document.getElementById("stat-avg-context"),
    statJobs: document.getElementById("stat-jobs"),
    statJobsContext: document.getElementById("stat-jobs-context"),
    unpaidBadge: document.getElementById("unpaid-count"),
    unpaidTableWrap: document.getElementById("unpaid-table-wrap"),
    topClientsWrap: document.getElementById("top-clients-wrap"),
  };

  if (!elements.periodSelect || !elements.unpaidTableWrap) {
    return;
  }

  const CHART_COLORS = {
    wine: "#7A0C1E",
    gold: "#C9A84C",
    green: "#2ECC71",
    blue: "#4AA3FF",
    teal: "#17BEBB",
    coral: "#E15B64",
    cream: "#F8F2E6",
    border: "rgba(255, 255, 255, 0.06)",
  };

  const PERIOD_LABELS = {
    "30": "Last 30 days",
    "90": "Last 90 days",
    "365": "This Year",
    all: "All Time",
  };

  const PAYMENT_METHOD_LABELS = {
    mpesa: "M-Pesa",
    cash: "Cash",
    bank: "Bank Transfer",
    bank_transfer: "Bank Transfer",
    card: "Card",
    cheque: "Cheque",
  };

  const SERVICE_LABELS = {
    automotive: "Automotive",
    residential: "Residential",
    commercial: "Commercial",
  };

  const state = {
    period: String(elements.periodSelect.value || "365"),
    charts: {},
    unpaidInvoices: [],
    invoiceSort: {
      key: "service_date",
      direction: "asc",
    },
  };

  const escapeHtml = (value) =>
    String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const formatCount = (value) =>
    Number(value || 0).toLocaleString("en-KE", {
      maximumFractionDigits: 0,
    });

  const titleCase = (value) => {
    const text = String(value || "")
      .trim()
      .replace(/[_-]+/g, " ")
      .toLowerCase();
    return text
      ? text.replace(/\b\w/g, (character) => character.toUpperCase())
      : "Unknown";
  };

  const getPeriodLabel = (period) => PERIOD_LABELS[period] || PERIOD_LABELS["365"];

  const getDateValue = (value) => {
    const text = String(value || "").trim();
    if (!text) {
      return null;
    }

    const date = new Date(`${text}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const getDateNumber = (value) => getDateValue(value)?.getTime() || 0;

  const getDaysOld = (value) => {
    const date = getDateValue(value);
    if (!date) {
      return 0;
    }

    const now = new Date();
    const utcToday = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    );
    const utcValue = Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    );
    return Math.max(0, Math.floor((utcToday - utcValue) / 86400000));
  };

  const paymentBadge = (status) => {
    const normalized = String(status || "").trim().toLowerCase();
    const tone =
      normalized === "paid"
        ? "success"
        : normalized === "partial"
          ? "warning"
          : "danger";

    return `<span class="badge badge-${tone}">${escapeHtml(
      titleCase(normalized || "unknown")
    )}</span>`;
  };

  const setStatus = (message, tone = "info") => {
    if (!elements.status) {
      return;
    }

    elements.status.textContent = message || "";
    elements.status.dataset.tone = tone;
  };

  const destroyCharts = () => {
    Object.values(state.charts).forEach((chart) => {
      if (chart && typeof chart.destroy === "function") {
        chart.destroy();
      }
    });
    state.charts = {};
  };

  const setLoadingState = (isLoading) => {
    elements.periodSelect.disabled = Boolean(isLoading);
    window.setButtonLoading(elements.refreshButton, isLoading, "Refreshing...");
    if (isLoading) {
      setStatus("Loading sales dashboard…", "info");
    }
  };

  const toggleChartEmptyState = (id, isEmpty, message = "") => {
    const canvas = document.getElementById(id);
    const emptyState = document.querySelector(`[data-empty-for="${id}"]`);

    if (canvas) {
      canvas.hidden = Boolean(isEmpty);
    }

    if (emptyState) {
      emptyState.hidden = !isEmpty;
      emptyState.textContent = message;
    }
  };

  const hasPositiveSeriesValue = (config) =>
    Array.isArray(config?.data?.datasets)
      ? config.data.datasets.some((dataset) =>
          Array.isArray(dataset?.data)
            ? dataset.data.some((value) => Number(value || 0) > 0)
            : false
        )
      : false;

  const createChart = (id, config, options = {}) => {
    const { emptyMessage = "No data yet.", renderWhenEmpty = false } = options;
    const canvas = document.getElementById(id);
    if (!canvas || typeof window.Chart !== "function") {
      return;
    }

    const hasData = hasPositiveSeriesValue(config);
    if (!hasData && !renderWhenEmpty) {
      toggleChartEmptyState(id, true, emptyMessage);
      return;
    }

    toggleChartEmptyState(id, false);
    state.charts[id] = new window.Chart(canvas.getContext("2d"), config);
  };

  const baseLegend = {
    labels: {
      color: "rgba(248, 242, 230, 0.82)",
      font: {
        family: "Inter",
        size: 12,
      },
      boxWidth: 12,
      boxHeight: 12,
    },
  };

  const baseTooltip = {
    backgroundColor: "rgba(12, 12, 12, 0.96)",
    borderColor: "rgba(201, 168, 76, 0.24)",
    borderWidth: 1,
    titleColor: CHART_COLORS.cream,
    bodyColor: "rgba(248, 242, 230, 0.88)",
  };

  const buildCartesianOptions = (overrides = {}) => {
    const {
      plugins: pluginOverrides = {},
      scales: scaleOverrides = {},
      ...restOverrides
    } = overrides;
    const {
      x: xOverrides = {},
      y: yOverrides = {},
    } = scaleOverrides;
    const {
      ticks: xTickOverrides = {},
      grid: xGridOverrides = {},
      ...xRest
    } = xOverrides;
    const {
      ticks: yTickOverrides = {},
      grid: yGridOverrides = {},
      ...yRest
    } = yOverrides;

    return {
      responsive: true,
      maintainAspectRatio: false,
      ...restOverrides,
      plugins: {
        legend: baseLegend,
        tooltip: baseTooltip,
        ...pluginOverrides,
      },
      scales: {
        x: {
          ...xRest,
          ticks: {
            color: "rgba(248, 242, 230, 0.54)",
            font: {
              family: "Inter",
              size: 11,
            },
            ...xTickOverrides,
          },
          grid: {
            color: CHART_COLORS.border,
            ...xGridOverrides,
          },
        },
        y: {
          beginAtZero: true,
          ...yRest,
          ticks: {
            color: "rgba(248, 242, 230, 0.54)",
            font: {
              family: "Inter",
              size: 11,
            },
            ...yTickOverrides,
          },
          grid: {
            color: CHART_COLORS.border,
            ...yGridOverrides,
          },
        },
      },
    };
  };

  const renderStats = (payload) => {
    const totals = payload?.totals || {};
    const collected = Number(totals.collected || 0);
    const outstanding = Number(totals.outstanding || 0);
    const totalJobs = Number(totals.total_jobs || 0);
    const paidJobs = Number(totals.paid_jobs || 0);
    const unpaidJobs = Number(totals.unpaid_jobs || 0);
    const average = totalJobs > 0 ? Math.round((collected + outstanding) / totalJobs) : 0;
    const periodLabel = getPeriodLabel(state.period).toLowerCase();

    elements.statCollected.textContent = window.formatKSh(collected);
    elements.statCollectedJobs.textContent = `${formatCount(
      paidJobs
    )} paid job${paidJobs === 1 ? "" : "s"} in ${periodLabel}.`;

    elements.statOutstanding.textContent = window.formatKSh(outstanding);
    elements.statOutstandingJobs.textContent = `${formatCount(
      unpaidJobs
    )} unpaid or partial job${unpaidJobs === 1 ? "" : "s"} in ${periodLabel}.`;

    elements.statAverage.textContent = window.formatKSh(average);
    elements.statAverageContext.textContent =
      totalJobs > 0
        ? `Average invoice value across ${formatCount(totalJobs)} job${
            totalJobs === 1 ? "" : "s"
          } in ${periodLabel}.`
        : `No invoice value has been recorded for ${periodLabel}.`;

    elements.statJobs.textContent = formatCount(totalJobs);
    elements.statJobsContext.textContent =
      totalJobs > 0
        ? `${formatCount(paidJobs)} paid and ${formatCount(
            unpaidJobs
          )} outstanding statuses in the selected period.`
        : "No invoices fall inside the selected period yet.";
  };

  const renderCharts = (payload) => {
    destroyCharts();

    const monthly = Array.isArray(payload?.monthly_revenue)
      ? payload.monthly_revenue
      : [];
    createChart(
      "chart-monthly",
      {
        type: "line",
        data: {
          labels: monthly.map((row) => row.month || ""),
          datasets: [
            {
              label: "Collected (KSh)",
              data: monthly.map((row) => Number(row.collected || 0)),
              borderColor: CHART_COLORS.green,
              backgroundColor: "rgba(46, 204, 113, 0.12)",
              fill: true,
              pointBackgroundColor: CHART_COLORS.green,
              pointRadius: 3,
              pointHoverRadius: 5,
              tension: 0.34,
            },
            {
              label: "Outstanding (KSh)",
              data: monthly.map((row) => Number(row.outstanding || 0)),
              borderColor: CHART_COLORS.wine,
              backgroundColor: "rgba(122, 12, 30, 0.08)",
              fill: true,
              pointBackgroundColor: CHART_COLORS.gold,
              pointRadius: 3,
              pointHoverRadius: 5,
              tension: 0.34,
              borderDash: [5, 5],
            },
          ],
        },
        options: buildCartesianOptions({
          plugins: {
            tooltip: {
              ...baseTooltip,
              callbacks: {
                label(context) {
                  return ` ${context.dataset.label}: ${window.formatKSh(context.raw)}`;
                },
              },
            },
          },
          scales: {
            y: {
              ticks: {
                callback(value) {
                  return window.formatKSh(value);
                },
              },
            },
          },
        }),
      },
      {
        renderWhenEmpty: true,
      }
    );

    const products = Array.isArray(payload?.product_performance)
      ? payload.product_performance
      : [];
    createChart(
      "chart-products",
      {
        type: "bar",
        data: {
          labels: products.map((row) => row.film_used || "Not specified"),
          datasets: [
            {
              label: "Revenue (KSh)",
              data: products.map((row) => Number(row.revenue || 0)),
              backgroundColor: "rgba(201, 168, 76, 0.76)",
              borderColor: CHART_COLORS.gold,
              borderWidth: 1,
              borderRadius: 6,
            },
          ],
        },
        options: buildCartesianOptions({
          indexAxis: "y",
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              ...baseTooltip,
              callbacks: {
                label(context) {
                  return ` Revenue: ${window.formatKSh(context.raw)}`;
                },
                afterLabel(context) {
                  const product = products[context.dataIndex];
                  const jobs = Number(product?.job_count || 0);
                  return `Jobs: ${jobs}`;
                },
              },
            },
          },
          scales: {
            x: {
              ticks: {
                callback(value) {
                  return window.formatKSh(value);
                },
              },
            },
          },
        }),
      },
      {
        emptyMessage: "No film revenue data exists for the selected period yet.",
      }
    );

    const paymentSplit = Array.isArray(payload?.payment_split)
      ? payload.payment_split
      : [];
    createChart(
      "chart-payment",
      {
        type: "doughnut",
        data: {
          labels: paymentSplit.map((row) => {
            const key = String(row.payment_method || "").trim().toLowerCase();
            return PAYMENT_METHOD_LABELS[key] || titleCase(key);
          }),
          datasets: [
            {
              data: paymentSplit.map((row) => Number(row.count || 0)),
              backgroundColor: [
                CHART_COLORS.wine,
                CHART_COLORS.gold,
                CHART_COLORS.blue,
                CHART_COLORS.teal,
                CHART_COLORS.coral,
              ],
              borderColor: "#151515",
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              ...baseLegend,
            },
            tooltip: {
              ...baseTooltip,
              callbacks: {
                label(context) {
                  return ` ${context.label}: ${formatCount(context.raw)} invoice${
                    Number(context.raw) === 1 ? "" : "s"
                  }`;
                },
              },
            },
          },
        },
      },
      {
        emptyMessage: "No payment-method data exists for the selected period yet.",
      }
    );

    const serviceSplit = Array.isArray(payload?.service_split)
      ? payload.service_split
      : [];
    createChart(
      "chart-service",
      {
        type: "doughnut",
        data: {
          labels: serviceSplit.map((row) => {
            const key = String(row.service_type || "").trim().toLowerCase();
            return SERVICE_LABELS[key] || titleCase(key);
          }),
          datasets: [
            {
              data: serviceSplit.map((row) => Number(row.count || 0)),
              backgroundColor: [
                CHART_COLORS.wine,
                CHART_COLORS.gold,
                CHART_COLORS.green,
                CHART_COLORS.blue,
              ],
              borderColor: "#151515",
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              ...baseLegend,
            },
            tooltip: {
              ...baseTooltip,
              callbacks: {
                label(context) {
                  return ` ${context.label}: ${formatCount(context.raw)} job${
                    Number(context.raw) === 1 ? "" : "s"
                  }`;
                },
              },
            },
          },
        },
      },
      {
        emptyMessage: "No service-type data exists for the selected period yet.",
      }
    );
  };

  const compareValues = (left, right, key) => {
    if (key === "service_date") {
      return getDateNumber(left.service_date) - getDateNumber(right.service_date);
    }

    if (key === "days_overdue") {
      return getDaysOld(left.service_date) - getDaysOld(right.service_date);
    }

    if (key === "total_amount") {
      return Number(left.total_amount || 0) - Number(right.total_amount || 0);
    }

    const leftValue = String(left[key] || "").toLowerCase();
    const rightValue = String(right[key] || "").toLowerCase();
    return leftValue.localeCompare(rightValue);
  };

  const getSortedInvoices = () => {
    const sorted = [...state.unpaidInvoices];
    sorted.sort((left, right) => {
      const comparison = compareValues(left, right, state.invoiceSort.key);
      return state.invoiceSort.direction === "asc" ? comparison : -comparison;
    });
    return sorted;
  };

  const sortArrow = (key) => {
    if (state.invoiceSort.key !== key) {
      return "↕";
    }

    return state.invoiceSort.direction === "asc" ? "↑" : "↓";
  };

  const overdueToneClass = (days) => {
    if (days > 30) {
      return "is-critical";
    }
    if (days > 7) {
      return "is-warning";
    }
    return "is-neutral";
  };

  const renderUnpaidTable = (invoices) => {
    state.unpaidInvoices = Array.isArray(invoices) ? [...invoices] : [];
    elements.unpaidBadge.textContent = String(state.unpaidInvoices.length);
    elements.unpaidBadge.hidden = state.unpaidInvoices.length === 0;

    if (!state.unpaidInvoices.length) {
      elements.unpaidTableWrap.innerHTML = `
        <div class="empty-state sales-inline-empty">
          All invoices are fully paid right now. No outstanding balance is on the books.
        </div>
      `;
      return;
    }

    const sorted = getSortedInvoices();
    elements.unpaidTableWrap.innerHTML = `
      <div class="table-wrap sales-table-wrap">
        <table class="data-table sales-table">
          <thead>
            <tr>
              <th><button class="sales-sort-btn" type="button" data-sort="invoice_number">Invoice # <span>${sortArrow(
                "invoice_number"
              )}</span></button></th>
              <th><button class="sales-sort-btn" type="button" data-sort="client_name">Client <span>${sortArrow(
                "client_name"
              )}</span></button></th>
              <th><button class="sales-sort-btn" type="button" data-sort="total_amount">Amount Due <span>${sortArrow(
                "total_amount"
              )}</span></button></th>
              <th><button class="sales-sort-btn" type="button" data-sort="payment_status">Status <span>${sortArrow(
                "payment_status"
              )}</span></button></th>
              <th><button class="sales-sort-btn" type="button" data-sort="service_date">Service Date <span>${sortArrow(
                "service_date"
              )}</span></button></th>
              <th><button class="sales-sort-btn" type="button" data-sort="days_overdue">Days Overdue <span>${sortArrow(
                "days_overdue"
              )}</span></button></th>
            </tr>
          </thead>
          <tbody>
            ${sorted
              .map((invoice) => {
                const daysOld = getDaysOld(invoice.service_date);
                return `
                  <tr>
                    <td class="sales-mono">${escapeHtml(invoice.invoice_number || "—")}</td>
                    <td class="sales-client-cell">${escapeHtml(invoice.client_name || "—")}</td>
                    <td class="sales-amount-due">${escapeHtml(
                      window.formatKSh(invoice.total_amount || 0)
                    )}</td>
                    <td>${paymentBadge(invoice.payment_status)}</td>
                    <td>${escapeHtml(window.formatDate(invoice.service_date))}</td>
                    <td>
                      <span class="sales-overdue ${overdueToneClass(daysOld)}">${daysOld}d</span>
                    </td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  };

  const renderTopClients = (clients) => {
    const items = Array.isArray(clients) ? clients : [];
    if (!items.length) {
      elements.topClientsWrap.innerHTML = `
        <div class="empty-state sales-inline-empty">
          No client spend data exists for the selected period yet.
        </div>
      `;
      return;
    }

    const maxSpend = Math.max(
      ...items.map((client) => Number(client.total_spent || 0)),
      1
    );

    elements.topClientsWrap.innerHTML = `
      <div class="sales-client-list">
        ${items
          .map((client, index) => {
            const spend = Number(client.total_spent || 0);
            const jobs = Number(client.job_count || 0);
            const barWidth = Math.max(6, Math.round((spend / maxSpend) * 100));
            return `
              <article class="sales-client-item">
                <div class="sales-client-rank">${index + 1}</div>
                <div class="sales-client-body">
                  <div class="sales-client-topline">
                    <div>
                      <strong>${escapeHtml(client.full_name || "Unknown client")}</strong>
                      <p>${escapeHtml(client.phone || "No phone saved")}</p>
                    </div>
                    <span class="sales-client-total">${escapeHtml(window.formatKSh(spend))}</span>
                  </div>
                  <div class="sales-client-bar-track">
                    <div class="sales-client-bar-fill" style="width:${barWidth}%"></div>
                  </div>
                  <p class="sales-client-meta">
                    ${formatCount(jobs)} job${jobs === 1 ? "" : "s"} in ${getPeriodLabel(
                      state.period
                    ).toLowerCase()}.
                  </p>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  };

  const updateStatusFromPayload = (payload) => {
    const generatedAt = payload?.generated_at
      ? window.formatDateTime(payload.generated_at)
      : "just now";
    setStatus(
      `Updated ${generatedAt}. Showing ${getPeriodLabel(
        state.period
      ).toLowerCase()} data. Monthly trend remains fixed to the last six calendar months.`,
      "success"
    );
  };

  const loadSales = async (period = state.period) => {
    setLoadingState(true);
    state.period = String(period || "365");

    try {
      if (typeof window.Chart !== "function") {
        throw new Error("Chart.js failed to load");
      }

      const payload = await window.GET(`/api/sales/summary?period=${encodeURIComponent(state.period)}`);
      renderStats(payload);
      renderCharts(payload);
      renderUnpaidTable(payload?.unpaid_invoices || []);
      renderTopClients(payload?.top_clients || []);
      updateStatusFromPayload(payload);
    } catch (error) {
      destroyCharts();
      setStatus(`Failed to load sales dashboard: ${error.message}`, "error");
      window.showToast(`Failed to load sales data: ${error.message}`, "error");
    } finally {
      setLoadingState(false);
    }
  };

  const bindEvents = () => {
    elements.periodSelect.addEventListener("change", (event) => {
      loadSales(String(event.target.value || "365"));
    });

    elements.refreshButton.addEventListener("click", () => {
      loadSales(state.period);
    });

    elements.unpaidTableWrap.addEventListener("click", (event) => {
      const button = event.target.closest("[data-sort]");
      if (!button) {
        return;
      }

      const nextKey = String(button.dataset.sort || "");
      if (!nextKey) {
        return;
      }

      if (state.invoiceSort.key === nextKey) {
        state.invoiceSort.direction =
          state.invoiceSort.direction === "asc" ? "desc" : "asc";
      } else {
        state.invoiceSort.key = nextKey;
        state.invoiceSort.direction = nextKey === "service_date" ? "asc" : "desc";
      }

      renderUnpaidTable(state.unpaidInvoices);
    });
  };

  const init = async () => {
    bindEvents();
    await (window.MKT_CMS_AUTH?.ready || Promise.resolve());
    await loadSales(state.period);
  };

  init();
})(window, document);
