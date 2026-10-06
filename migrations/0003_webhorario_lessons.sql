ALTER TABLE teacher_directory ADD COLUMN schedule TEXT NOT NULL DEFAULT '{}';
CREATE TABLE substitution_absences(id TEXT PRIMARY KEY,teacher TEXT NOT NULL,start_date TEXT NOT NULL,total_days INTEGER NOT NULL CHECK(total_days BETWEEN 1 AND 31),source_version TEXT NOT NULL,creator TEXT NOT NULL REFERENCES users(email),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
ALTER TABLE substitutions ADD COLUMN absence_id TEXT REFERENCES substitution_absences(id);
ALTER TABLE substitutions ADD COLUMN subject TEXT NOT NULL DEFAULT '';
CREATE INDEX substitutions_absence ON substitutions(absence_id,date,start);
