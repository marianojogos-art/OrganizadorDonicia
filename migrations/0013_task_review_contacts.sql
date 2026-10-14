-- Existing tasks and public contact data remain unchanged.
ALTER TABLE tasks ADD COLUMN verifier TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN verified_by TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN verified_at TEXT NOT NULL DEFAULT '';
ALTER TABLE school_profile ADD COLUMN whatsapp_secretaria TEXT NOT NULL DEFAULT '';
ALTER TABLE school_profile ADD COLUMN whatsapp_orientacao TEXT NOT NULL DEFAULT '';
