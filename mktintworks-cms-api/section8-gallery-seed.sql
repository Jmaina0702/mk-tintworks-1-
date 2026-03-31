INSERT INTO gallery (
  image_url,
  thumbnail_url,
  caption,
  category,
  alt_text,
  display_order,
  file_size_kb,
  original_name,
  is_placeholder
)
SELECT
  '/assets/images/gallery/gallery-01.webp',
  '/assets/images/gallery/gallery-01.webp',
  'Professional automotive tinting presentation image for MK Tintworks.',
  'automotive',
  'Automotive tinting portfolio image by MK Tintworks',
  0,
  NULL,
  'gallery-01.webp',
  1
WHERE NOT EXISTS (SELECT 1 FROM gallery WHERE original_name = 'gallery-01.webp');

INSERT INTO gallery (
  image_url,
  thumbnail_url,
  caption,
  category,
  alt_text,
  display_order,
  file_size_kb,
  original_name,
  is_placeholder
)
SELECT
  '/assets/images/gallery/gallery-02.webp',
  '/assets/images/gallery/gallery-02.webp',
  'Premium heat-control window film portfolio view.',
  'automotive',
  'Premium heat-control automotive window film by MK Tintworks',
  1,
  NULL,
  'gallery-02.webp',
  1
WHERE NOT EXISTS (SELECT 1 FROM gallery WHERE original_name = 'gallery-02.webp');

INSERT INTO gallery (
  image_url,
  thumbnail_url,
  caption,
  category,
  alt_text,
  display_order,
  file_size_kb,
  original_name,
  is_placeholder
)
SELECT
  '/assets/images/gallery/gallery-03.webp',
  '/assets/images/gallery/gallery-03.webp',
  'Commercial glass tinting mood image for Nairobi workspaces.',
  'commercial',
  'Commercial glass tinting image for Nairobi workspace presentation',
  2,
  NULL,
  'gallery-03.webp',
  1
WHERE NOT EXISTS (SELECT 1 FROM gallery WHERE original_name = 'gallery-03.webp');

INSERT INTO gallery (
  image_url,
  thumbnail_url,
  caption,
  category,
  alt_text,
  display_order,
  file_size_kb,
  original_name,
  is_placeholder
)
SELECT
  '/assets/images/gallery/gallery-04.webp',
  '/assets/images/gallery/gallery-04.webp',
  'Residential window film visual emphasizing comfort and glare reduction.',
  'residential',
  'Residential window film visual by MK Tintworks',
  3,
  NULL,
  'gallery-04.webp',
  1
WHERE NOT EXISTS (SELECT 1 FROM gallery WHERE original_name = 'gallery-04.webp');

INSERT INTO gallery (
  image_url,
  thumbnail_url,
  caption,
  category,
  alt_text,
  display_order,
  file_size_kb,
  original_name,
  is_placeholder
)
SELECT
  '/assets/images/gallery/gallery-05.webp',
  '/assets/images/gallery/gallery-05.webp',
  'Automotive installation visual supporting premium tier positioning.',
  'automotive',
  'Premium automotive installation visual by MK Tintworks',
  4,
  NULL,
  'gallery-05.webp',
  1
WHERE NOT EXISTS (SELECT 1 FROM gallery WHERE original_name = 'gallery-05.webp');

INSERT INTO gallery (
  image_url,
  thumbnail_url,
  caption,
  category,
  alt_text,
  display_order,
  file_size_kb,
  original_name,
  is_placeholder
)
SELECT
  '/assets/images/gallery/gallery-06.webp',
  '/assets/images/gallery/gallery-06.webp',
  'Architectural tinting image for commercial heat and privacy control.',
  'commercial',
  'Architectural tinting image for commercial heat control',
  5,
  NULL,
  'gallery-06.webp',
  1
WHERE NOT EXISTS (SELECT 1 FROM gallery WHERE original_name = 'gallery-06.webp');

INSERT INTO gallery (
  image_url,
  thumbnail_url,
  caption,
  category,
  alt_text,
  display_order,
  file_size_kb,
  original_name,
  is_placeholder
)
SELECT
  '/assets/images/gallery/gallery-07.webp',
  '/assets/images/gallery/gallery-07.webp',
  'Residential privacy and natural-light preservation visual.',
  'residential',
  'Residential privacy film image by MK Tintworks',
  6,
  NULL,
  'gallery-07.webp',
  1
WHERE NOT EXISTS (SELECT 1 FROM gallery WHERE original_name = 'gallery-07.webp');

INSERT INTO gallery (
  image_url,
  thumbnail_url,
  caption,
  category,
  alt_text,
  display_order,
  file_size_kb,
  original_name,
  is_placeholder
)
SELECT
  '/assets/images/gallery/gallery-08.webp',
  '/assets/images/gallery/gallery-08.webp',
  'Luxury vehicle tint styling image from the MK Tintworks library.',
  'automotive',
  'Luxury vehicle tint styling image by MK Tintworks',
  7,
  NULL,
  'gallery-08.webp',
  1
WHERE NOT EXISTS (SELECT 1 FROM gallery WHERE original_name = 'gallery-08.webp');

INSERT INTO gallery (
  image_url,
  thumbnail_url,
  caption,
  category,
  alt_text,
  display_order,
  file_size_kb,
  original_name,
  is_placeholder
)
SELECT
  '/assets/images/gallery/gallery-09.webp',
  '/assets/images/gallery/gallery-09.webp',
  'Glass-rich commercial project reference image.',
  'commercial',
  'Commercial project reference image in MK Tintworks gallery',
  8,
  NULL,
  'gallery-09.webp',
  1
WHERE NOT EXISTS (SELECT 1 FROM gallery WHERE original_name = 'gallery-09.webp');

INSERT INTO gallery (
  image_url,
  thumbnail_url,
  caption,
  category,
  alt_text,
  display_order,
  file_size_kb,
  original_name,
  is_placeholder
)
SELECT
  '/assets/images/gallery/gallery-10.webp',
  '/assets/images/gallery/gallery-10.webp',
  'Home comfort and solar control reference image.',
  'residential',
  'Home comfort and solar control reference image',
  9,
  NULL,
  'gallery-10.webp',
  1
WHERE NOT EXISTS (SELECT 1 FROM gallery WHERE original_name = 'gallery-10.webp');
