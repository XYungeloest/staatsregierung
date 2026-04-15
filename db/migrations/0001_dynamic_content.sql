CREATE TABLE IF NOT EXISTS press_releases (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  published_at TEXT NOT NULL,
  ressort TEXT NOT NULL,
  teaser TEXT NOT NULL,
  image_url TEXT,
  media_key TEXT,
  image_alt TEXT NOT NULL,
  image_credit TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  body_json TEXT NOT NULL,
  is_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0, 1)),
  related_topic_slugs_json TEXT NOT NULL DEFAULT '[]',
  related_norm_slugs_json TEXT NOT NULL DEFAULT '[]',
  related_press_slugs_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_press_releases_published_at
  ON press_releases (published_at DESC);

CREATE INDEX IF NOT EXISTS idx_press_releases_featured
  ON press_releases (is_featured DESC, published_at DESC);

CREATE TABLE IF NOT EXISTS events (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  event_date TEXT NOT NULL,
  location TEXT NOT NULL,
  teaser TEXT NOT NULL,
  body_json TEXT NOT NULL,
  image_url TEXT,
  media_key TEXT,
  image_alt TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_events_event_date
  ON events (event_date ASC);

CREATE TABLE IF NOT EXISTS jobs (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  ressort TEXT NOT NULL,
  standort TEXT NOT NULL,
  arbeitsbereich TEXT NOT NULL,
  date_posted TEXT NOT NULL,
  application_deadline TEXT NOT NULL,
  employment_type TEXT NOT NULL,
  pay_grade TEXT,
  teaser TEXT NOT NULL,
  body_json TEXT NOT NULL,
  contact_json TEXT,
  image_url TEXT,
  media_key TEXT,
  image_alt TEXT,
  image_credit TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_jobs_active_deadline
  ON jobs (is_active DESC, application_deadline ASC);

CREATE INDEX IF NOT EXISTS idx_jobs_date_posted
  ON jobs (date_posted DESC);

CREATE TABLE IF NOT EXISTS project_status (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('umgesetzt', 'teilweise_umgesetzt', 'angelegt')),
  ressort TEXT NOT NULL,
  href TEXT NOT NULL,
  references_json TEXT NOT NULL DEFAULT '[]',
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_status_position
  ON project_status (position ASC);
