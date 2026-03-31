# MK Tintworks CMS

This directory now holds the CMS implementation through PRD Section 6.
It includes the Cloudflare-authenticated admin entry page, dashboard,
all Phase 1 module routes, the shared design system, and the live visual
editor that talks to the Worker-backed page-content API.

## Current structure

- `index.html`
  Cloudflare Access to JWT gateway page for the CMS.
- `dashboard.html`
  Main admin landing page with links into every Phase 1 module.
- `pages/`
  All module routes, including the Section 6 visual editor workspace.
- `assets/css/`
  Shared design tokens, layout, sidebar, components, tables, forms, badges,
  modals, toasts, and animation files.
- `assets/js/`
  Auth helper, shared UI/bootstrap utilities, auth gateway logic, dashboard,
  one script per module page, and the visual-editor client.
- `assets/images/`
  CMS logo plus the copied M-Pesa and Equity logos requested for later payment
  and document flows.
- `data/`
  Section baseline and status files from earlier PRD work.

## What Section 6 adds

- The iframe-based visual editor at `pages/visual-editor.html`.
- Same-origin-friendly CMS auth/API bootstrapping for an Access-protected admin host.
- A Pages Function proxy at `functions/api/[[path]].js` so CMS requests can stay on the same origin while forwarding to the Worker.
- Public-site preview overlay messaging via `cms-preview-overlay.js`.
- Worker-backed `GET /api/pages/content`, `POST /api/pages/update`, and image upload wiring.
- A root-site build pipeline that injects `window.CMS_PAGE_CONTENT` and `window.CMS_SHARED_CONTENT` into the website output.

## What still comes later

- Real D1-backed listing and save flows for each module.
- Deeper CRUD flows beyond the visual editor for products, blog, testimonials, and records.
- PDF generation for invoices and warranties.
- Approval workflows, richer publishing controls, and reporting depth.

## Deployment note

The CMS login exchange is designed to work when the Worker is reachable through
the same Access-protected admin origin. The local code now stops hardcoding the
raw Worker URL in page templates, and the CMS project includes a Pages Function
proxy for `/api/*`, so a host such as `https://admin.mktintworks.com` or the
Pages domain can keep auth and API traffic same-origin while forwarding to the
Worker.

For the public website build, use `npm run build` from the repo root and deploy
the generated `dist/` directory.
