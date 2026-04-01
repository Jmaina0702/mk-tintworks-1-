-- Section 14 one-time D1 migration.
-- Run this only if analytics_events does not already have the label column.
ALTER TABLE analytics_events ADD COLUMN label TEXT;
