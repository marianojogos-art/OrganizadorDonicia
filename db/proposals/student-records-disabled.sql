-- DESIGN ONLY. Not in migrations; no production endpoint or student persistence enabled.
-- Requires approved purpose, retention, guardians/student access rules and staff role matrix.
CREATE TABLE student_demo_records (
 id TEXT PRIMARY KEY,
 synthetic_student_code TEXT NOT NULL CHECK(synthetic_student_code LIKE 'DEMO-%'),
 synthetic_class_code TEXT NOT NULL CHECK(synthetic_class_code LIKE 'DEMO-%'),
 kind TEXT NOT NULL CHECK(kind IN ('late','justified_absence')),
 start_date TEXT NOT NULL,
 end_date TEXT,
 arrival_time TEXT,
 reason_category TEXT NOT NULL CHECK(reason_category IN ('transport','family','other')),
 author_email TEXT NOT NULL REFERENCES users(email),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 delete_after TEXT NOT NULL
);
-- No names, health details, free-text justifications or imported SGE attendance.
