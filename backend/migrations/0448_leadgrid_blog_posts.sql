-- 0448: Kanonisk lagring for den offentlige Leadgrid-bloggen.
--
-- Tabellen eksisterte som legacy-data i produksjon, men manglet en migrasjon.
-- IF NOT EXISTS bevarer alle eksisterende innlegg og gjør nye miljøer komplette.

CREATE TABLE IF NOT EXISTS blog_posts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  excerpt TEXT,
  content TEXT,
  cover_image TEXT,
  category TEXT,
  tags TEXT[],
  author TEXT,
  published BOOLEAN DEFAULT FALSE,
  featured BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_blog_posts_slug
  ON blog_posts (slug);

CREATE INDEX IF NOT EXISTS idx_blog_posts_publication
  ON blog_posts (published, published_at DESC)
  WHERE published = TRUE;
