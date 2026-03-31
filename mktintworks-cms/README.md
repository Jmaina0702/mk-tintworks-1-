# MK Tintworks CMS

This directory now holds the CMS implementation through PRD Section 8.
It contains the Access-protected admin shell, shared CMS design system,
Worker-backed module clients, the live visual editor, the products manager,
and the gallery manager with client-side image compression.

## Current structure

- `index.html`
  Cloudflare Access to JWT gateway page for the CMS.
- `dashboard.html`
  Main admin landing page with links into every Phase 1 module.
- `pages/`
  All CMS routes, including the visual editor, products manager, and gallery manager.
- `assets/css/`
  Shared design tokens and shell styles plus module-specific additions such as `cms-gallery.css`.
- `assets/js/`
  Auth bootstrap, shared UI helpers, same-origin API usage, and one script per CMS module.
- `functions/api/[[path]].js`
  Pages Function proxy that forwards `/api/*` requests from the CMS origin to the Worker.
- `assets/images/`
  CMS logo and supporting brand assets used by later operations modules.
- `data/`
  Section baseline and status files, now including Section 8 delivery state.

## What Sections 6-8 add

- Section 6:
  Visual editor iframe, page-content API, public-site preview overlay, and build-time content injection.
- Section 7:
  Products manager, discount CRUD, public product hydration, and scheduled discount transitions.
- Section 8:
  Gallery manager UI, shared `compressImage()` reuse, drag-and-drop uploads, edit/delete/reorder flows, a public gallery endpoint, and gallery-state injection into the website build.

## Runtime model

- CMS pages authenticate through Cloudflare Access, then exchange the Access assertion for a JWT via the Worker.
- CMS module pages call `/api/*` on the same origin; the Pages Function proxy forwards those requests to the Worker.
- The Worker persists structured module data in D1, stores uploaded assets in R2, and triggers the Pages deploy hook after content mutations.
- The public website is still a static site, but Sections 6-8 now inject live state at build time and refresh selected modules at runtime.

## Deployment note

The main production flow is:

- Deploy the Worker from `mktintworks-cms-api/`
- Build the public site from the repo root with `npm run build`
- Deploy `dist/` to the `mk-tintworks-1` Pages project
- Deploy `mktintworks-cms/` to the `mktintworks-cms` Pages project

The Access-protected admin hostname should remain the real CMS entry point so auth
and API requests stay same-origin before the Pages Function proxy forwards them to
the Worker.
