-- Publishing never enables collection. Activation is an audited runtime action.
CREATE TABLE secretariat_intake (
 id INTEGER PRIMARY KEY CHECK(id=1),
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 updated_by TEXT REFERENCES users(email),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO secretariat_intake(id,enabled) VALUES(1,0);
