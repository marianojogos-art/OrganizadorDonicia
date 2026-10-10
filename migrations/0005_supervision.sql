CREATE TABLE supervision_state(id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL DEFAULT 0, token TEXT, metadata TEXT NOT NULL DEFAULT '{}');
INSERT INTO supervision_state(id) VALUES(1);
CREATE TABLE supervision_classes(class_id TEXT PRIMARY KEY, data TEXT NOT NULL);
