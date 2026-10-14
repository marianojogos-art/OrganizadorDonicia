-- Anonymous portal measurements, independent of users and contributions.
-- Never store raw UUIDs, IPs, cookies, URLs, referrers or user agents.
CREATE TABLE site_metrics_daily (
 day TEXT PRIMARY KEY,
 views INTEGER NOT NULL DEFAULT 0,
 estimated_visits INTEGER NOT NULL DEFAULT 0,
 section_clicks INTEGER NOT NULL DEFAULT 0,
 whatsapp_clicks INTEGER NOT NULL DEFAULT 0,
 accepted_events INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE site_metrics_sections (
 day TEXT NOT NULL,
 section TEXT NOT NULL,
 event TEXT NOT NULL,
 count INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(day,section,event)
);
CREATE TABLE site_metrics_sessions (
 day TEXT NOT NULL,
 session_hash TEXT NOT NULL,
 events INTEGER NOT NULL DEFAULT 0,
 views INTEGER NOT NULL DEFAULT 0,
 created_ms INTEGER NOT NULL,
 PRIMARY KEY(day,session_hash)
);
CREATE TABLE site_metrics_events (
 event_hash TEXT PRIMARY KEY,
 day TEXT NOT NULL,
 session_hash TEXT NOT NULL,
 event TEXT NOT NULL CHECK(event IN ('page_view','section_click','whatsapp_click')),
 section TEXT NOT NULL CHECK(section IN ('home','escola','avisos','calendario','contatos','redes','entrada_equipe','whatsapp_secretaria','whatsapp_orientacao')),
 created_ms INTEGER NOT NULL,
 CHECK((event='page_view' AND section='home') OR (event='section_click' AND section IN ('escola','avisos','calendario','contatos','redes','entrada_equipe')) OR (event='whatsapp_click' AND section IN ('whatsapp_secretaria','whatsapp_orientacao')))
);
CREATE INDEX site_metrics_events_session ON site_metrics_events(day,session_hash,event,section,created_ms);
CREATE INDEX site_metrics_events_retention ON site_metrics_events(created_ms);
CREATE INDEX site_metrics_sessions_retention ON site_metrics_sessions(created_ms);
-- Guards execute inside the insert transaction, including concurrent D1 requests.
CREATE TRIGGER site_metrics_guard BEFORE INSERT ON site_metrics_events BEGIN SELECT RAISE(IGNORE) WHERE COALESCE((SELECT accepted_events FROM site_metrics_daily WHERE day=NEW.day),0)>=20000; SELECT RAISE(IGNORE) WHERE COALESCE((SELECT events FROM site_metrics_sessions WHERE day=NEW.day AND session_hash=NEW.session_hash),0)>=100; SELECT RAISE(IGNORE) WHERE NEW.event='page_view' AND COALESCE((SELECT views FROM site_metrics_sessions WHERE day=NEW.day AND session_hash=NEW.session_hash),0)>=20; SELECT RAISE(IGNORE) WHERE EXISTS(SELECT 1 FROM site_metrics_events WHERE day=NEW.day AND session_hash=NEW.session_hash AND event=NEW.event AND section=NEW.section AND created_ms>NEW.created_ms-2000); END;
CREATE TRIGGER site_metrics_aggregate AFTER INSERT ON site_metrics_events BEGIN INSERT INTO site_metrics_daily(day,views,estimated_visits,section_clicks,whatsapp_clicks,accepted_events) VALUES(NEW.day,NEW.event='page_view',NOT EXISTS(SELECT 1 FROM site_metrics_sessions WHERE day=NEW.day AND session_hash=NEW.session_hash),NEW.event='section_click',NEW.event='whatsapp_click',1) ON CONFLICT(day) DO UPDATE SET views=views+excluded.views,estimated_visits=estimated_visits+excluded.estimated_visits,section_clicks=section_clicks+excluded.section_clicks,whatsapp_clicks=whatsapp_clicks+excluded.whatsapp_clicks,accepted_events=accepted_events+1; INSERT INTO site_metrics_sessions(day,session_hash,events,views,created_ms) VALUES(NEW.day,NEW.session_hash,1,NEW.event='page_view',NEW.created_ms) ON CONFLICT(day,session_hash) DO UPDATE SET events=events+1,views=views+excluded.views; INSERT INTO site_metrics_sections(day,section,event,count) VALUES(NEW.day,NEW.section,NEW.event,1) ON CONFLICT(day,section,event) DO UPDATE SET count=count+1; END;
