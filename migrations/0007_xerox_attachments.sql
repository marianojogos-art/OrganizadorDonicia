-- Additive metadata and one bounded private attachment per request.
ALTER TABLE xerox ADD COLUMN professor TEXT NOT NULL DEFAULT '';
ALTER TABLE xerox ADD COLUMN class TEXT NOT NULL DEFAULT '';
ALTER TABLE xerox ADD COLUMN color TEXT NOT NULL DEFAULT 'Preto e branco' CHECK(color IN ('Preto e branco','Colorido'));
ALTER TABLE xerox ADD COLUMN attachment_name TEXT NOT NULL DEFAULT '';
ALTER TABLE xerox ADD COLUMN attachment_mime TEXT NOT NULL DEFAULT '';
ALTER TABLE xerox ADD COLUMN attachment_data TEXT NOT NULL DEFAULT '' CHECK(length(attachment_data)<=349528);
UPDATE xerox SET professor=COALESCE((SELECT name FROM users WHERE email=xerox.requester),'');
