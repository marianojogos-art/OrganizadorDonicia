-- Runtime grants only. No names/emails or automatic role-wide grants in source control.
CREATE TABLE secretariat_access (
 email TEXT PRIMARY KEY REFERENCES users(email) ON DELETE CASCADE,
 granted_by TEXT NOT NULL REFERENCES users(email),
 granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE secretariat_access_initialization (
 id INTEGER PRIMARY KEY CHECK(id=1),
 actor TEXT NOT NULL REFERENCES users(email),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
