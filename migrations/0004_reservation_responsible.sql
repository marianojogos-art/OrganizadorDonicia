ALTER TABLE reservations ADD COLUMN responsible TEXT NOT NULL DEFAULT '';
UPDATE reservations SET responsible = COALESCE((SELECT name FROM users WHERE users.email = reservations.owner), owner);
