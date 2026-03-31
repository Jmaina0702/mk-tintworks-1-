PRAGMA foreign_keys = OFF;

ALTER TABLE pages RENAME TO pages_section6_backup;

CREATE TABLE pages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  page_slug    TEXT NOT NULL,
  section_key  TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK(content_type IN ('text', 'html', 'image', 'link', 'price')),
  content      TEXT,
  image_url    TEXT,
  alt_text     TEXT,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO pages (id, page_slug, section_key, content_type, content, image_url, alt_text, updated_at)
SELECT
  id,
  page_slug,
  section_key,
  CASE
    WHEN content_type IN ('text', 'html', 'image', 'link', 'price') THEN content_type
    ELSE 'text'
  END,
  content,
  image_url,
  alt_text,
  updated_at
FROM pages_section6_backup;

DROP INDEX IF EXISTS idx_pages_slug_key;

CREATE UNIQUE INDEX idx_pages_slug_key
  ON pages(page_slug, section_key);

DROP TABLE pages_section6_backup;

PRAGMA foreign_keys = ON;
