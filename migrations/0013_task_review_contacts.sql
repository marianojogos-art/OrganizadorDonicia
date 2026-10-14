-- Existing tasks and public contact data remain unchanged.
ALTER TABLE tasks ADD COLUMN verifier TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN verified_by TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN verified_at TEXT NOT NULL DEFAULT '';
ALTER TABLE school_profile ADD COLUMN whatsapp_secretaria TEXT NOT NULL DEFAULT '';
ALTER TABLE school_profile ADD COLUMN whatsapp_orientacao TEXT NOT NULL DEFAULT '';

-- Public WhatsApp supplied and authorized by Mariano; not a phone-call number.
-- Keep any institutional value already configured; no inference of an extra digit.
UPDATE school_profile SET whatsapp_secretaria='554888734629',version=version+1 WHERE id=1 AND whatsapp_secretaria='';
