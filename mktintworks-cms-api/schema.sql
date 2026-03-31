-- MK TINTWORKS CMS - DATABASE SCHEMA v1.0
-- Cloudflare D1 (SQLite dialect)
-- File: schema.sql

PRAGMA foreign_keys = ON;
-- D1 does not support PRAGMA journal_mode; keep the schema executable on Cloudflare.

CREATE TABLE IF NOT EXISTS pages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  page_slug    TEXT NOT NULL,
  section_key  TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK(content_type IN ('text', 'html', 'image', 'link', 'price')),
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
