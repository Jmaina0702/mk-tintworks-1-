-- MK TINTWORKS CMS - SECTION 3 LEGACY TO PRD MIGRATION
-- One-time migration for the existing remote D1 database.
-- Strategy:
-- 1. Snapshot legacy rows into backup tables.
-- 2. Remove the legacy schema objects that conflict with the PRD schema.
-- 3. Recreate the PRD Section 3 schema inline.
-- 4. Map preserved rows into the new tables.

CREATE TABLE s3_legacy_products AS
SELECT * FROM products;

CREATE TABLE s3_legacy_product_discounts AS
SELECT * FROM product_discounts;

CREATE TABLE s3_legacy_gallery_items AS
SELECT * FROM gallery_items;

CREATE TABLE s3_legacy_blog_posts AS
SELECT * FROM blog_posts;

CREATE TABLE s3_legacy_testimonials AS
SELECT * FROM testimonials;

CREATE TABLE s3_legacy_promotions AS
SELECT * FROM promotions;

CREATE TABLE s3_legacy_media_assets AS
SELECT * FROM media_assets;

CREATE TABLE s3_legacy_clients AS
SELECT * FROM clients;

CREATE TABLE s3_legacy_invoices AS
SELECT * FROM invoices;

CREATE TABLE s3_legacy_warranties AS
SELECT * FROM warranties;

CREATE TABLE s3_legacy_analytics_events AS
SELECT * FROM analytics_events;

CREATE TABLE s3_legacy_content_blocks AS
SELECT * FROM content_blocks;

DROP TABLE product_discounts;
DROP TABLE gallery_items;
DROP TABLE media_assets;
DROP TABLE content_blocks;
DROP TABLE blog_posts;
DROP TABLE promotions;
DROP TABLE testimonials;
DROP TABLE analytics_events;
DROP TABLE warranties;
DROP TABLE invoices;
DROP TABLE clients;
DROP TABLE products;

PRAGMA foreign_keys = ON;
-- D1 does not support PRAGMA journal_mode; keep the schema executable on Cloudflare.

CREATE TABLE IF NOT EXISTS pages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  page_slug    TEXT NOT NULL,
  section_key  TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK(content_type IN ('text', 'html', 'image', 'link')),
  content      TEXT,
  image_url    TEXT,
  alt_text     TEXT,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pages_slug_key
  ON pages(page_slug, section_key);

CREATE TABLE IF NOT EXISTS products (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  brand                TEXT NOT NULL CHECK(brand IN ('3m', 'llumar', 'other')),
  product_key          TEXT NOT NULL UNIQUE,
  name                 TEXT NOT NULL,
  tagline              TEXT,
  short_description    TEXT,
  extended_description TEXT,
  benefits             TEXT,
  base_price           REAL NOT NULL,
  current_price        REAL,
  tier                 TEXT CHECK(tier IN ('premium','high','mid','entry','specialty')),
  warranty_text        TEXT,
  image_url            TEXT,
  image_alt            TEXT,
  display_order        INTEGER NOT NULL DEFAULT 0,
  is_active            INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_brand
  ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_active
  ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_order
  ON products(brand, display_order);

CREATE TABLE IF NOT EXISTS discounts (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id       INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  percentage       REAL NOT NULL CHECK(percentage > 0 AND percentage < 100),
  discounted_price REAL NOT NULL,
  start_datetime   TEXT NOT NULL,
  end_datetime     TEXT NOT NULL,
  label            TEXT,
  status           TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'active', 'expired')),
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_discounts_product
  ON discounts(product_id);
CREATE INDEX IF NOT EXISTS idx_discounts_status
  ON discounts(status);
CREATE INDEX IF NOT EXISTS idx_discounts_status_dates
  ON discounts(status, start_datetime, end_datetime);

CREATE TABLE IF NOT EXISTS gallery (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  image_url      TEXT NOT NULL,
  thumbnail_url  TEXT,
  caption        TEXT,
  category       TEXT NOT NULL DEFAULT 'automotive' CHECK(category IN ('automotive', 'residential', 'commercial')),
  alt_text       TEXT,
  display_order  INTEGER NOT NULL DEFAULT 0,
  file_size_kb   INTEGER,
  original_name  TEXT,
  is_placeholder INTEGER NOT NULL DEFAULT 0 CHECK(is_placeholder IN (0, 1)),
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gallery_category
  ON gallery(category);
CREATE INDEX IF NOT EXISTS idx_gallery_order
  ON gallery(display_order);
CREATE INDEX IF NOT EXISTS idx_gallery_placeholder
  ON gallery(is_placeholder);

CREATE TABLE IF NOT EXISTS blog_posts (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  slug               TEXT NOT NULL UNIQUE,
  title              TEXT NOT NULL,
  ai_title           TEXT,
  meta_description   TEXT,
  summary            TEXT,
  keywords           TEXT,
  content            TEXT,
  featured_image_url TEXT,
  featured_image_alt TEXT,
  category           TEXT NOT NULL DEFAULT 'general'
                     CHECK(category IN ('automotive', 'residential', 'commercial', 'maintenance', 'general')),
  read_time_minutes  INTEGER,
  status             TEXT NOT NULL DEFAULT 'draft'
                     CHECK(status IN ('draft', 'published', 'unpublished')),
  source_type        TEXT NOT NULL DEFAULT 'written'
                     CHECK(source_type IN ('written', 'pdf_upload', 'docx_upload')),
  published_at       TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_blog_status
  ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_category
  ON blog_posts(category);
CREATE INDEX IF NOT EXISTS idx_blog_published
  ON blog_posts(published_at);

CREATE TABLE IF NOT EXISTS testimonials (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  client_name   TEXT NOT NULL,
  service_type  TEXT CHECK(service_type IN ('automotive', 'residential', 'commercial')),
  rating        INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  review_text   TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  display_order INTEGER NOT NULL DEFAULT 0,
  submitted_at  TEXT NOT NULL DEFAULT (datetime('now')),
  approved_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_testimonials_status
  ON testimonials(status);
CREATE INDEX IF NOT EXISTS idx_testimonials_order
  ON testimonials(status, display_order);

CREATE TABLE IF NOT EXISTS promotions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  title            TEXT NOT NULL,
  image_url        TEXT NOT NULL,
  link_url         TEXT,
  animation_type   TEXT NOT NULL DEFAULT 'fade'
                   CHECK(animation_type IN ('fade', 'slide-down', 'bounce', 'zoom', 'slide-right')),
  display_duration INTEGER NOT NULL DEFAULT 5000,
  season           TEXT CHECK(season IN ('easter', 'christmas', 'eid', 'custom')),
  custom_label     TEXT,
  start_datetime   TEXT NOT NULL,
  end_datetime     TEXT NOT NULL,
  display_order    INTEGER NOT NULL DEFAULT 0,
  is_active        INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_promotions_schedule
  ON promotions(is_active, start_datetime, end_datetime);

CREATE TABLE IF NOT EXISTS media (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  filename      TEXT NOT NULL,
  original_name TEXT NOT NULL,
  r2_key        TEXT NOT NULL UNIQUE,
  cdn_url       TEXT NOT NULL,
  file_type     TEXT,
  file_size_kb  INTEGER,
  width_px      INTEGER,
  height_px     INTEGER,
  used_in       TEXT NOT NULL DEFAULT '[]',
  uploaded_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_media_type
  ON media(file_type);

CREATE TABLE IF NOT EXISTS seo_settings (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  page_slug        TEXT NOT NULL UNIQUE,
  meta_title       TEXT,
  meta_description TEXT,
  og_image_url     TEXT,
  og_title         TEXT,
  og_description   TEXT,
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clients (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name  TEXT NOT NULL,
  phone      TEXT,
  email      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_clients_phone
  ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_email
  ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_name
  ON clients(full_name);

CREATE TABLE IF NOT EXISTS vehicles (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id       INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  registration_no TEXT NOT NULL,
  make            TEXT,
  model           TEXT,
  vehicle_type    TEXT CHECK(vehicle_type IN ('sedan', 'suv', 'truck', 'specialty')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_vehicles_client
  ON vehicles(client_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_registration
  ON vehicles(registration_no);

CREATE TABLE IF NOT EXISTS invoices (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number    TEXT NOT NULL UNIQUE,
  client_id         INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  vehicle_id        INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
  service_type      TEXT NOT NULL CHECK(service_type IN ('automotive', 'residential', 'commercial')),
  film_used         TEXT,
  vehicle_type      TEXT CHECK(vehicle_type IN ('sedan', 'suv', 'truck', 'specialty')),
  windows_count     INTEGER,
  unit_price        REAL NOT NULL,
  subtotal          REAL NOT NULL,
  vat_rate          REAL NOT NULL DEFAULT 0.16,
  vat_amount        REAL NOT NULL,
  total_amount      REAL NOT NULL,
  payment_method    TEXT CHECK(payment_method IN ('mpesa', 'bank', 'cash')),
  payment_reference TEXT,
  payment_status    TEXT NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('paid', 'unpaid', 'partial')),
  notes             TEXT,
  service_date      TEXT NOT NULL,
  pdf_r2_key        TEXT,
  warranty_id       INTEGER,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invoices_client
  ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status
  ON invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_date
  ON invoices(service_date);
CREATE INDEX IF NOT EXISTS idx_invoices_created
  ON invoices(created_at);

CREATE TABLE IF NOT EXISTS warranties (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  certificate_number   TEXT NOT NULL UNIQUE,
  invoice_id           INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
  client_id            INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  vehicle_id           INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
  film_installed       TEXT NOT NULL,
  installation_date    TEXT NOT NULL,
  warranty_period      TEXT NOT NULL,
  what_is_covered      TEXT NOT NULL,
  what_is_not_covered  TEXT NOT NULL,
  additional_notes     TEXT,
  issue_date           TEXT NOT NULL,
  pdf_r2_key           TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_warranties_cert
  ON warranties(certificate_number);
CREATE INDEX IF NOT EXISTS idx_warranties_client
  ON warranties(client_id);
CREATE INDEX IF NOT EXISTS idx_warranties_vehicle
  ON warranties(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_warranties_invoice
  ON warranties(invoice_id);

CREATE TABLE IF NOT EXISTS analytics_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type  TEXT NOT NULL CHECK(event_type IN ('pageview', 'product_click', 'cta_click', 'blog_read')),
  page        TEXT,
  referrer    TEXT,
  product_key TEXT,
  country     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_analytics_type
  ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_date
  ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_type_date
  ON analytics_events(event_type, created_at);

INSERT OR IGNORE INTO seo_settings
  (page_slug, meta_title, meta_description)
VALUES
  ('home',
   'MK Tintworks | Premium Window Tinting Nairobi',
   'Professional window tinting Nairobi. Authorized 3M & Llumar installer. Automotive, residential & commercial. Book your appointment today.'),
  ('services',
   'Window Tinting Services & Products Nairobi | MK Tintworks',
   '3M Crystalline, Llumar IRX, ceramic tints and more. Compare products, prices and book professional installation in Nairobi, Kenya.'),
  ('gallery',
   'Window Tinting Portfolio Nairobi | Our Work | MK Tintworks',
   'View our portfolio of professional window tinting installations across Nairobi. Automotive, residential and commercial projects.'),
  ('testimonials',
   'Client Reviews | MK Tintworks Window Tinting Nairobi',
   'Honest reviews from real MK Tintworks clients across Nairobi. Real feedback on 3M and Llumar automotive and commercial tinting.'),
  ('blog',
   'Window Tinting Blog Kenya | Expert Tips & Guides | MK Tintworks',
   'Expert articles on window tinting in Kenya. NTSA regulations, 3M vs Llumar, maintenance tips from Nairobi''s premium installer.'),
  ('book',
   'Book Window Tinting Nairobi | MK Tintworks',
   'Book professional window tinting in Nairobi. Mobile service — we come to you. Authorized 3M & Llumar certified installation.');

INSERT OR IGNORE INTO products
  (brand, product_key, name, base_price, tier, warranty_text, display_order)
VALUES
  ('3m',
   '3m-crystalline',
   '3M™ Crystalline Automotive Window Film',
   95000,
   'premium',
   'Limited Lifetime Warranty for as long as you own your vehicle',
   1),
  ('3m',
   '3m-ceramic-ir',
   '3M™ Ceramic IR Automotive Window Film',
   63000,
   'high',
   'Limited Lifetime Warranty',
   2),
  ('3m',
   '3m-color-stable-ir',
   '3M™ Color Stable IR Automotive Window Film',
   40000,
   'mid',
   'Limited Lifetime Warranty',
   3),
  ('3m',
   '3m-obsidian',
   '3M™ Obsidian Automotive Window Film',
   15000,
   'entry',
   'Limited Lifetime Warranty',
   4),
  ('llumar',
   'llumar-irx',
   'Llumar® IRX Automotive Window Film',
   50000,
   'premium',
   'Manufacturer''s Limited Lifetime Warranty',
   1),
  ('llumar',
   'llumar-ctx',
   'Llumar® CTX Automotive Window Film',
   45000,
   'high',
   'Manufacturer''s Limited Lifetime Warranty',
   2),
  ('llumar',
   'llumar-atr',
   'Llumar® ATR Automotive Window Film',
   30000,
   'mid',
   'Manufacturer''s Limited Lifetime Warranty',
   3),
  ('llumar',
   'llumar-atc-grey',
   'Llumar® ATC Grey Automotive Window Film',
   20000,
   'entry',
   'Manufacturer''s Limited Lifetime Warranty',
   4),
  ('llumar',
   'llumar-black-series',
   'Llumar® Black Series Automotive Window Film',
   12000,
   'entry',
   'Manufacturer''s Limited Lifetime Warranty',
   5),
  ('other',
   'chameleon',
   'Chameleon Color-Shifting Window Film',
   28800,
   'specialty',
   'Manufacturer''s warranty against fading, bubbling, and delamination',
   1);

INSERT INTO pages
  (page_slug, section_key, content_type, content, image_url, alt_text, updated_at)
SELECT
  page_slug,
  content_key,
  CASE lower(COALESCE(content_type, 'text'))
    WHEN 'html' THEN 'html'
    WHEN 'image' THEN 'image'
    WHEN 'link' THEN 'link'
    ELSE 'text'
  END,
  COALESCE(value_text, value_json),
  NULL,
  NULL,
  COALESCE(updated_at, created_at, datetime('now'))
FROM s3_legacy_content_blocks;

DELETE FROM products;

INSERT INTO products
  (brand, product_key, name, tagline, short_description, extended_description, benefits, base_price,
   current_price, tier, warranty_text, image_url, image_alt, display_order, is_active, updated_at)
SELECT
  CASE lower(COALESCE(brand, ''))
    WHEN '3m' THEN '3m'
    WHEN 'llumar' THEN 'llumar'
    ELSE 'other'
  END,
  slug,
  name,
  tagline,
  description,
  more_info_html,
  benefits_json,
  price_kes,
  NULL,
  CASE slug
    WHEN '3m-crystalline' THEN 'premium'
    WHEN '3m-ceramic-ir' THEN 'high'
    WHEN '3m-color-stable-ir' THEN 'mid'
    WHEN '3m-obsidian' THEN 'entry'
    WHEN 'llumar-irx' THEN 'premium'
    WHEN 'llumar-ctx' THEN 'high'
    WHEN 'llumar-atr' THEN 'mid'
    WHEN 'llumar-atc-grey' THEN 'entry'
    WHEN 'llumar-black-series' THEN 'entry'
    WHEN 'chameleon' THEN 'specialty'
    ELSE 'entry'
  END,
  warranty_text,
  image_url,
  image_alt,
  CASE
    WHEN sort_order >= 10 THEN CAST(sort_order / 10 AS INTEGER)
    ELSE sort_order
  END,
  CASE WHEN is_published IN (0, 1) THEN is_published ELSE 1 END,
  COALESCE(updated_at, created_at, datetime('now'))
FROM s3_legacy_products;

INSERT INTO discounts
  (product_id, percentage, discounted_price, start_datetime, end_datetime, label, status, created_at)
SELECT
  p.id,
  d.percentage,
  ROUND(lp.base_price * (100.0 - d.percentage) / 100.0, 2),
  COALESCE(d.starts_at, datetime('now')),
  COALESCE(d.ends_at, d.starts_at, datetime('now')),
  NULLIF(d.label, ''),
  CASE
    WHEN d.is_enabled = 0 THEN 'expired'
    WHEN datetime(replace(replace(COALESCE(d.ends_at, d.starts_at, datetime('now')), 'T', ' '), 'Z', '')) < datetime('now') THEN 'expired'
    WHEN datetime(replace(replace(COALESCE(d.starts_at, datetime('now')), 'T', ' '), 'Z', '')) > datetime('now') THEN 'scheduled'
    ELSE 'active'
  END,
  COALESCE(d.updated_at, d.created_at, datetime('now'))
FROM s3_legacy_product_discounts d
JOIN s3_legacy_products bp
  ON bp.id = d.product_id
JOIN products p
  ON p.product_key = bp.slug
JOIN products lp
  ON lp.id = p.id;

INSERT INTO gallery
  (image_url, thumbnail_url, caption, category, alt_text, display_order, file_size_kb, original_name, is_placeholder, created_at)
SELECT
  image_url,
  image_url,
  COALESCE(caption, title),
  CASE lower(COALESCE(category, 'automotive'))
    WHEN 'residential' THEN 'residential'
    WHEN 'commercial' THEN 'commercial'
    ELSE 'automotive'
  END,
  alt_text,
  sort_order,
  NULL,
  slug,
  CASE WHEN is_published = 0 THEN 1 ELSE 0 END,
  COALESCE(created_at, updated_at, datetime('now'))
FROM s3_legacy_gallery_items;

INSERT INTO blog_posts
  (slug, title, ai_title, meta_description, summary, keywords, content, featured_image_url, featured_image_alt,
   category, read_time_minutes, status, source_type, published_at, created_at)
SELECT
  slug,
  title,
  NULL,
  meta_description,
  summary,
  keywords_json,
  body_html,
  featured_image_url,
  featured_image_alt,
  CASE
    WHEN lower(COALESCE(category, '')) LIKE '%residential%' THEN 'residential'
    WHEN lower(COALESCE(category, '')) LIKE '%commercial%' THEN 'commercial'
    WHEN lower(COALESCE(category, '')) LIKE '%maintenance%' THEN 'maintenance'
    ELSE 'automotive'
  END,
  CASE
    WHEN LENGTH(COALESCE(body_html, '')) > 0 THEN CAST((LENGTH(body_html) + 1199) / 1200 AS INTEGER)
    ELSE NULL
  END,
  CASE lower(COALESCE(status, 'draft'))
    WHEN 'published' THEN 'published'
    WHEN 'unpublished' THEN 'unpublished'
    ELSE 'draft'
  END,
  'written',
  published_at,
  COALESCE(created_at, updated_at, datetime('now'))
FROM s3_legacy_blog_posts;

INSERT INTO testimonials
  (client_name, service_type, rating, review_text, status, display_order, submitted_at, approved_at)
SELECT
  name,
  CASE lower(COALESCE(service_type, ''))
    WHEN 'residential' THEN 'residential'
    WHEN 'commercial' THEN 'commercial'
    ELSE 'automotive'
  END,
  rating,
  review,
  CASE lower(COALESCE(status, 'pending'))
    WHEN 'approved' THEN 'approved'
    WHEN 'rejected' THEN 'rejected'
    ELSE 'pending'
  END,
  CASE WHEN featured = 1 THEN 0 ELSE id END,
  COALESCE(created_at, updated_at, datetime('now')),
  approved_at
FROM s3_legacy_testimonials;

INSERT INTO promotions
  (title, image_url, link_url, animation_type, display_duration, season, custom_label,
   start_datetime, end_datetime, display_order, is_active, created_at)
SELECT
  title,
  image_url,
  link_url,
  CASE lower(COALESCE(animation, 'fade'))
    WHEN 'slide-down' THEN 'slide-down'
    WHEN 'bounce' THEN 'bounce'
    WHEN 'zoom' THEN 'zoom'
    WHEN 'slide-right' THEN 'slide-right'
    ELSE 'fade'
  END,
  5000,
  NULL,
  COALESCE(headline, subtext),
  COALESCE(starts_at, created_at, datetime('now')),
  COALESCE(ends_at, starts_at, datetime('now', '+30 days')),
  sort_order,
  CASE WHEN is_published IN (0, 1) THEN is_published ELSE 1 END,
  COALESCE(created_at, updated_at, datetime('now'))
FROM s3_legacy_promotions;

INSERT INTO media
  (filename, original_name, r2_key, cdn_url, file_type, file_size_kb, width_px, height_px, used_in, uploaded_at)
SELECT
  COALESCE(file_name, storage_key),
  COALESCE(file_name, storage_key),
  storage_key,
  CASE
    WHEN storage_key IS NOT NULL AND storage_key != '' THEN 'https://pub-0252224d03e4472da062ccdc92c2482f.r2.dev/' || storage_key
    ELSE url
  END,
  mime_type,
  CAST(ROUND(size_bytes / 1024.0) AS INTEGER),
  width,
  height,
  CASE
    WHEN purpose IS NOT NULL AND purpose != '' THEN '["' || replace(purpose, '"', '') || '"]'
    ELSE '[]'
  END,
  COALESCE(created_at, datetime('now'))
FROM s3_legacy_media_assets;

INSERT INTO clients
  (full_name, phone, email, created_at, updated_at)
SELECT
  full_name,
  phone,
  email,
  COALESCE(created_at, updated_at, datetime('now')),
  COALESCE(updated_at, created_at, datetime('now'))
FROM s3_legacy_clients;

INSERT INTO vehicles
  (client_id, registration_no, make, model, vehicle_type, created_at)
SELECT
  c.id,
  lc.vehicle_registration,
  CASE
    WHEN instr(COALESCE(lc.vehicle_make_model, ''), ' ') > 0 THEN substr(lc.vehicle_make_model, 1, instr(lc.vehicle_make_model, ' ') - 1)
    WHEN COALESCE(lc.vehicle_make_model, '') != '' THEN lc.vehicle_make_model
    ELSE NULL
  END,
  CASE
    WHEN instr(COALESCE(lc.vehicle_make_model, ''), ' ') > 0 THEN substr(lc.vehicle_make_model, instr(lc.vehicle_make_model, ' ') + 1)
    ELSE NULL
  END,
  CASE
    WHEN lower(COALESCE(lc.vehicle_make_model, '')) LIKE '%suv%' THEN 'suv'
    WHEN lower(COALESCE(lc.vehicle_make_model, '')) LIKE '%truck%' THEN 'truck'
    WHEN lower(COALESCE(lc.vehicle_make_model, '')) LIKE '%special%' THEN 'specialty'
    ELSE 'sedan'
  END,
  COALESCE(lc.created_at, lc.updated_at, datetime('now'))
FROM s3_legacy_clients lc
JOIN clients c
  ON COALESCE(c.full_name, '') = COALESCE(lc.full_name, '')
 AND COALESCE(c.phone, '') = COALESCE(lc.phone, '')
 AND COALESCE(c.email, '') = COALESCE(lc.email, '')
WHERE COALESCE(lc.vehicle_registration, '') != '';

INSERT INTO invoices
  (invoice_number, client_id, vehicle_id, service_type, film_used, vehicle_type, windows_count, unit_price,
   subtotal, vat_rate, vat_amount, total_amount, payment_method, payment_reference, payment_status, notes,
   service_date, pdf_r2_key, warranty_id, created_at)
SELECT
  li.invoice_number,
  c.id,
  v.id,
  CASE lower(COALESCE(li.service_type, ''))
    WHEN 'residential' THEN 'residential'
    WHEN 'commercial' THEN 'commercial'
    ELSE 'automotive'
  END,
  li.film_used,
  CASE lower(COALESCE(li.vehicle_type, ''))
    WHEN 'suv' THEN 'suv'
    WHEN 'truck' THEN 'truck'
    WHEN 'specialty' THEN 'specialty'
    WHEN 'sedan' THEN 'sedan'
    ELSE NULL
  END,
  li.quantity,
  li.unit_price_kes,
  li.subtotal_kes,
  CASE
    WHEN li.tax_rate > 1 THEN li.tax_rate / 100.0
    ELSE li.tax_rate
  END,
  li.tax_amount_kes,
  li.total_kes,
  CASE lower(COALESCE(li.payment_method, ''))
    WHEN 'mpesa' THEN 'mpesa'
    WHEN 'bank' THEN 'bank'
    WHEN 'cash' THEN 'cash'
    ELSE NULL
  END,
  NULL,
  CASE lower(COALESCE(li.payment_status, 'unpaid'))
    WHEN 'paid' THEN 'paid'
    WHEN 'partial' THEN 'partial'
    ELSE 'unpaid'
  END,
  li.notes,
  COALESCE(li.updated_at, li.created_at, datetime('now')),
  li.pdf_key,
  NULL,
  COALESCE(li.created_at, li.updated_at, datetime('now'))
FROM s3_legacy_invoices li
LEFT JOIN clients c
  ON COALESCE(c.full_name, '') = COALESCE(li.client_name, '')
 AND COALESCE(c.phone, '') = COALESCE(li.client_phone, '')
 AND COALESCE(c.email, '') = COALESCE(li.client_email, '')
LEFT JOIN vehicles v
  ON COALESCE(v.registration_no, '') = COALESCE(li.vehicle_registration, '');

INSERT INTO warranties
  (certificate_number, invoice_id, client_id, vehicle_id, film_installed, installation_date,
   warranty_period, what_is_covered, what_is_not_covered, additional_notes, issue_date, pdf_r2_key, created_at)
SELECT
  lw.certificate_number,
  ni.id,
  c.id,
  v.id,
  COALESCE(lw.film_used, 'Unknown film'),
  COALESCE(li.created_at, lw.created_at, datetime('now')),
  COALESCE(lw.warranty_period, 'Manufacturer warranty'),
  COALESCE(lw.coverage_text, 'Manufacturer warranty terms apply'),
  COALESCE(lw.exclusions_text, 'Damage from misuse, abrasion, unauthorized alteration, or accidents.'),
  lw.notes,
  COALESCE(lw.created_at, li.created_at, datetime('now')),
  lw.pdf_key,
  COALESCE(lw.created_at, lw.updated_at, datetime('now'))
FROM s3_legacy_warranties lw
LEFT JOIN s3_legacy_invoices li
  ON li.id = lw.invoice_id
LEFT JOIN invoices ni
  ON ni.invoice_number = li.invoice_number
LEFT JOIN clients c
  ON COALESCE(c.full_name, '') = COALESCE(lw.client_name, '')
 AND COALESCE(c.phone, '') = COALESCE(lw.client_phone, '')
 AND COALESCE(c.email, '') = COALESCE(lw.client_email, '')
LEFT JOIN vehicles v
  ON COALESCE(v.registration_no, '') = COALESCE(lw.vehicle_registration, '');

INSERT INTO analytics_events
  (event_type, page, referrer, product_key, country, created_at)
SELECT
  CASE lower(COALESCE(event_name, 'page_view'))
    WHEN 'page_view' THEN 'pageview'
    WHEN 'pageview' THEN 'pageview'
    WHEN 'product_click' THEN 'product_click'
    WHEN 'cta_click' THEN 'cta_click'
    WHEN 'blog_read' THEN 'blog_read'
    ELSE 'pageview'
  END,
  page_slug,
  referrer,
  CASE
    WHEN lower(COALESCE(event_name, '')) = 'product_click' THEN target_key
    ELSE NULL
  END,
  NULL,
  COALESCE(created_at, datetime('now'))
FROM s3_legacy_analytics_events;
