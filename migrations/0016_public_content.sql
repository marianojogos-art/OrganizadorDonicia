-- Additive migration: existing notices and all private content are preserved.
ALTER TABLE notices ADD COLUMN expires_on TEXT NOT NULL DEFAULT '';
CREATE TABLE public_content (
 id TEXT PRIMARY KEY,
 kind TEXT NOT NULL CHECK(kind IN ('project','document')),
 title TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 category TEXT NOT NULL DEFAULT 'Geral',
 url TEXT NOT NULL DEFAULT '',
 published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1)),
 attachment_name TEXT NOT NULL DEFAULT '',
 attachment_mime TEXT NOT NULL DEFAULT '',
 attachment_data TEXT NOT NULL DEFAULT '',
 image_alt TEXT NOT NULL DEFAULT '',
 creator TEXT NOT NULL REFERENCES users(email),
 version INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX public_content_public_kind ON public_content(published,kind,title);
