-- Idempotency receipts for confirmed employee actions, never conversation text.
CREATE TABLE assistant_operations (
 owner TEXT NOT NULL REFERENCES users(email),
 operation_id TEXT NOT NULL,
 request_hash TEXT NOT NULL,
 record_id TEXT NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('reservation','xerox','message')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(owner,operation_id)
);
