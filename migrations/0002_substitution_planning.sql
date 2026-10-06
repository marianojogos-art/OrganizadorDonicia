ALTER TABLE substitutions ADD COLUMN completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1) AND (completed=0 OR auxiliary IS NOT NULL));
CREATE TABLE teacher_directory(id INTEGER PRIMARY KEY CHECK(id=1),names TEXT NOT NULL,source_version TEXT NOT NULL,fetched_at TEXT NOT NULL);
INSERT OR IGNORE INTO auxiliaries(id,name) VALUES
 ('aux-example-ana','Ana (fictícia)'),
 ('aux-example-beatriz','Beatriz (fictícia)'),
 ('aux-example-carla','Carla (fictícia)');
DROP TRIGGER auxiliaries_deactivate;
CREATE TRIGGER auxiliaries_deactivate AFTER UPDATE OF active ON auxiliaries WHEN NEW.active=0 AND OLD.active=1 BEGIN UPDATE substitutions SET auxiliary=NULL,version=version+1 WHERE auxiliary=NEW.id AND completed=0 AND date>=date('now','-3 hours'); END;
