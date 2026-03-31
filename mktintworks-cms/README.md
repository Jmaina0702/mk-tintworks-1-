# MK Tintworks CMS Bootstrap

This directory is the Section 1 bootstrap for the future `mktintworks-cms` repository.
It lives inside the website workspace for now so the architecture, seed data, and
scope can be locked before Cloudflare setup work begins in Section 2.

## Included

- `index.html`
  Static admin shell that reflects the Section 1 architecture, module scope, and
  current-state audit.
- `assets/css/cms.css`
  CMS-only styling that reuses the MK Tintworks visual language instead of a generic
  dashboard look.
- `data/section-1-baseline.json`
  Architecture baseline, platform choices, current-state audit, and repo split.
- `data/modules.json`
  The full Phase 1 module inventory from the PRD.
- `data/products.seed.json`
  The authoritative 10-product seed set for the future Products Manager.
- `data/content-map.json`
  The initial CMS-controlled page map and known current-site gaps.

## Current audit highlights

- The public website is a static HTML/CSS/JS site.
- Booking currently posts directly to Web3Forms from `assets/js/booking.js`.
- `404.html` is not present in the current website repo.
- `blog/index.html` links to two article files that are not present:
  `blog/car-tint-maintenance-nairobi.html` and
  `blog/ceramic-vs-regular-tint-kenya.html`.
- `testimonials.html` still contains placeholder review copy instead of a live data source.

## Credential handling

Section 1 includes existing live identifiers and keys. This bootstrap does not duplicate
the Web3Forms access key into a new file. It records where the live values already exist
so Section 2 and later sections can move them into the right environment bindings without
creating extra copies.

## What this is not

- Not the final CMS repository split.
- Not the Cloudflare Worker API.
- Not the D1 schema.
- Not the auth flow.

Those come next, once Section 2 is provided.
