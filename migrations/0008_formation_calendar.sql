-- Preserve all existing calendar rows and their type constraint.
ALTER TABLE events ADD COLUMN formation INTEGER NOT NULL DEFAULT 0 CHECK(formation IN (0,1));
ALTER TABLE events ADD COLUMN start TEXT NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN end TEXT NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN location TEXT NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN details TEXT NOT NULL DEFAULT '';
