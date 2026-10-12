-- Additive: existing bookings and weekly agendas keep their IDs, dates and owners.
ALTER TABLE reservations ADD COLUMN class TEXT NOT NULL DEFAULT '';
ALTER TABLE reservations ADD COLUMN subject TEXT NOT NULL DEFAULT '';
ALTER TABLE fixed_occupancy ADD COLUMN class TEXT NOT NULL DEFAULT '';
ALTER TABLE fixed_occupancy ADD COLUMN subject TEXT NOT NULL DEFAULT '';
ALTER TABLE fixed_occupancy ADD COLUMN responsible TEXT NOT NULL DEFAULT '';
UPDATE fixed_occupancy SET responsible=COALESCE((SELECT name FROM users WHERE email=fixed_occupancy.creator),'');
DROP TRIGGER fixed_occupancy_insert;
DROP TRIGGER fixed_occupancy_update;
CREATE TRIGGER fixed_occupancy_insert BEFORE INSERT ON fixed_occupancy BEGIN SELECT RAISE(ABORT,'reservation_conflict') WHERE EXISTS(SELECT 1 FROM fixed_occupancy WHERE space=NEW.space AND weekday=NEW.weekday AND from_date<=NEW.to_date AND to_date>=NEW.from_date AND date(max(from_date,NEW.from_date),'+' || ((NEW.weekday-CAST(strftime('%w',max(from_date,NEW.from_date)) AS INTEGER)+7)%7) || ' days')<=min(to_date,NEW.to_date) AND start<NEW.end AND end>NEW.start) OR EXISTS(SELECT 1 FROM reservations WHERE space=NEW.space AND CAST(strftime('%w',date) AS INTEGER)=NEW.weekday AND date BETWEEN NEW.from_date AND NEW.to_date AND start<NEW.end AND end>NEW.start); END;
CREATE TRIGGER fixed_occupancy_update BEFORE UPDATE ON fixed_occupancy BEGIN SELECT RAISE(ABORT,'reservation_conflict') WHERE EXISTS(SELECT 1 FROM fixed_occupancy WHERE id!=NEW.id AND space=NEW.space AND weekday=NEW.weekday AND from_date<=NEW.to_date AND to_date>=NEW.from_date AND date(max(from_date,NEW.from_date),'+' || ((NEW.weekday-CAST(strftime('%w',max(from_date,NEW.from_date)) AS INTEGER)+7)%7) || ' days')<=min(to_date,NEW.to_date) AND start<NEW.end AND end>NEW.start) OR EXISTS(SELECT 1 FROM reservations WHERE space=NEW.space AND CAST(strftime('%w',date) AS INTEGER)=NEW.weekday AND date BETWEEN NEW.from_date AND NEW.to_date AND start<NEW.end AND end>NEW.start); END;
