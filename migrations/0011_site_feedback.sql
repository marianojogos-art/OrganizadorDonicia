-- Additive: visitor contributions never appear in the public school feed.
CREATE TABLE site_feedback (
 id TEXT PRIMARY KEY,
 visitor_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('impression','improvement','feature')),
 message TEXT NOT NULL CHECK(length(message) BETWEEN 1 AND 3000),
 contributor TEXT NOT NULL DEFAULT '' CHECK(length(contributor)<=80),
 page_path TEXT NOT NULL CHECK(length(page_path)<=200),
 page_section TEXT NOT NULL DEFAULT '' CHECK(length(page_section)<=80),
 page_title TEXT NOT NULL CHECK(length(page_title) BETWEEN 1 AND 180),
 status TEXT NOT NULL DEFAULT 'Nova' CHECK(status IN ('Nova','Em análise','Planejada','Implementada')),
 version INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX site_feedback_page ON site_feedback(page_path,page_section,created_at);
CREATE INDEX site_feedback_status ON site_feedback(status,created_at);
CREATE INDEX site_feedback_visitor ON site_feedback(visitor_id,created_at);
