-- Private contact requests. Public collection remains disabled until routing is confirmed.
CREATE TABLE secretariat_requests (
 id TEXT PRIMARY KEY,
 kind TEXT NOT NULL CHECK(kind IN ('documents','vacancy','transfer')),
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
 contact TEXT NOT NULL CHECK(length(contact) BETWEEN 3 AND 150),
 status TEXT NOT NULL DEFAULT 'Registrado' CHECK(status IN ('Registrado','Encaminhado','Atendido')),
 evidence TEXT NOT NULL DEFAULT '',
 version INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX secretariat_requests_status_date ON secretariat_requests(status,created_at);
CREATE INDEX secretariat_requests_contact_date ON secretariat_requests(contact,created_at);
