-- Apply this migration in one transaction (D1 migrations do this automatically).
-- All existing user references remain attached to the same email primary keys.
PRAGMA defer_foreign_keys=ON;
CREATE TABLE users_portal(email TEXT PRIMARY KEY,name TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('direction','supervision','guidance','teacher')),active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)));
INSERT INTO users_portal(email,name,role,active) SELECT email,name,role,active FROM users;
DROP TABLE users;
ALTER TABLE users_portal RENAME TO users;
-- The original email keys are restored before ending the temporary deferral.
-- SQLite retains DROP's deferred counter until OFF, despite the restored table.
PRAGMA defer_foreign_keys=OFF;

ALTER TABLE reservations ADD COLUMN status TEXT NOT NULL DEFAULT 'Aprovada' CHECK(status IN ('Pendente','Aprovada','Recusada'));
ALTER TABLE events ADD COLUMN visibility TEXT NOT NULL DEFAULT 'internal' CHECK(visibility IN ('internal','public'));

DROP TRIGGER reservations_no_overlap;
DROP TRIGGER reservations_update_no_overlap;
DROP TRIGGER reservations_fixed_insert;
DROP TRIGGER reservations_fixed_update;
DROP TRIGGER fixed_occupancy_insert;
DROP TRIGGER fixed_occupancy_update;
CREATE TRIGGER reservations_no_overlap BEFORE INSERT ON reservations WHEN NEW.status='Aprovada' BEGIN SELECT RAISE(ABORT,'reservation_conflict') WHERE EXISTS(SELECT 1 FROM reservations WHERE status='Aprovada' AND space=NEW.space AND date=NEW.date AND start<NEW.end AND end>NEW.start); END;
CREATE TRIGGER reservations_update_no_overlap BEFORE UPDATE OF space,date,start,end,status ON reservations WHEN NEW.status='Aprovada' BEGIN SELECT RAISE(ABORT,'reservation_conflict') WHERE EXISTS(SELECT 1 FROM reservations WHERE status='Aprovada' AND space=NEW.space AND date=NEW.date AND start<NEW.end AND end>NEW.start AND id!=NEW.id); END;
CREATE TRIGGER reservations_fixed_insert BEFORE INSERT ON reservations WHEN NEW.status='Aprovada' BEGIN SELECT RAISE(ABORT,'reservation_conflict') WHERE EXISTS(SELECT 1 FROM fixed_occupancy WHERE space=NEW.space AND weekday=CAST(strftime('%w',NEW.date) AS INTEGER) AND NEW.date BETWEEN from_date AND to_date AND start<NEW.end AND end>NEW.start); END;
CREATE TRIGGER reservations_fixed_update BEFORE UPDATE OF space,date,start,end,status ON reservations WHEN NEW.status='Aprovada' BEGIN SELECT RAISE(ABORT,'reservation_conflict') WHERE EXISTS(SELECT 1 FROM fixed_occupancy WHERE space=NEW.space AND weekday=CAST(strftime('%w',NEW.date) AS INTEGER) AND NEW.date BETWEEN from_date AND to_date AND start<NEW.end AND end>NEW.start); END;
CREATE TRIGGER fixed_occupancy_insert BEFORE INSERT ON fixed_occupancy BEGIN SELECT RAISE(ABORT,'reservation_conflict') WHERE EXISTS(SELECT 1 FROM fixed_occupancy WHERE space=NEW.space AND weekday=NEW.weekday AND from_date<=NEW.to_date AND to_date>=NEW.from_date AND start<NEW.end AND end>NEW.start) OR EXISTS(SELECT 1 FROM reservations WHERE status='Aprovada' AND space=NEW.space AND CAST(strftime('%w',date) AS INTEGER)=NEW.weekday AND date BETWEEN NEW.from_date AND NEW.to_date AND start<NEW.end AND end>NEW.start); END;
CREATE TRIGGER fixed_occupancy_update BEFORE UPDATE ON fixed_occupancy BEGIN SELECT RAISE(ABORT,'reservation_conflict') WHERE EXISTS(SELECT 1 FROM fixed_occupancy WHERE id!=NEW.id AND space=NEW.space AND weekday=NEW.weekday AND from_date<=NEW.to_date AND to_date>=NEW.from_date AND start<NEW.end AND end>NEW.start) OR EXISTS(SELECT 1 FROM reservations WHERE status='Aprovada' AND space=NEW.space AND CAST(strftime('%w',date) AS INTEGER)=NEW.weekday AND date BETWEEN NEW.from_date AND NEW.to_date AND start<NEW.end AND end>NEW.start); END;

CREATE TABLE school_profile(id INTEGER PRIMARY KEY CHECK(id=1),name TEXT NOT NULL,introduction TEXT NOT NULL DEFAULT '',address TEXT NOT NULL DEFAULT '',phone TEXT NOT NULL DEFAULT '',email TEXT NOT NULL DEFAULT '',hours TEXT NOT NULL DEFAULT '',version INTEGER NOT NULL DEFAULT 1);
INSERT INTO school_profile(id,name,introduction) VALUES(1,'EBM Donícia Maria da Costa','Informações e serviços para estudantes, famílias e comunidade escolar.');
CREATE TABLE notices(id TEXT PRIMARY KEY,title TEXT NOT NULL,body TEXT NOT NULL,date TEXT NOT NULL,published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1)),creator TEXT NOT NULL REFERENCES users(email),version INTEGER NOT NULL DEFAULT 1);
CREATE INDEX notices_public_date ON notices(published,date);
CREATE TABLE trainings(id TEXT PRIMARY KEY,title TEXT NOT NULL,area TEXT NOT NULL,date TEXT NOT NULL,start TEXT NOT NULL DEFAULT '',end TEXT NOT NULL DEFAULT '',location TEXT NOT NULL DEFAULT '',notes TEXT NOT NULL DEFAULT '',creator TEXT NOT NULL REFERENCES users(email),version INTEGER NOT NULL DEFAULT 1,CHECK((start='' AND end='') OR (start<>'' AND end>start)));
CREATE INDEX trainings_area_date ON trainings(area,date,start);
