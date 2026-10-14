-- Private staff workflows only. No public assets or external message delivery.
CREATE TABLE staff_requests (
 id TEXT PRIMARY KEY,
 requester TEXT NOT NULL REFERENCES users(email),
 type TEXT NOT NULL CHECK(type IN ('message','material')),
 title TEXT NOT NULL,
 classes TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 deadline TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'Pendente' CHECK(status IN ('Pendente','Em análise','Aprovada','Recusada','Concluída')),
 version INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX staff_requests_requester_deadline ON staff_requests(requester,deadline);
CREATE TABLE pedagogical_album (
 id TEXT PRIMARY KEY,
 creator TEXT NOT NULL REFERENCES users(email),
 title TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 date TEXT NOT NULL,
 attachment_name TEXT NOT NULL,
 attachment_mime TEXT NOT NULL CHECK(attachment_mime IN ('image/jpeg','image/png')),
 attachment_data TEXT NOT NULL CHECK(length(attachment_data)<=349528),
 version INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX pedagogical_album_date ON pedagogical_album(date);
CREATE TABLE resource_library (
 id TEXT PRIMARY KEY,
 creator TEXT NOT NULL REFERENCES users(email),
 title TEXT NOT NULL,
 category TEXT NOT NULL CHECK(category IN ('bncc','matriz','documentos')),
 url TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 version INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX resource_library_category ON resource_library(category,title);
