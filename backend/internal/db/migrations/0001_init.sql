-- Roadmap boards. Quarter labels in the UI are derived from `year`.
CREATE TABLE IF NOT EXISTS roadmaps (
    id         TEXT PRIMARY KEY,
    name       TEXT    NOT NULL,
    year       INTEGER NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Rows of the capacity view. `capacity_etp` is the ceiling drawn as the dashed
-- line across the row.
CREATE TABLE IF NOT EXISTS teams (
    id           TEXT PRIMARY KEY,
    roadmap_id   TEXT    NOT NULL REFERENCES roadmaps (id) ON DELETE CASCADE,
    name         TEXT    NOT NULL,
    capacity_etp REAL    NOT NULL CHECK (capacity_etp > 0),
    position     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_teams_roadmap ON teams (roadmap_id, position);

-- Rows of the review view, and the colour identity of a work brick. The palette
-- lives with the data so the frontend never hardcodes colours for themes users
-- can rename or add.
CREATE TABLE IF NOT EXISTS themes (
    id         TEXT PRIMARY KEY,
    roadmap_id TEXT    NOT NULL REFERENCES roadmaps (id) ON DELETE CASCADE,
    name       TEXT    NOT NULL,
    base_color TEXT    NOT NULL,
    tint_color TEXT    NOT NULL,
    ink_color  TEXT    NOT NULL,
    line_color TEXT    NOT NULL,
    icon_path  TEXT    NOT NULL DEFAULT '',
    position   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_themes_roadmap ON themes (roadmap_id, position);

-- One block on the grid.
--
-- The CHECK constraints mirror domain.Brick.Validate: a brick that escaped these
-- bounds would break the stacking algorithm and the capacity math, so the
-- database refuses it even if a future caller bypasses the service layer.
CREATE TABLE IF NOT EXISTS bricks (
    id          TEXT PRIMARY KEY,
    roadmap_id  TEXT    NOT NULL REFERENCES roadmaps (id) ON DELETE CASCADE,
    team_id     TEXT    NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
    theme_id    TEXT             REFERENCES themes (id) ON DELETE SET NULL,
    kind        TEXT    NOT NULL DEFAULT 'work' CHECK (kind IN ('work', 'absence')),
    title       TEXT    NOT NULL CHECK (length(trim(title)) > 0),
    etp         REAL    NOT NULL CHECK (etp >= 0.5 AND etp <= 6),
    start_month INTEGER NOT NULL CHECK (start_month >= 0 AND start_month < 12),
    duration    INTEGER NOT NULL CHECK (duration >= 1),
    link        TEXT    NOT NULL DEFAULT '',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    -- A brick never spills past December.
    CHECK (start_month + duration <= 12),
    -- An absence eats capacity without carrying a theme; project work always
    -- carries one.
    CHECK ((kind = 'absence' AND theme_id IS NULL) OR (kind = 'work' AND theme_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_bricks_roadmap ON bricks (roadmap_id);
CREATE INDEX IF NOT EXISTS idx_bricks_team ON bricks (team_id);
CREATE INDEX IF NOT EXISTS idx_bricks_theme ON bricks (theme_id);

-- Directed sequencing links between bricks. The unique index makes the
-- "already linked" case a database guarantee rather than a race between two
-- concurrent drags.
CREATE TABLE IF NOT EXISTS dependencies (
    id            TEXT PRIMARY KEY,
    roadmap_id    TEXT NOT NULL REFERENCES roadmaps (id) ON DELETE CASCADE,
    from_brick_id TEXT NOT NULL REFERENCES bricks (id) ON DELETE CASCADE,
    to_brick_id   TEXT NOT NULL REFERENCES bricks (id) ON DELETE CASCADE,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (from_brick_id <> to_brick_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dependencies_pair
    ON dependencies (from_brick_id, to_brick_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_roadmap ON dependencies (roadmap_id);
