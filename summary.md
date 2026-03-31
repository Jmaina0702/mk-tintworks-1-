# MK Tintworks CMS and Website Summary

This repository now implements the MK Tintworks custom CMS architecture through PRD Section 10 on top of the original static marketing site.

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
5. Client scripts such as [`assets/js/cms-content.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/assets/js/cms-content.js), [`assets/js/services.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/assets/js/services.js), and [`assets/js/gallery.js`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/assets/js/gallery.js) can then refresh selected data at runtime with cache-bypassed fetches where needed.

### 3. Storage model

- D1:
  Structured records for page copy, products, discounts, gallery items, blog posts, testimonials, promotions, media metadata, SEO settings, clients, vehicles, invoices, warranties, and records.
- R2:
  Public media uploads and private document files.
- KV:
  Cached page-content snapshots and session-related state.

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
- Existing static article bodies were synced back into D1 so the CMS editor and new build generator preserve current live long-form content.

### Public blog generation

- Template source:
  [`blog/index.html`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/blog/index.html)
- Build pipeline:
  [`scripts/build-site.mjs`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/scripts/build-site.mjs)

Section 9 changes the public blog flow from hardcoded static pages to Worker-backed build output:

- `/blog/` is rendered from the published rows in `blog_posts`
- `/blog/[slug].html` is generated at build time for each published article
- related-article cards, metadata, JSON-LD, hero image, and article body now come from D1-backed blog content

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

## Current live shape after Section 10

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
- Published blog pages:
  Generated at build time from Worker-backed `blog_posts` rows
- CMS preview source discovery:
  Section status files in [`mktintworks-cms/data`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms/data) plus fallback production hosts

## Operational notes

- Use `npm run build` at the repo root before direct public Pages deployments.
- Deploy the Worker from [`mktintworks-cms-api`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms-api) when backend routes or bindings change.
- Deploy the CMS Pages app from [`mktintworks-cms`](/c:/Users/DELL/Documents/mk%20tintworks%20%281%29/mktintworks-cms) when admin UI or section status files change.
- The public site still keeps static fallback patterns where useful, but Sections 6-10 now treat the Worker as the source of truth for editable content, products, gallery items, published blog articles, and approved testimonials.

## Next section

The next PRD milestone is Section 11: Promotions & Announcements Banner System.
