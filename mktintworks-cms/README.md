# MK Tintworks CMS

This directory now holds the CMS implementation through PRD Section 16.
It contains the Access-protected admin shell, shared CMS design system,
Worker-backed module clients, the live visual editor, the products manager,
the gallery manager with client-side image compression, and the new blog
listing/editor workflow with Workers AI SEO generation plus the testimonials
moderation pipeline, promotions banner manager, central media library,
page-level SEO manager, analytics dashboard, invoice generator, and warranty
certificate generator.

## Current structure

- `index.html`
  Cloudflare Access to JWT gateway page for the CMS.
- `dashboard.html`
  Main admin landing page with links into every Phase 1 module.
- `pages/`
  All CMS routes, including the visual editor, products manager, gallery manager, blog listing, blog editor, testimonials moderation, promotions manager, media library, and invoice generator.
- `assets/css/`
  Shared design tokens and shell styles plus module-specific additions such as `cms-gallery.css`, `cms-blog.css`, `cms-promotions.css`, `cms-media.css`, and `cms-invoices.css`.
- `assets/js/`
  Auth bootstrap, shared UI helpers, same-origin API usage, and one script per CMS module.
- `functions/api/[[path]].js`
  Pages Function proxy that forwards `/api/*` requests from the CMS origin to the Worker.
- `assets/images/`
  CMS logo and supporting brand assets used by later operations modules.
- `data/`
  Section baseline and status files used by the visual editor and delivery tracking.

## What Sections 6-16 add

- Section 6:
  Visual editor iframe, page-content API, public-site preview overlay, and build-time content injection.
- Section 7:
  Products manager, discount CRUD, public product hydration, and scheduled discount transitions.
- Section 8:
  Gallery manager UI, shared `compressImage()` reuse, drag-and-drop uploads, edit/delete/reorder flows, a public gallery endpoint, and gallery-state injection into the website build.
- Section 9:
  Blog listing and editor UIs, Word/PDF import in the browser, Workers AI SEO generation, D1-backed article CRUD, public blog APIs, and build-time generation of `/blog/` plus published article pages.
- Section 10:
  Public testimonial submission, moderation tabs in the CMS, approve/reject actions, email notification, and build/runtime delivery of approved reviews to the website.
- Section 11:
  Promotions banner CRUD in the CMS, Worker-backed schedule validation and image uploads, a public active-banner API, and the rotating dismissible sitewide header banner on the website.
- Section 12:
  Media library inventory in the CMS, protected listing and deletion routes, live usage detection across implemented modules, storage tracking, filename search, and orphan cleanup workflows.
- Section 13:
  SEO manager UI for the six main pages, live Google and social previews, OG image upload flow, Worker-backed SEO CRUD, a public SEO feed, and build-time injection of saved metadata into public page source.
- Section 14:
  Analytics dashboard with Chart.js, protected summary aggregation, first-party event capture on the website, CTA/product/blog engagement tracking, and privacy-first reporting without cookies or third-party trackers.
- Section 15:
  Invoice generator UI, Worker-issued sequential invoice numbers, server-side VAT locking, branded pdf-lib invoice output, client and vehicle auto-upserts, and R2-backed invoice PDF storage with WhatsApp/email handoff.
- Section 16:
  Warranty generator UI, unique MK certificate numbering, invoice-prefill lookup, branded pdf-lib warranty output, D1 plus R2 persistence, invoice-to-warranty linking, and WhatsApp/email handoff.

## Runtime model

- CMS pages authenticate through Cloudflare Access, then exchange the Access assertion for a JWT via the Worker.
- CMS module pages call `/api/*` on the same origin; the Pages Function proxy forwards those requests to the Worker.
- The Worker persists structured module data in D1, stores uploaded assets in R2, and triggers the Pages deploy hook after content mutations.
- The public website is still a static site, but Sections 6-16 now inject live state at build time where needed, generate blog article pages directly from Worker-backed content, surface approved testimonials, fetch active promotions at runtime for the shared header banner, expose a protected media inventory for CMS operations, write saved SEO metadata directly into generated HTML for the six core pages, post first-party analytics events back to the Worker for dashboard reporting, and generate branded invoice and warranty PDFs from the Worker for CMS billing and after-sales workflows.

## Deployment note

The main production flow is:

- Deploy the Worker from `mktintworks-cms-api/`
- Build the public site from the repo root with `npm run build`
- Deploy `dist/` to the `mk-tintworks-1` Pages project
- Deploy `mktintworks-cms/` to the `mktintworks-cms` Pages project

## Admin entry point

Until a custom admin hostname is attached to the Pages project, the stable CMS URL is:

- `https://mktintworks-cms.pages.dev`

The intended long-term production admin hostname is:

- `https://admin.mktintworks.com`

Do not use made-up subdomains like `admin.mktintworks-cms.pages.dev`. They are not part of the Pages project unless explicitly attached, and Cloudflare will return the generic "Nothing is here yet" screen.

The Access-protected admin hostname should remain the real CMS entry point so auth
and API requests stay same-origin before the Pages Function proxy forwards them to
the Worker.
