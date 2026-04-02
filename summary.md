# MK Tintworks CMS and Website Summary

This repository now implements the MK Tintworks custom CMS architecture through PRD Section 20 on top of the original static marketing site.

## Current system

- Public website:
  Static HTML, CSS, and JavaScript in the repo root, built into `dist/` for Cloudflare Pages.
- CMS admin app:
  Static Pages app in [`mktintworks-cms`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms) protected by Cloudflare Access.
- Backend API:
  Cloudflare Worker in [`mktintworks-cms-api`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api) backed by D1, R2, KV, and Workers AI bindings.
- Persistence:
  D1 stores structured content and module records. R2 stores uploaded media/documents. KV supports cached content and sessions.
- Deployment model:
  The Worker can trigger a deploy hook after content mutations so the public Pages site updates after save operations.

## Sections completed

- Section 1:
  Project goals, system scope, and target Cloudflare architecture were mapped from the PRD into the repo baseline.
- Section 2:
  Core infrastructure bindings were wired: Worker, D1, R2, KV, deploy hook, and observed Pages projects.
- Section 3:
  The D1 schema was established for pages, products, discounts, gallery, blog, testimonials, promotions, media, SEO, invoices, warranties, and records.
- Section 4:
  Cloudflare Access to Worker JWT exchange was implemented so protected CMS API requests require both Access and JWT.
- Section 5:
  The CMS shell, shared design system, page routing, sidebar, topbar, modals, toasts, tables, and form primitives were built.
- Section 6:
  The live visual editor and page-content API were implemented, including iframe preview, editable key mapping, content persistence, and site build injection.
- Section 7:
  The products manager and discount system were implemented, including live public hydration and scheduled discount activation/expiry.
- Section 8:
  The gallery manager and image pipeline were implemented, including drag-and-drop uploads, shared client compression, D1-backed gallery CRUD, public gallery API, gallery runtime refresh, and initial gallery seeding.
- Section 9:
  The blog system and Workers AI integration were implemented, including the CMS article list, rich editor, browser-side Word/PDF import, AI SEO generation, article CRUD, public blog APIs, and build-time generation of public blog pages.
- Section 10:
  The testimonials pipeline was implemented, including the public review form, honeypot and validation layers, Worker-backed moderation routes, email notification, CMS approval/rejection UI, and build-time rendering of approved public testimonials.
- Section 11:
  The promotions and announcements banner system was implemented, including the CMS banner manager, Worker-backed scheduling and image upload routes, and the public sitewide rotating banner rendered above the main navigation.
- Section 12:
  The media library was implemented, including protected inventory listing, storage usage reporting, live usage detection, copy URL actions, orphan filtering, and best-effort media deletion from R2 plus D1.
- Section 13:
  The SEO Manager was implemented, including per-page search metadata editing for the six main website pages, OG image upload, live Google and social previews, protected SEO CRUD routes, a public SEO feed, and build-time injection of saved metadata into generated public page source.
- Section 14:
  The analytics dashboard was implemented, including first-party website event tracking, a protected summary endpoint, Chart.js-backed CMS reporting, product-click and CTA tracking, and country/referrer aggregation without cookies or personal data.
- Section 15:
  The invoice generator was implemented, including Worker-issued invoice numbering, VAT-aware totals, branded pdf-lib PDF output, D1 plus R2 persistence, client and vehicle auto-upserts, and WhatsApp/email handoff from the CMS.
- Section 16:
  The warranty certificate generator was implemented, including unique MK certificate numbering, invoice-prefill support, branded pdf-lib warranty PDFs, D1 plus R2 persistence, invoice-to-warranty linking, and WhatsApp/email handoff from the CMS.
- Section 17:
  The records system was implemented, including protected invoice, warranty, and client archive endpoints; searchable CMS tabs; invoice revenue summaries; CSV export; PDF re-download for stored documents; and invoice deletion with strong confirmation.
- Section 18:
  The sales dashboard was implemented, including a protected invoice-backed summary endpoint, Chart.js CMS reporting, collected versus outstanding revenue tracking, film revenue ranking, payment and service mix charts, outstanding invoice visibility, and top-client spend ranking.
- Section 19:
  The real-time sync architecture was implemented, including centralized CORS middleware, shared KV cache-key conventions, Worker-side cache priming for pages/products/blog/SEO/promotions/discounts, shared deploy-hook triggering, finalized Worker configuration, and normalized upload-security utilities for the D1 to KV to Pages content pipeline.
- Section 20:
  The PRD completion and handover milestone was implemented, including session-only CMS JWT storage, warranty-generation failure handling that avoids deleting persisted warranty rows, final deployment and checklist metadata, and dashboard/readme updates that mark the system complete.

## Architecture

### 1. CMS request flow

1. A user opens the CMS Pages app.
2. Cloudflare Access gates the admin origin.
3. The CMS app exchanges the Access assertion for a Worker-issued JWT.
4. CMS pages call `/api/*` on the same origin.
5. [`functions/api/[[path]].js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/functions/api/%5B%5Bpath%5D%5D.js) proxies those requests to the Worker.
6. The Worker validates JWT on protected endpoints, reads or mutates D1/R2, and can trigger the public-site deploy hook.

### 2. Public website flow

1. Root HTML files remain static and fast by default.
2. [`scripts/build-site.mjs`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/scripts/build-site.mjs) pulls live CMS state from the Worker at build time.
3. The build injects `window.CMS_PAGE_CONTENT`, `window.CMS_SHARED_CONTENT`, `window.CMS_PRODUCTS_STATE`, `window.CMS_GALLERY_STATE`, and `window.CMS_TESTIMONIALS_STATE` into the generated Pages output.
4. The build now also generates the public blog index and each published blog article from Worker-backed blog data.
5. Client scripts such as [`assets/js/cms-content.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/assets/js/cms-content.js), [`assets/js/services.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/assets/js/services.js), [`assets/js/gallery.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/assets/js/gallery.js), and [`assets/js/main.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/assets/js/main.js) can then refresh selected data at runtime with cache-bypassed fetches where needed.
6. The shared public header runtime now fetches `GET /api/promotions/active` and renders a dismissible rotating banner above the navigation when any scheduled promotion is currently live.
7. The build also now fetches `GET /api/seo/public` so saved page-level titles, descriptions, canonical URLs, OG tags, and Twitter card tags are written into the generated HTML for the six core pages.
8. The built public site now also injects a first-party analytics tracker script into every deployed page so page views, product interest, CTA clicks, and blog reads can be posted to `POST /api/analytics/event`.

### 3. Storage model

- D1:
  Structured records for page copy, products, discounts, gallery items, blog posts, testimonials, promotions, media metadata, SEO settings, clients, vehicles, invoices, warranties, and records.
- R2:
  Public media uploads and private document files.
- KV:
  Cached page-content snapshots, session-related state, and the 60-second cached public promotions feed.

## Section 8 details

### CMS gallery manager

- Page:
  [`mktintworks-cms/pages/gallery.html`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/pages/gallery.html)
- Client:
  [`mktintworks-cms/assets/js/gallery.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/assets/js/gallery.js)
- Styles:
  [`mktintworks-cms/assets/css/cms-gallery.css`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/assets/css/cms-gallery.css)

Implemented behavior:

- Drag-and-drop and click-to-browse upload zone
- Shared browser-side compression via [`cms-utils.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/assets/js/cms-utils.js)
- 150KB gallery compression target with WebP-first output
- Caption and category entry on upload
- D1-backed gallery load
- Filter buttons for all, automotive, residential, and commercial
- Edit modal for caption, category, and placeholder state
- Delete flow with confirmation
- Drag-to-reorder with persisted order updates
- Placeholder badge rendering for seeded launch images

### Worker gallery API

Primary route:
[`mktintworks-cms-api/src/routes/gallery.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api/src/routes/gallery.js)

Endpoints:

- `GET /api/gallery`
  Protected CMS listing
- `POST /api/gallery/upload`
  Protected multipart upload to R2 plus D1 insert
- `POST /api/gallery/update`
  Protected caption/category/placeholder update
- `DELETE /api/gallery/:id`
  Protected delete with best-effort R2 cleanup
- `POST /api/gallery/reorder`
  Protected order persistence
- `GET /api/gallery/public`
  Public gallery feed for the website

Important implementation details:

- Gallery reads now send no-store cache headers.
- Gallery URLs normalize both public-site asset paths and R2-backed uploads.
- Reorder now respects the submitted ranking instead of relying only on array position.
- Public seeded images are safe to delete from the gallery because R2 cleanup only runs for managed uploads under the configured media bucket base URL.

### Initial gallery seeding

- Seed file:
  [`section8-gallery-seed.sql`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api/section8-gallery-seed.sql)
- Result:
  10 placeholder gallery rows inserted into remote D1 on March 31, 2026.

The seed uses the existing public gallery images as launch content and marks them `is_placeholder = 1` so they are visibly replaceable inside the CMS.

## Section 9 details

### CMS blog system

- Listing page:
  [`mktintworks-cms/pages/blog.html`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/pages/blog.html)
- Editor page:
  [`mktintworks-cms/pages/blog-editor.html`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/pages/blog-editor.html)
- Clients:
  [`mktintworks-cms/assets/js/blog.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/assets/js/blog.js) and [`mktintworks-cms/assets/js/blog-editor.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/assets/js/blog-editor.js)
- Styles:
  [`mktintworks-cms/assets/css/cms-blog.css`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/assets/css/cms-blog.css)

Implemented behavior:

- CMS article table with published/draft totals
- New article flow and existing article load by id
- Rich-text editing with heading, list, and link controls
- Browser-side `.docx` import via Mammoth
- Browser-side `.pdf` text extraction via PDF.js
- AI SEO generation against Cloudflare Workers AI
- Manual SEO editing and live character counters
- Featured image upload through the existing media pipeline
- Draft save, publish, and delete flows
- Slug validation and uniqueness enforcement

### Worker blog API

Primary route:
[`mktintworks-cms-api/src/routes/blog.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api/src/routes/blog.js)

Endpoints:

- `GET /api/blog`
  Protected CMS listing
- `GET /api/blog/:id`
  Protected single-article load for the editor
- `POST /api/blog/save`
  Protected create/update for drafts and published posts
- `DELETE /api/blog/:id`
  Protected delete
- `POST /api/blog/generate-seo`
  Protected Workers AI SEO generation
- `GET /api/blog/public`
  Public published-article feed with optional `full=1` for build generation

Important implementation details:

- The Worker keeps blog publishing usable even if Workers AI is unavailable, because AI metadata generation is optional rather than required.
- Published article routes are public, but all CMS write/read routes still require JWT auth.
- The only real legacy static article bodies in the repo were the two long-form pages already synced back into D1: `3m-vs-llumar-kenya` and `ntsa-tint-regulations-kenya-2026`.
- The old `blog/index.html` marketing cards for two extra slugs were placeholder links, not CMS-backed articles, and the fallback index now avoids advertising unsynced posts if a build-time fetch fails.

### Public blog generation

- Template source:
  [`blog/index.html`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/blog/index.html)
- Build pipeline:
  [`scripts/build-site.mjs`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/scripts/build-site.mjs)

Section 9 changes the public blog flow from hardcoded static pages to Worker-backed build output:

- `/blog/` is rendered from the published rows in `blog_posts`
- `/blog/[slug].html` is generated at build time for each published article
- related-article cards, metadata, JSON-LD, hero image, and article body now come from D1-backed blog content
- the public Pages project `mk-tintworks-1` now runs `npm run build` and deploys `dist/`, so deploy hooks publish generated blog output instead of raw source files

## Section 10 details

### Public testimonials experience

- Page:
  [`testimonials.html`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/testimonials.html)
- Client:
  [`assets/js/testimonials.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/assets/js/testimonials.js)
- Styles:
  [`assets/css/main.css`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/assets/css/main.css)

Implemented behavior:

- Approved testimonials render into the public page from Worker-backed state
- The public page still has a static empty-state fallback if no reviews are approved yet
- Visitors can submit name, service type, star rating, and review text from the live site
- The form uses a hidden honeypot field, client-side validation, and live character counting
- Runtime refresh can pull the latest approved testimonials from the Worker without breaking the static fallback

### CMS testimonials moderation

- Page:
  [`mktintworks-cms/pages/testimonials.html`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/pages/testimonials.html)
- Client:
  [`mktintworks-cms/assets/js/testimonials.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/assets/js/testimonials.js)
- Styles:
  [`mktintworks-cms/assets/css/cms-testimonials.css`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/assets/css/cms-testimonials.css)

Implemented behavior:

- Pending, approved, and rejected tabs now render from live Worker data instead of placeholder demo rows
- The sidebar pending badge and the module tab badge now reflect real pending-review counts
- Approve actions promote a review into the public feed and trigger the public-site deploy hook
- Reject actions remove a live review from public output or keep a pending one hidden
- Rejected reviews can be restored by approving them again, which appends them back into the display order

### Worker testimonials API

Primary route:
[`mktintworks-cms-api/src/routes/testimonials.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api/src/routes/testimonials.js)

Endpoints:

- `POST /api/testimonials/submit`
  Public submission endpoint with honeypot handling, validation, and submission throttling
- `GET /api/testimonials/public`
  Public approved-only feed for the website and build pipeline
- `GET /api/testimonials`
  Protected CMS listing across all statuses
- `GET /api/testimonials/pending-count`
  Protected pending-count endpoint for CMS badges
- `POST /api/testimonials/approve`
  Protected moderation action to publish a testimonial
- `POST /api/testimonials/reject`
  Protected moderation action to hide a testimonial

Important implementation details:

- Submissions remain one of the few public CMS endpoints and now include both honeypot protection and KV-backed throttling by client IP when available
- Notification emails are sent server-side through Web3Forms using Worker secrets, so the business email is not exposed in client-side code
- Approved testimonials are injected into the static build so the public testimonials page updates after moderation-triggered rebuilds rather than depending only on runtime fetches

## Section 11 details

### CMS promotions manager

- Page:
  [`mktintworks-cms/pages/promotions.html`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/pages/promotions.html)
- Client:
  [`mktintworks-cms/assets/js/promotions.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/assets/js/promotions.js)
- Styles:
  [`mktintworks-cms/assets/css/cms-promotions.css`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/assets/css/cms-promotions.css)

Implemented behavior:

- Live promotions dashboard with totals for active, scheduled, paused, and expired banners
- Create and edit modal for title, schedule, CTA link, season labeling, animation type, display duration, and active state
- Canva-export banner upload with browser-side compression, preview, and Worker-backed media storage
- Delete flow with confirmation and active-banner visibility notes for admins
- Same-origin CMS API usage through the existing Access plus JWT gateway

### Worker promotions API

Primary route:
[`mktintworks-cms-api/src/routes/promotions.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api/src/routes/promotions.js)

Endpoints:

- `GET /api/promotions`
  Protected CMS listing
- `GET /api/promotions/:id`
  Protected single-banner load
- `POST /api/promotions/save`
  Protected create/update for promotion records
- `POST /api/promotions/upload-image`
  Protected image upload to R2 plus media-table insert
- `DELETE /api/promotions/:id`
  Protected delete
- `GET /api/promotions/active`
  Public active-banner feed for the live website

Important implementation details:

- Protected routes still require JWT auth, while the public site only gets the active-feed endpoint
- Banner validation covers scheduling, season labels, animation type, image safety, CTA URLs, and display-duration limits
- Promotion uploads are compressed client-side and then rejected server-side if the final payload still exceeds the configured size ceiling
- The active public feed is cached in KV for 60 seconds and invalidated on save/delete mutations
- Active-banner responses normalize image URLs so both R2 uploads and safe public asset paths render correctly on the website

### Public promotions banner runtime

- Client:
  [`assets/js/main.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/assets/js/main.js)
- Styles:
  [`assets/css/main.css`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/assets/css/main.css)

Implemented behavior:

- Every public page using the shared header can render a full-width promotions bar above the main navigation
- Multiple active banners rotate using each banner's configured `display_duration`
- Dismissal is session-scoped with `sessionStorage`, so closing the banner hides it until the browser session ends
- The runtime supports the PRD animation set with banner-specific classes and keeps the mobile nav offset aligned with the real header height
- If no promotion is currently active, the header stays unchanged and no empty placeholder bar is rendered

## Section 12 details

### CMS media library

- Page:
  [`mktintworks-cms/pages/media.html`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/pages/media.html)
- Client:
  [`mktintworks-cms/assets/js/media.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/assets/js/media.js)
- Styles:
  [`mktintworks-cms/assets/css/cms-media.css`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/assets/css/cms-media.css)

Implemented behavior:

- Central file inventory for every media-table row written by CMS upload flows
- Storage usage meter against the 10 GB Cloudflare R2 free-tier limit
- Filter tabs for all files, images, documents, and unused assets
- Filename search with live result counts
- Image thumbnail rendering plus PDF fallback cards
- One-click CDN URL copy flow
- Delete flow with stronger warnings when a file is still referenced
- Orphan highlighting based on live module references rather than upload-time tags alone

### Worker media API

Primary route:
[`mktintworks-cms-api/src/routes/media.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api/src/routes/media.js)

Endpoints:

- `GET /api/media`
  Protected CMS listing with normalized `used_in` output
- `DELETE /api/media/:id`
  Protected delete from D1 with best-effort R2 cleanup
- `POST /api/media/upload-image`
  Existing protected shared image-upload route preserved for the visual editor and blog flows

Important implementation details:

- Media listing now derives usage from live references in pages, gallery, products, blog posts, promotions, and SEO settings instead of trusting only the stored upload metadata.
- Stored `used_in` values still act as fallback labels for future modules that may write into the media table before their own Section PRDs are implemented.
- Section 12 does not add a new public website runtime. It is a protected CMS operations surface only.

## Section 13 details

### CMS SEO manager

- Page:
  [`mktintworks-cms/pages/seo.html`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/pages/seo.html)
- Client:
  [`mktintworks-cms/assets/js/seo.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/assets/js/seo.js)
- Styles:
  [`mktintworks-cms/assets/css/cms-seo.css`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/assets/css/cms-seo.css)

Implemented behavior:

- Page selector for the six PRD-defined public routes: home, services, gallery, testimonials, blog, and book
- Editable meta title and meta description with live character counters
- Editable OG title and OG description with fallback-to-search-field behavior when left blank
- OG image upload with immediate local preview before save
- Live Google-style search preview and WhatsApp/Facebook-style share card preview
- Save flow that uploads a compressed OG image when needed, stores SEO settings, and surfaces rebuild status feedback inside the CMS
- Metrics cards showing coverage across the six controlled pages

### Worker SEO API

Primary route:
[`mktintworks-cms-api/src/routes/seo.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api/src/routes/seo.js)

Endpoints:

- `GET /api/seo/:slug`
  Protected single-page SEO load for the CMS
- `POST /api/seo/save`
  Protected create/update for page SEO settings with deploy-hook trigger
- `POST /api/seo/upload-og-image`
  Protected OG image upload to R2 plus `media` table insert
- `GET /api/seo/public`
  Public feed returning all six page SEO rows for the static build

Important implementation details:

- Protected SEO routes still require JWT auth, while the public site only consumes the read-only `/api/seo/public` endpoint.
- The Worker restricts SEO edits to the six approved page slugs from the PRD instead of allowing arbitrary page names.
- Public SEO responses always return all six page keys, even if a row is missing, so the build pipeline has deterministic coverage.
- OG image uploads are recorded in the shared `media` table with `used_in = ["seo"]`, which keeps the Media Library usage view accurate.
- Saving SEO settings triggers the public-site deploy hook so the next Pages build can publish the updated page source.

### Public SEO build injection

- Build pipeline:
  [`scripts/build-site.mjs`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/scripts/build-site.mjs)

Section 13 changes the public metadata flow from manually maintained static tags to Worker-backed build output for the six main pages:

- `index.html`, `services.html`, `gallery.html`, `testimonials.html`, `book.html`, and `blog/index.html` now pull their SEO settings from the Worker during `npm run build`
- saved SEO values overwrite the generated `<title>`, `meta name="description"`, canonical URL, Open Graph tags, and Twitter card tags in `dist/`
- if the SEO endpoint is unavailable during a build, the script preserves the existing static fallback tags instead of breaking the page output

## Section 14 details

### CMS analytics dashboard

- Page:
  [`mktintworks-cms/pages/analytics.html`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/pages/analytics.html)
- Client:
  [`mktintworks-cms/assets/js/analytics.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/assets/js/analytics.js)
- Styles:
  [`mktintworks-cms/assets/css/cms-analytics.css`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/assets/css/cms-analytics.css)

Implemented behavior:

- Protected analytics dashboard with a 7/30/90-day period selector
- Summary cards for page views, product clicks, booking-intent clicks, and article reads
- Chart.js visualizations for daily page views, traffic sources, top pages, and most-clicked products
- Country breakdown table sourced from Cloudflare country headers on pageview events
- Empty-state handling so low-data periods do not break chart rendering
- Privacy-first reporting copy that makes the no-cookie, no-personal-data scope explicit inside the CMS

### Worker analytics API

Primary route:
[`mktintworks-cms-api/src/routes/analytics.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api/src/routes/analytics.js)

Endpoints:

- `POST /api/analytics/event`
  Public event-ingest endpoint for the live website
- `GET /api/analytics/summary?days=7|30|90`
  Protected aggregated dashboard endpoint for the CMS

Important implementation details:

- Event ingestion remains public and intentionally silent on malformed payloads so analytics never creates user-visible website errors.
- Protected summary reads still require JWT auth and return `401` without a valid CMS session.
- The analytics table now stores CTA `label` values in addition to event type, page path, referrer, product key, country, and timestamp.
- Summary aggregation uses D1 directly for totals, top pages, sources, products, and top countries over the selected period.
- Daily page-view output is gap-filled so the dashboard line chart can show every day in the selected window, even when some days had zero events.

### Public analytics tracker

- Tracker script:
  [`assets/js/analytics-tracker.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/assets/js/analytics-tracker.js)
- Product card runtime:
  [`assets/js/services-products.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/assets/js/services-products.js)
- Booking flow hook:
  [`assets/js/booking.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/assets/js/booking.js)
- Build pipeline:
  [`scripts/build-site.mjs`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/scripts/build-site.mjs)

Section 14 adds first-party website tracking without Google Analytics or cookies:

- every built public HTML page now includes the shared analytics tracker before `</body>`
- `pageview` fires on page load
- `product_click` fires when a visitor opens a services-page More Info panel for a product card
- `cta_click` fires for booking-oriented CTAs and the booking-form submission flow, while WhatsApp CTA clicks are labeled separately
- `blog_read` fires once a visitor scrolls at least 50% through a generated blog article page
- legacy static blog-page fallback copies also receive the tracker during the build, so analytics does not disappear if article generation ever falls back

## Section 15 details

### CMS invoice generator

- Page:
  [`mktintworks-cms/pages/invoices.html`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/pages/invoices.html)
- Client:
  [`mktintworks-cms/assets/js/invoices.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/assets/js/invoices.js)
- Styles:
  [`mktintworks-cms/assets/css/cms-invoices.css`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/assets/css/cms-invoices.css)

Implemented behavior:

- Worker-issued next invoice number shown on page load using the `MKT-YYYY-NNN` format
- Service date defaults to today, registration numbers auto-uppercase, and payment-method buttons behave as a true segmented control
- Film dropdown pulls the 10 live product rows from D1 and auto-fills the unit price from each product's base price
- Subtotal, VAT at 16%, and grand total recalculate live as the operator changes units or price
- Existing clients load into a datalist and can backfill saved phone, email, and most recent vehicle details when selected
- Generate action requests the PDF from the Worker, then reveals WhatsApp, email, and direct-download handoff controls once the blob is returned

### Worker invoice API

Primary route:
[`mktintworks-cms-api/src/routes/invoices.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api/src/routes/invoices.js)

Endpoints:

- `GET /api/invoices/next-number`
  Protected next-number preview for the CMS
- `POST /api/invoices/generate`
  Protected PDF-generation and invoice-save endpoint
- `GET /api/records/clients`
  Protected client lookup endpoint used by the invoice form autocomplete

Important implementation details:

- Invoice totals and VAT are recalculated server-side before save, so the Worker stays the commercial source of truth instead of trusting browser math.
- Historical VAT is stored per invoice in the `invoices` table using `vat_rate`, `vat_amount`, and `total_amount`, so later rate changes do not affect old documents.
- Invoice numbering is generated from existing D1 invoice rows at request time and retried on insert conflict, which avoids reusing stale form numbers if two sessions collide.
- The Worker creates or updates the `clients` row, links or inserts the `vehicles` row by registration number, writes the invoice row, uploads the PDF to `DOCUMENTS_BUCKET`, and then stores the `pdf_r2_key`.

### Worker PDF generator

- Generator:
  [`mktintworks-cms-api/src/pdf/invoice-generator.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api/src/pdf/invoice-generator.js)

Section 15 adds a branded invoice document generated directly inside the Cloudflare Worker with `pdf-lib`:

- A4 layout with MK Tintworks wine-and-gold header, footer, totals block, payment block, and notes section
- No third-party PDF API dependency; document rendering stays fully under repo control
- Binary PDF response is streamed straight back to the CMS so the admin can download or hand it off immediately after save

## Section 16 details

### CMS warranty generator

- Page:
  [`mktintworks-cms/pages/warranty.html`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/pages/warranty.html)
- Client:
  [`mktintworks-cms/assets/js/warranty.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/assets/js/warranty.js)
- Styles:
  [`mktintworks-cms/assets/css/cms-warranty.css`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/assets/css/cms-warranty.css)

Implemented behavior:

- Standalone warranty form accessible from the CMS sidebar
- `issue_date` defaults to today on page load
- Optional invoice-prefill flow through `?invoice_id=...` using a protected invoice lookup endpoint
- Pre-fill notice rendered when the page is opened from an invoice context
- Registration input auto-uppercasing in the browser
- Required-field validation for client, film, install date, issue date, warranty period, coverage, and exclusions
- Certificate-number display updated from the Worker response header after successful generation
- Send-via-WhatsApp, send-via-email, and direct-download handoff after the PDF is generated

### Invoice-to-warranty bridge

- Invoice page:
  [`mktintworks-cms/pages/invoices.html`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/pages/invoices.html)
- Invoice client:
  [`mktintworks-cms/assets/js/invoices.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/assets/js/invoices.js)

Section 16 also adds a direct bridge from the invoice generator into the warranty generator:

- the invoice Worker response now returns `X-MKT-Invoice-Id`
- the invoice send-actions card now includes an `Open Warranty Form` action
- that action opens the warranty generator with `invoice_id` in the query string so the shared customer, vehicle, film, service date, and invoice reference fields can be pre-filled immediately

### Worker warranty API

Primary route:
[`mktintworks-cms-api/src/routes/warranties.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api/src/routes/warranties.js)

Endpoints:

- `POST /api/warranties/generate`
  Protected PDF-generation and warranty-save endpoint
- `GET /api/invoices/:id`
  Protected single-invoice lookup used for warranty prefill

Important implementation details:

- Certificate numbers are generated with the safe charset `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, prefixed with `MK`, and checked against D1 for uniqueness before issue.
- Warranty generation reuses the client and vehicle upsert logic from the invoice workflow so standalone warranty creation still stays traceable in records.
- When a linked invoice already has a `warranty_id`, the Worker rejects duplicate issuance instead of silently generating a second legal document for the same invoice.
- Warranty PDFs are uploaded to `DOCUMENTS_BUCKET` under `documents/warranty-MKxxxxxxxx.pdf`, and the final `pdf_r2_key` is written back into the `warranties` table.
- If generation fails after the warranty row is inserted, the Worker performs best-effort cleanup of the D1 row and invoice link so the certificate store does not accumulate partial records.

### Certificate number utility

- Utility:
  [`mktintworks-cms-api/src/utils/cert-number.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api/src/utils/cert-number.js)

Section 16 adds a dedicated certificate-number generator that:

- uses secure random bytes instead of `Math.random()`
- produces `MK` plus 8 safe characters
- retries uniqueness checks up to 20 times before failing hard

### Worker warranty PDF generator

- Generator:
  [`mktintworks-cms-api/src/pdf/warranty-generator.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api/src/pdf/warranty-generator.js)

Section 16 adds a branded warranty certificate generated directly inside the Cloudflare Worker with `pdf-lib`:

- A4 layout with gold outer border, wine inner border, branded header, centered title, and prominent certificate number
- structured client, vehicle, film, invoice-reference, installation-date, and issue-date presentation
- separate coverage and exclusion panels plus optional notes and signature/footer copy

## Section 17 details

### CMS records archive

- Page:
  [`mktintworks-cms/pages/records.html`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/pages/records.html)
- Client:
  [`mktintworks-cms/assets/js/records.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/assets/js/records.js)
- Styles:
  [`mktintworks-cms/assets/css/cms-records.css`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/assets/css/cms-records.css)

Implemented behavior:

- Three-tab archive browser for invoices, warranties, and clients
- Shared search box, date filters, clear action, and CSV export across the archive
- Revenue summary cards for collected paid revenue, unpaid outstanding revenue, and total jobs
- Invoice tab actions for stored-PDF re-download, warranty-form handoff, and invoice deletion with strong confirmation
- Warranty tab actions for stored certificate re-download with no delete option
- Client tab aggregation showing vehicles, job count, total spend, and first-service date
- Revenue summary automatically hidden on non-invoice tabs while invoice-only status filtering is disabled outside the invoice view

### Worker records API

- Route:
  [`mktintworks-cms-api/src/routes/records.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api/src/routes/records.js)

Endpoints:

- `GET /api/records/invoices`
  Protected invoice archive listing
- `GET /api/records/warranties`
  Protected warranty archive listing
- `GET /api/records/clients`
  Protected client archive listing plus invoice-form autocomplete data

Important implementation details:

- Client records now return both archive aggregates and the `vehicles` array used by the invoice generator autocomplete, so the records archive and invoice form stay on one source of truth.
- Client archive aggregates are derived from invoice totals and service dates, while registrations are assembled from linked vehicle rows without duplicating vehicle plates in the display string.
- Invoice archive rows expose payment status, totals, registration number, and stored document key so the UI can filter, summarize, export, and re-download without extra round trips.

### Invoice and warranty document endpoints

- Invoice routes:
  [`mktintworks-cms-api/src/routes/invoices.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api/src/routes/invoices.js)
- Warranty routes:
  [`mktintworks-cms-api/src/routes/warranties.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api/src/routes/warranties.js)

Section 17 extends the existing document routes with archive operations:

- `GET /api/invoices/pdf/:invoice_number`
  Protected re-download of stored invoice PDFs from `DOCUMENTS_BUCKET`
- `GET /api/warranties/pdf/:certificate_number`
  Protected re-download of stored warranty PDFs from `DOCUMENTS_BUCKET`
- `DELETE /api/invoices/:id`
  Protected invoice deletion plus best-effort PDF cleanup from the documents bucket

The deletion flow intentionally applies only to invoices. Warranty certificates remain permanent archive records and the CMS does not expose any delete path for them.

## Section 18 details

### CMS sales dashboard

- Page:
  [`mktintworks-cms/pages/sales.html`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/pages/sales.html)
- Client:
  [`mktintworks-cms/assets/js/sales.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/assets/js/sales.js)
- Styles:
  [`mktintworks-cms/assets/css/cms-sales.css`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/assets/css/cms-sales.css)

Implemented behavior:

- Section 18 replaces the old placeholder Sales shell with a live financial dashboard inside the CMS.
- Period selector supports `Last 30 days`, `Last 90 days`, `This Year`, and `All Time`.
- Summary cards now show collected revenue, outstanding revenue, average job value, and total jobs from invoice data.
- Chart.js visualizations now render a six-month monthly revenue trend, film revenue ranking, payment method split, and service type split.
- The monthly trend intentionally stays fixed to the last six calendar months even when the period selector changes.
- Outstanding invoices render in a sortable table with client names, amounts due, payment status, service date, and overdue-day highlighting.
- Top clients now render as a ranked spend list with visible contribution bars.

### Worker sales API

- Route:
  [`mktintworks-cms-api/src/routes/sales.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api/src/routes/sales.js)

Endpoint:

- `GET /api/sales/summary?period=30|90|365|all`
  Protected invoice-backed sales summary for the CMS dashboard

Important implementation details:

- The sales dashboard reads from the existing `invoices` table only. No separate financial-tracking table was introduced.
- Collected revenue sums invoices marked `paid`, while outstanding revenue sums invoices marked `unpaid` or `partial`.
- The Worker zero-fills the last six calendar months so the monthly trend always renders a stable six-point series.
- Product performance ranks by total invoice revenue per `film_used`, while payment and service splits count invoices in the selected period.
- Outstanding invoices remain all-time so overdue work stays visible even when the selected reporting period is narrow.
- The endpoint is protected by the same Access plus JWT flow as the rest of the CMS business surfaces and returns `401` without a valid token.

## Section 19 details

### Worker sync architecture

- Entry point:
  [`mktintworks-cms-api/src/index.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api/src/index.js)
- CORS middleware:
  [`mktintworks-cms-api/src/middleware/cors.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api/src/middleware/cors.js)
- Shared cache and deploy helpers:
  [`mktintworks-cms-api/src/utils/cache.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api/src/utils/cache.js)
- Shared HTTP wrapper:
  [`mktintworks-cms-api/src/utils/http.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api/src/utils/http.js)
- Final Worker config:
  [`mktintworks-cms-api/wrangler.toml`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api/wrangler.toml)

Implemented behavior:

- Section 19 centralizes CORS handling in middleware instead of scattering origin logic inside response helpers.
- Allowed origins now explicitly cover the production admin and website domains, local development hosts, and project-specific Pages preview hosts.
- The Worker now exposes a protected `GET /api/auth/verify` endpoint so JWT session validity can be checked cleanly.
- Shared cache helpers now define the KV key convention for `page:{slug}`, `product:{key}`, `blog:published`, `seo:{slug}`, `active_promotions`, and `active_discounts`.
- Shared deploy-hook triggering is now centralized so save operations can update D1, prime KV, and trigger Pages rebuilds through one reusable helper.

### KV-first read paths

- Page cache:
  [`mktintworks-cms-api/src/routes/pages.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api/src/routes/pages.js)
- Product and discount cache priming:
  [`mktintworks-cms-api/src/utils/catalog.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api/src/utils/catalog.js)
  [`mktintworks-cms-api/src/routes/products.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api/src/routes/products.js)
  [`mktintworks-cms-api/src/routes/discounts.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api/src/routes/discounts.js)
- Published blog cache:
  [`mktintworks-cms-api/src/routes/blog.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api/src/routes/blog.js)
- SEO cache:
  [`mktintworks-cms-api/src/routes/seo.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api/src/routes/seo.js)
- Promotions cache:
  [`mktintworks-cms-api/src/routes/promotions.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api/src/routes/promotions.js)

Important implementation details:

- `GET /api/pages/content` remains KV-first and still reports `source: "cache"` on a cache hit, which is the main Section 19 checklist signal for the content pipeline.
- Public product site data now uses a cached aggregate payload plus per-product KV entries so discount and pricing changes do not need to hit D1 every time.
- Discount writes and the scheduled discount cron now prime both product cache and the short-lived `active_discounts` cache after status changes.
- Published blog reads now use a cached published-article snapshot before falling through to D1, and publish/unpublish operations refresh that cache.
- SEO reads now cache per-page metadata rows under `seo:{slug}` and the public aggregate feed rebuilds from those cached entries when available.
- Active promotions now use the `active_promotions` key with a 60-second TTL while still invalidating the legacy `promotions:active` key during the transition.

### Shared upload security

- Utility:
  [`mktintworks-cms-api/src/utils/upload-security.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api/src/utils/upload-security.js)

Section 19 also tightens the shared upload helper:

- Secure filenames now normalize prefixes and use stronger random bytes instead of plain `Math.random()` output.
- R2 key generation now preserves nested folders such as `seo/og-images` while sanitizing each path segment.
- Existing upload routes for products, gallery, promotions, SEO, and CMS media continue to use one centralized helper pair for filename and key generation.

## Section 20 details

### Final compliance sweep

- CMS auth client:
  [`mktintworks-cms/assets/js/cms-core.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/assets/js/cms-core.js)
- Warranty route:
  [`mktintworks-cms-api/src/routes/warranties.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api/src/routes/warranties.js)

Implemented behavior:

- Section 20 replaces the remaining `localStorage` token persistence in the CMS with session-scoped storage, which matches the final PRD security rule and clears naturally on logout or tab closure.
- The CMS auth helper now falls back to an in-memory session adapter only when `sessionStorage` is unavailable, so browser privacy restrictions do not break admin authentication outright.
- Warranty generation now produces the PDF and stores it in R2 before the warranty row is inserted into D1, so failure cleanup does not need to delete a persisted warranty record.
- Linked-invoice warranty creation now also checks the `warranties` table by `invoice_id`, which prevents duplicate certificate generation even if an older invoice row is missing its reverse `warranty_id` link.

### Completion record and handover state

- Dashboard shell:
  [`mktintworks-cms/assets/js/cms-ui.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/assets/js/cms-ui.js)
- Dashboard content:
  [`mktintworks-cms/assets/js/dashboard.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/assets/js/dashboard.js)
- CMS delivery record:
  [`mktintworks-cms/data/section-20-status.json`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/data/section-20-status.json)

Important implementation details:

- The CMS shell now labels the workspace as Section 20 complete instead of presenting the build as an in-progress milestone.
- The dashboard hero, spotlight cards, and recent-activity timeline now focus on live operational use, business-owner handover, and final readiness instead of future-section placeholders.
- The new Section 20 status record captures the completion checkpoint, deployment verification, and the business-owner handover instructions from the PRD.

## Key directories

- [`assets`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/assets)
  Public-site CSS, JS, and images
- [`blog`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/blog)
  Public blog routes
- [`dist`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/dist)
  Generated public deployment output
- [`mktintworks-cms`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms)
  CMS Pages app
- [`mktintworks-cms-api`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api)
  Worker, schema, migrations, and seed SQL
- [`scripts`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/scripts)
  Build and deployment helpers for the static site

## Current repo shape after Section 20

- Worker:
  `https://mktintworks-cms-api.mktintworks.workers.dev`
- Public website project:
  `mk-tintworks-1`
- CMS Pages project:
  `mktintworks-cms`
- Public gallery data:
  Served from `GET /api/gallery/public`
- Public blog data:
  Served from `GET /api/blog/public`
- Public testimonials data:
  Served from `GET /api/testimonials/public`
- Public promotions data:
  Served from `GET /api/promotions/active`
- Public analytics ingest:
  Served from `POST /api/analytics/event`
- Public SEO data:
  Served from `GET /api/seo/public`
- Protected auth verification:
  Served from `GET /api/auth/verify`
- Protected media library data:
  Served from `GET /api/media`
- Protected analytics summary:
  Served from `GET /api/analytics/summary?days=...`
- Protected invoice numbering:
  Served from `GET /api/invoices/next-number`
- Protected invoice lookup for warranty prefill:
  Served from `GET /api/invoices/:id`
- Protected invoice PDF re-download:
  Served from `GET /api/invoices/pdf/:invoice_number`
- Protected invoice PDF generation:
  Served from `POST /api/invoices/generate`
- Protected invoice deletion:
  Served from `DELETE /api/invoices/:id`
- Protected warranty PDF generation:
  Served from `POST /api/warranties/generate`
- Protected warranty PDF re-download:
  Served from `GET /api/warranties/pdf/:certificate_number`
- Protected invoice records archive:
  Served from `GET /api/records/invoices`
- Protected warranty records archive:
  Served from `GET /api/records/warranties`
- Protected client lookup for invoice autocomplete:
  Served from `GET /api/records/clients`
- Protected sales summary:
  Served from `GET /api/sales/summary?period=30|90|365|all`
- Shared CORS middleware:
  Applied by [`mktintworks-cms-api/src/middleware/cors.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api/src/middleware/cors.js)
- Shared KV key convention:
  Implemented by [`mktintworks-cms-api/src/utils/cache.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api/src/utils/cache.js)
- Session-only CMS token storage:
  Implemented by [`mktintworks-cms/assets/js/cms-core.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/assets/js/cms-core.js)
- Final delivery status record:
  Tracked in [`mktintworks-cms/data/section-20-status.json`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/data/section-20-status.json)
- Published blog pages:
  Generated at build time from Worker-backed `blog_posts` rows
- CMS preview source discovery:
  Section status files in [`mktintworks-cms/data`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/data) plus fallback production hosts

## Operational notes

- Use `npm run build` at the repo root before direct public Pages deployments.
- The `mk-tintworks-1` Pages project must keep `build_command = npm run build` and `destination_dir = dist`; blank build settings will republish raw source files and break CMS-driven blog updates.
- Deploy the Worker from [`mktintworks-cms-api`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api) when backend routes or bindings change.
- Deploy the CMS Pages app from [`mktintworks-cms`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms) when admin UI or section status files change.
- The public site still keeps static fallback patterns where useful, but Sections 6-20 now treat the Worker as the source of truth for editable content, products, gallery items, published blog articles, approved testimonials, active promotions, page-level SEO, uploaded media records, first-party analytics event storage, invoice document generation, warranty certificate generation, the searchable business archive inside the CMS, invoice-backed sales reporting for financial visibility, the D1 to KV to deploy-hook sync path that moves CMS saves onto the live website, and the final completion metadata used for project handover.
- The promotions banner is intentionally runtime-driven rather than build-injected, so scheduling changes can appear on the live public header without requiring the entire static site shell to change.
- SEO metadata is intentionally build-injected rather than runtime-only so search crawlers and social scrapers can see the updated tags directly in the generated HTML source.
- Analytics tracking is intentionally first-party and lightweight, so the CMS gets quick visibility into website behavior without introducing cookies or third-party tracking scripts.
- Invoice PDFs are intentionally generated inside the Worker and stored in the documents bucket, so the commercial document output stays branded, reproducible, and independent of browser-only rendering.
- Warranty PDFs are intentionally generated inside the Worker and stored in the documents bucket, so claim documents stay branded, uniquely identifiable, and linked back to invoice history where applicable.
- The records system is intentionally CMS-only and protected by Access plus JWT, so PDF re-downloads, invoice deletion, and customer history lookups stay inside the administrative surface.
- The sync architecture is intentionally layered: D1 remains the permanent source of truth, KV absorbs hot reads between writes and rebuilds, and the deploy hook keeps the public static build aligned without making save operations depend on a successful Pages rebuild.

## PRD status

Section 20 completes the PRD. There is no further document milestone after this one.
