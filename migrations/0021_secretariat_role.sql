-- Add only the explicitly requested Secretariat profile. Never assign it by inference.
-- Same atomic user-table migration strategy as 0010; preserve all email keys/references.
PRAGMA defer_foreign_keys=ON;
CREATE TABLE users_secretariat(email TEXT PRIMARY KEY,name TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('direction','supervision','guidance','teacher','secretary')),active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)));
INSERT INTO users_secretariat(email,name,role,active) SELECT email,name,role,active FROM users;
DROP TABLE users;
ALTER TABLE users_secretariat RENAME TO users;
PRAGMA defer_foreign_keys=OFF;
