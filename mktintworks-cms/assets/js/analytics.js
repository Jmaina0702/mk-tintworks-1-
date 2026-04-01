(function initAnalyticsDashboard(window, document) {
  const shell = document.querySelector("[data-module-shell]");
  if (!shell) {
    return;
  }

  const CHART_COLORS = {
    wine: "#7A0C1E",
    gold: "#C9A84C",
    ivory: "#F8F2E6",
    blue: "#4AA3FF",
    green: "#39C279",
    coral: "#EA5C65",
    teal: "#17BEBB",
    plum: "#8E6CCF",
  };

  const COUNTRY_NAMES = {
    AE: "United Arab Emirates",
    CA: "Canada",
    DE: "Germany",
    GB: "United Kingdom",
    KE: "Kenya",
    NG: "Nigeria",
    RW: "Rwanda",
    TZ: "Tanzania",
    UG: "Uganda",
    US: "United States",
    ZA: "South Africa",
  };

  const CHART_DEFAULTS = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: "rgba(248, 242, 230, 0.78)",
          font: {
            family: "Inter",
            size: 12,
          },
          boxWidth: 12,
        },
      },
      tooltip: {
        backgroundColor: "rgba(12, 12, 12, 0.96)",
        borderColor: "rgba(201, 168, 76, 0.24)",
        borderWidth: 1,
        titleColor: "#F8F2E6",
        bodyColor: "rgba(248, 242, 230, 0.86)",
      },
    },
    scales: {
      x: {
        ticks: {
          color: "rgba(248, 242, 230, 0.5)",
          font: {
            family: "Inter",
            size: 11,
          },
        },
        grid: {
          color: "rgba(255, 255, 255, 0.04)",
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0,
          color: "rgba(248, 242, 230, 0.5)",
          font: {
            family: "Inter",
            size: 11,
          },
        },
        grid: {
          color: "rgba(255, 255, 255, 0.05)",
        },
      },
    },
  };

  const state = {
    days: 30,
    charts: {},
  };

  const escapeHtml = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const formatNumber = (value) =>
    Number(value || 0).toLocaleString("en-KE", {
      maximumFractionDigits: 0,
    });

  const getDeltaLabel = (current, previous) => {
    const now = Number(current || 0);
    const before = Number(previous || 0);

    if (!before && !now) {
      return "No change from the previous period.";
    }

    if (!before && now > 0) {
      return "New activity vs the previous period.";
    }

    const diff = now - before;
    const percent = Math.round((Math.abs(diff) / before) * 100);
    if (!diff) {
      return "Flat vs the previous period.";
    }

    return `${diff > 0 ? "+" : "−"}${percent}% vs previous ${state.days} days`;
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
    const refreshButton = document.getElementById("analytics-refresh-btn");
    const periodSelect = document.getElementById("period-select");
    const status = document.getElementById("analytics-status");

    window.setButtonLoading(refreshButton, isLoading, "Refreshing...");
    if (periodSelect) {
      periodSelect.disabled = Boolean(isLoading);
    }
    if (status && isLoading) {
      status.textContent = "Loading analytics summary...";
    }
  };

  const renderMetricCards = (payload) => {
    const host = document.getElementById("analytics-metrics");
    if (!host) {
      return;
    }

    const totals = payload?.totals || {};
    const previous = payload?.previous_totals || {};
    const cards = [
      {
        label: "Page Views",
        value: formatNumber(totals.total_pageviews),
        tone: "gold",
        detail:
          "Every page load tracked without cookies, third-party pixels, or stored personal data.",
        delta: getDeltaLabel(totals.total_pageviews, previous.total_pageviews),
      },
      {
        label: "Product Clicks",
        value: formatNumber(totals.total_product_clicks),
        tone: "success",
        detail:
          "Triggered when visitors open a product's More Info section on the services page.",
        delta: getDeltaLabel(
          totals.total_product_clicks,
          previous.total_product_clicks
        ),
      },
      {
        label: "Book Now Clicks",
        value: formatNumber(totals.total_cta_clicks),
        tone: "neutral",
        detail:
          "Counts booking-intent clicks across navigation, service cards, CTA bands, and the booking form.",
        delta: getDeltaLabel(totals.total_cta_clicks, previous.total_cta_clicks),
      },
      {
        label: "Article Reads",
        value: formatNumber(totals.total_blog_reads),
        tone: "warning",
        detail:
          "Blog read events fire once a visitor scrolls at least 50% through an article page.",
        delta: getDeltaLabel(totals.total_blog_reads, previous.total_blog_reads),
      },
    ];

    host.innerHTML = cards
      .map(
        (card) => `
          <article class="metric-card analytics-stat-card" data-tone="${escapeHtml(
            card.tone
          )}">
            <span class="metric-label">${escapeHtml(card.label)}</span>
            <strong>${escapeHtml(card.value)}</strong>
            <p>${escapeHtml(card.detail)}</p>
            <span class="analytics-stat-delta">${escapeHtml(card.delta)}</span>
          </article>
        `
      )
      .join("");
  };

  const toggleChartEmptyState = (id, isEmpty, message) => {
    const canvas = document.getElementById(id);
    const empty = document.querySelector(`[data-empty-for="${id}"]`);

    if (canvas) {
      canvas.hidden = Boolean(isEmpty);
    }
    if (empty) {
      empty.hidden = !isEmpty;
      empty.textContent = message || "No analytics data yet.";
    }
  };

  const createChart = (id, config, emptyMessage) => {
    const canvas = document.getElementById(id);
    if (!canvas || typeof window.Chart !== "function") {
      return;
    }

    const hasData = Array.isArray(config?.data?.datasets)
      ? config.data.datasets.some((dataset) =>
          Array.isArray(dataset?.data)
            ? dataset.data.some((value) => Number(value || 0) > 0)
            : false
        )
      : false;

    if (!hasData) {
      toggleChartEmptyState(id, true, emptyMessage);
      return;
    }

    toggleChartEmptyState(id, false, "");
    state.charts[id] = new window.Chart(canvas.getContext("2d"), config);
  };

  const renderCharts = (payload) => {
    destroyCharts();

    createChart(
      "chart-pageviews",
      {
        type: "line",
        data: {
          labels: (payload?.daily || []).map((row) => String(row.date || "").slice(5)),
          datasets: [
            {
              label: "Page Views",
              data: (payload?.daily || []).map((row) => Number(row.count || 0)),
              borderColor: CHART_COLORS.wine,
              backgroundColor: "rgba(122, 12, 30, 0.14)",
              fill: true,
              tension: 0.32,
              pointRadius: 3,
              pointHoverRadius: 5,
              pointBackgroundColor: CHART_COLORS.gold,
            },
          ],
        },
        options: {
          ...CHART_DEFAULTS,
          plugins: {
            ...CHART_DEFAULTS.plugins,
            legend: {
              display: false,
            },
          },
        },
      },
      "No page views recorded for the selected period yet."
    );

    createChart(
      "chart-sources",
      {
        type: "doughnut",
        data: {
          labels: (payload?.sources || []).map((row) => row.referrer || "direct"),
          datasets: [
            {
              data: (payload?.sources || []).map((row) => Number(row.count || 0)),
              backgroundColor: [
                CHART_COLORS.wine,
                CHART_COLORS.gold,
                CHART_COLORS.blue,
                CHART_COLORS.green,
                CHART_COLORS.coral,
                CHART_COLORS.plum,
                "#F39C12",
                CHART_COLORS.teal,
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
              position: "right",
              labels: {
                color: "rgba(248, 242, 230, 0.76)",
                font: {
                  family: "Inter",
                  size: 12,
                },
              },
            },
          },
        },
      },
      "No traffic-source data recorded yet."
    );

    createChart(
      "chart-pages",
      {
        type: "bar",
        data: {
          labels: (payload?.top_pages || []).map((row) => row.page || "/"),
          datasets: [
            {
              label: "Views",
              data: (payload?.top_pages || []).map((row) => Number(row.count || 0)),
              backgroundColor: "rgba(122, 12, 30, 0.72)",
              borderColor: CHART_COLORS.wine,
              borderWidth: 1,
              borderRadius: 6,
            },
          ],
        },
        options: {
          ...CHART_DEFAULTS,
          indexAxis: "y",
          plugins: {
            ...CHART_DEFAULTS.plugins,
            legend: {
              display: false,
            },
          },
        },
      },
      "No page ranking data recorded yet."
    );

    createChart(
      "chart-products",
      {
        type: "bar",
        data: {
          labels: (payload?.products || []).map((row) => row.product_key || "unknown"),
          datasets: [
            {
              label: "Clicks",
              data: (payload?.products || []).map((row) => Number(row.count || 0)),
              backgroundColor: "rgba(201, 168, 76, 0.72)",
              borderColor: CHART_COLORS.gold,
              borderWidth: 1,
              borderRadius: 6,
            },
          ],
        },
        options: {
          ...CHART_DEFAULTS,
          plugins: {
            ...CHART_DEFAULTS.plugins,
            legend: {
              display: false,
            },
          },
        },
      },
      "No product-click data recorded yet."
    );
  };

  const renderCountries = (payload) => {
    const tbody = document.getElementById("countries-tbody");
    const summary = document.getElementById("analytics-status");
    if (!tbody) {
      return;
    }

    const countries = Array.isArray(payload?.countries) ? payload.countries : [];
    tbody.innerHTML = countries.length
      ? countries
          .map(
            (row) => `
              <tr>
                <td>${escapeHtml(COUNTRY_NAMES[row.country] || row.country || "Unknown")}</td>
                <td>${escapeHtml(formatNumber(row.count))}</td>
              </tr>
            `
          )
          .join("")
      : `
          <tr>
            <td colspan="2" class="analytics-table-empty">No country data recorded yet.</td>
          </tr>
        `;

    if (summary) {
      summary.textContent = payload?.generated_at
        ? `Updated ${window.formatDateTime(payload.generated_at)}`
        : "Analytics summary loaded.";
    }
  };

  const loadAnalytics = async (days = state.days) => {
    setLoadingState(true);
    state.days = Number(days || 30);

    try {
      if (typeof window.Chart !== "function") {
        throw new Error("Chart.js failed to load");
      }

      const payload = await window.GET(`/api/analytics/summary?days=${state.days}`);
      renderMetricCards(payload);
      renderCharts(payload);
      renderCountries(payload);
    } catch (error) {
      destroyCharts();
      window.showToast(`Failed to load analytics: ${error.message}`, "error");
      const status = document.getElementById("analytics-status");
      if (status) {
        status.textContent = `Failed to load analytics: ${error.message}`;
      }
    } finally {
      setLoadingState(false);
    }
  };

  const renderShell = () => {
    shell.innerHTML = `
      <section class="analytics-dashboard">
        <section class="hero-banner analytics-hero">
          <div class="content-cluster">
            <span class="eyebrow">Section 14</span>
            <h2>Measure what people actually do on the website without handing your traffic data to a third party.</h2>
            <p>
              This dashboard tracks page views, product interest, booking intent, and article engagement
              using first-party events stored in D1. No cookies, no personal data, and no extra SaaS dependency.
            </p>
          </div>
          <div class="hero-actions analytics-toolbar">
            <label class="field analytics-period-field" for="period-select">
              <span>Period</span>
              <select id="period-select">
                <option value="7">Last 7 days</option>
                <option value="30" selected>Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </label>
            <button class="btn btn-secondary" type="button" id="analytics-refresh-btn">Refresh</button>
          </div>
        </section>

        <section class="summary-grid" id="analytics-metrics"></section>

        <div class="analytics-grid">
          <section class="panel-card analytics-chart-card">
            <div class="panel-heading-copy">
              <span class="eyebrow">Page Views Over Time</span>
              <h3>Daily traffic trend</h3>
              <p>Build a quick sense of whether edits, promotions, or publishing activity changed overall traffic.</p>
            </div>
            <div class="analytics-canvas-wrap">
              <canvas id="chart-pageviews"></canvas>
              <div class="analytics-empty" data-empty-for="chart-pageviews" hidden></div>
            </div>
          </section>

          <section class="panel-card analytics-chart-card">
            <div class="panel-heading-copy">
              <span class="eyebrow">Traffic Sources</span>
              <h3>Where visitors came from</h3>
              <p>Shows the referrer domains that actually sent traffic into the site during the selected window.</p>
            </div>
            <div class="analytics-canvas-wrap">
              <canvas id="chart-sources"></canvas>
              <div class="analytics-empty" data-empty-for="chart-sources" hidden></div>
            </div>
          </section>

          <section class="panel-card analytics-chart-card">
            <div class="panel-heading-copy">
              <span class="eyebrow">Top Pages</span>
              <h3>Most visited paths</h3>
              <p>Use this to decide which pages deserve tighter copy, stronger CTAs, or more recent visuals.</p>
            </div>
            <div class="analytics-canvas-wrap">
              <canvas id="chart-pages"></canvas>
              <div class="analytics-empty" data-empty-for="chart-pages" hidden></div>
            </div>
          </section>

          <section class="panel-card analytics-chart-card">
            <div class="panel-heading-copy">
              <span class="eyebrow">Most Clicked Products</span>
              <h3>Product interest signals</h3>
              <p>Counts when a visitor opens a product's More Info panel on the services page.</p>
            </div>
            <div class="analytics-canvas-wrap">
              <canvas id="chart-products"></canvas>
              <div class="analytics-empty" data-empty-for="chart-products" hidden></div>
            </div>
          </section>
        </div>

        <div class="page-grid analytics-bottom-grid">
          <section class="panel-card">
            <div class="panel-heading-copy">
              <span class="eyebrow">Top Countries</span>
              <h3>Country breakdown</h3>
              <p>Country codes come from Cloudflare headers on pageview events only.</p>
            </div>
            <div class="analytics-table-wrap">
              <table class="analytics-table">
                <thead>
                  <tr>
                    <th>Country</th>
                    <th>Page Views</th>
                  </tr>
                </thead>
                <tbody id="countries-tbody"></tbody>
              </table>
            </div>
          </section>

          <section class="panel-card analytics-notes-card">
            <span class="eyebrow">Privacy Model</span>
            <h3>What this dashboard deliberately does not collect</h3>
            <ul class="checklist analytics-checklist">
              <li>No cookies, user IDs, names, emails, or stored IP addresses.</li>
              <li>No third-party analytics tags or ad pixels are required for this dashboard to work.</li>
              <li>Events only store type, page path, referrer domain, product key, CTA label, and country code.</li>
            </ul>
            <p class="analytics-status" id="analytics-status" aria-live="polite">Loading analytics summary...</p>
          </section>
        </div>
      </section>
    `;
  };

  const bindEvents = () => {
    const periodSelect = document.getElementById("period-select");
    const refreshButton = document.getElementById("analytics-refresh-btn");

    periodSelect?.addEventListener("change", (event) => {
      loadAnalytics(Number(event.target.value || 30));
    });

    refreshButton?.addEventListener("click", () => {
      loadAnalytics(state.days);
    });
  };

  renderShell();
  bindEvents();
  loadAnalytics(30);
})(window, document);
