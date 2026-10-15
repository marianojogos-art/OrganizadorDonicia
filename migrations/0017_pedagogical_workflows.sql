-- Additive changes: preserve all existing records and approval constraints.
ALTER TABLE reservations ADD COLUMN needs_adjustment INTEGER NOT NULL DEFAULT 0 CHECK(needs_adjustment IN(0,1));
ALTER TABLE reservations ADD COLUMN review_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE staff_requests ADD COLUMN needs_adjustment INTEGER NOT NULL DEFAULT 0 CHECK(needs_adjustment IN(0,1));
ALTER TABLE staff_requests ADD COLUMN review_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE xerox ADD COLUMN review_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE notices ADD COLUMN featured INTEGER NOT NULL DEFAULT 1 CHECK(featured IN(0,1));
ALTER TABLE notices ADD COLUMN highlight_from TEXT NOT NULL DEFAULT '';
ALTER TABLE notices ADD COLUMN highlight_until TEXT NOT NULL DEFAULT '';
ALTER TABLE public_content ADD COLUMN featured INTEGER NOT NULL DEFAULT 0 CHECK(featured IN(0,1));
ALTER TABLE public_content ADD COLUMN highlight_from TEXT NOT NULL DEFAULT '';
ALTER TABLE public_content ADD COLUMN highlight_until TEXT NOT NULL DEFAULT '';
CREATE TRIGGER reservations_adjustment_guard BEFORE UPDATE ON reservations
WHEN NEW.needs_adjustment=1 AND (NEW.status<>'Pendente' OR trim(NEW.review_reason)='')
BEGIN SELECT RAISE(ABORT,'adjustment_requires_reason'); END;
CREATE TRIGGER staff_requests_adjustment_guard BEFORE UPDATE ON staff_requests
WHEN NEW.needs_adjustment=1 AND (NEW.status<>'Pendente' OR trim(NEW.review_reason)='')
BEGIN SELECT RAISE(ABORT,'adjustment_requires_reason'); END;
