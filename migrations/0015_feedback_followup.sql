-- Additive, private and append-only. Existing contributions and their authors stay intact.
CREATE TABLE site_feedback_history (
 id TEXT PRIMARY KEY,
 feedback_id TEXT NOT NULL REFERENCES site_feedback(id) ON DELETE RESTRICT,
 feedback_version INTEGER NOT NULL CHECK(feedback_version>1),
 actor TEXT NOT NULL,
 actor_name TEXT NOT NULL,
 from_status TEXT NOT NULL CHECK(from_status IN ('Nova','Em análise','Planejada','Implementada')),
 to_status TEXT NOT NULL CHECK(to_status IN ('Nova','Em análise','Planejada','Implementada')),
 reply TEXT NOT NULL DEFAULT '' CHECK(length(reply)<=2500),
 evidence TEXT NOT NULL DEFAULT '' CHECK(length(evidence)<=1500),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(feedback_id,feedback_version)
);
CREATE INDEX site_feedback_history_order ON site_feedback_history(feedback_id,feedback_version);
CREATE TRIGGER site_feedback_history_no_update BEFORE UPDATE ON site_feedback_history BEGIN SELECT RAISE(ABORT,'feedback_history_immutable'); END;
CREATE TRIGGER site_feedback_history_no_delete BEFORE DELETE ON site_feedback_history BEGIN SELECT RAISE(ABORT,'feedback_history_immutable'); END;
