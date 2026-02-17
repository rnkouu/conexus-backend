-- ============================================
-- Conexus Supabase Database Setup SQL
-- ============================================
-- Run this in your Supabase SQL Editor to create all tables

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255),
  full_name VARCHAR(255) NOT NULL,
  university_org VARCHAR(255),
  role VARCHAR(50) DEFAULT 'participant',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Events table
CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(100) DEFAULT 'Conference',
  mode VARCHAR(50) DEFAULT 'Online',
  start_date DATE,
  end_date DATE,
  location VARCHAR(255),
  track VARCHAR(100),
  featured BOOLEAN DEFAULT FALSE,
  past BOOLEAN DEFAULT FALSE
) WITH (fillfactor=70);

-- 3. Registrations table
CREATE TABLE IF NOT EXISTS registrations (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_id BIGINT REFERENCES events(id) ON DELETE CASCADE,
  registration_type VARCHAR(50) DEFAULT 'Member',
  payment_status VARCHAR(50) DEFAULT 'Pending',
  accommodation_needed BOOLEAN DEFAULT FALSE,
  transportation_needed BOOLEAN DEFAULT FALSE,
  qr_code_data VARCHAR(255) UNIQUE,
  full_name VARCHAR(255),
  email VARCHAR(255),
  university VARCHAR(255),
  contact VARCHAR(255),
  participants_count INT DEFAULT 1,
  notes TEXT,
  status VARCHAR(50) DEFAULT 'For approval',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Paper Submissions table
CREATE TABLE IF NOT EXISTS paper_submissions (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  event_id BIGINT REFERENCES events(id) ON DELETE SET NULL,
  user_email VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  abstract TEXT,
  file_path VARCHAR(500),
  file_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'under_review',
  feedback TEXT,
  presentation_video_url VARCHAR(500),
  track VARCHAR(100) DEFAULT 'General Research'
);

-- 5. Attendance Portals table
CREATE TABLE IF NOT EXISTS attendance_portals (
  id VARCHAR(36) PRIMARY KEY,
  event_id BIGINT REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Attendance Logs table
CREATE TABLE IF NOT EXISTS attendance_logs (
  id BIGSERIAL PRIMARY KEY,
  portal_id VARCHAR(36) REFERENCES attendance_portals(id) ON DELETE CASCADE,
  registration_id BIGINT REFERENCES registrations(id) ON DELETE CASCADE,
  scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Enable Row Level Security (RLS)
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_portals ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies
-- ============================================

-- USERS: Public read, authenticated update own profile
DROP POLICY IF EXISTS "Users can read own profile" ON users;
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  USING (auth.uid() = id OR role = 'admin');

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- EVENTS: Public read, admin write
DROP POLICY IF EXISTS "Events are public" ON events;
CREATE POLICY "Events are public"
  ON events FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Only admins can insert events" ON events;
CREATE POLICY "Only admins can insert events"
  ON events FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Only admins can update events" ON events;
CREATE POLICY "Only admins can update events"
  ON events FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- REGISTRATIONS: Users can read/create own, admins full access
DROP POLICY IF EXISTS "Users can read registrations" ON registrations;
CREATE POLICY "Users can read registrations"
  ON registrations FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Users can create registrations" ON registrations;
CREATE POLICY "Users can create registrations"
  ON registrations FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own registrations" ON registrations;
CREATE POLICY "Users can update own registrations"
  ON registrations FOR UPDATE
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- PAPER_SUBMISSIONS: Users can read/create/update own
DROP POLICY IF EXISTS "Paper submissions are readable" ON paper_submissions;
CREATE POLICY "Paper submissions are readable"
  ON paper_submissions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can submit papers" ON paper_submissions;
CREATE POLICY "Authenticated users can submit papers"
  ON paper_submissions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can update own papers" ON paper_submissions;
CREATE POLICY "Users can update own papers"
  ON paper_submissions FOR UPDATE
  USING (
    user_email = auth.email() OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- ATTENDANCE_PORTALS: Public read, admin write
DROP POLICY IF EXISTS "Portals are readable" ON attendance_portals;
CREATE POLICY "Portals are readable"
  ON attendance_portals FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Only admins can manage portals" ON attendance_portals;
CREATE POLICY "Only admins can manage portals"
  ON attendance_portals FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- ATTENDANCE_LOGS: Append-only for logged-in users
DROP POLICY IF EXISTS "Attendance logs are readable by all" ON attendance_logs;
CREATE POLICY "Attendance logs are readable by all"
  ON attendance_logs FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can log attendance" ON attendance_logs;
CREATE POLICY "Authenticated users can log attendance"
  ON attendance_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- Storage Buckets for File Uploads
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('papers', 'papers', true)
ON CONFLICT DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('presentations', 'presentations', true)
ON CONFLICT DO NOTHING;

-- Storage RLS Policies for papers bucket
DROP POLICY IF EXISTS "Allow authenticated uploads to papers" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to papers"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'papers');

DROP POLICY IF EXISTS "Allow public read papers" ON storage.objects;
CREATE POLICY "Allow public read papers"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'papers');

-- Storage RLS Policies for presentations bucket
DROP POLICY IF EXISTS "Allow authenticated uploads to presentations" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to presentations"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'presentations');

DROP POLICY IF EXISTS "Allow public read presentations" ON storage.objects;
CREATE POLICY "Allow public read presentations"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'presentations');

-- ============================================
-- Database Views for Analytics
-- ============================================

-- View: Event Registration Statistics
DROP VIEW IF EXISTS event_registration_stats;
CREATE VIEW event_registration_stats AS
SELECT 
  e.id,
  e.title,
  e.start_date,
  COUNT(r.id) as total_registrations,
  COUNT(CASE WHEN r.payment_status = 'Completed' THEN 1 END) as paid_registrations,
  COUNT(DISTINCT r.user_id) as unique_participants
FROM events e
LEFT JOIN registrations r ON e.id = r.event_id
GROUP BY e.id, e.title, e.start_date;

-- View: Paper Submission Statistics
DROP VIEW IF EXISTS paper_submission_stats;
CREATE VIEW paper_submission_stats AS
SELECT 
  e.id,
  e.title,
  COUNT(ps.id) as total_submissions,
  COUNT(CASE WHEN ps.status = 'approved' THEN 1 END) as approved_papers,
  COUNT(CASE WHEN ps.status = 'under_review' THEN 1 END) as under_review,
  COUNT(CASE WHEN ps.status = 'rejected' THEN 1 END) as rejected
FROM events e
LEFT JOIN paper_submissions ps ON e.id = ps.event_id
GROUP BY e.id, e.title;

-- View: Attendance Summary
DROP VIEW IF EXISTS attendance_summary;
CREATE VIEW attendance_summary AS
SELECT 
  ap.event_id,
  e.title as event_title,
  ap.name as portal_name,
  COUNT(al.id) as attendance_count,
  MAX(al.scanned_at) as last_scan_time
FROM attendance_portals ap
LEFT JOIN events e ON ap.event_id = e.id
LEFT JOIN attendance_logs al ON ap.id = al.portal_id
GROUP BY ap.id, ap.event_id, e.title, ap.name;

-- ============================================
-- Database Indexes for Performance
-- ============================================

-- User table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Events table indexes
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_featured ON events(featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS idx_events_past ON events(past);

-- Registrations table indexes
CREATE INDEX IF NOT EXISTS idx_registrations_user_id ON registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_registrations_event_id ON registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_status ON registrations(status);
CREATE INDEX IF NOT EXISTS idx_registrations_payment_status ON registrations(payment_status);

-- Paper submissions table indexes
CREATE INDEX IF NOT EXISTS idx_paper_submissions_event_id ON paper_submissions(event_id);
CREATE INDEX IF NOT EXISTS idx_paper_submissions_email ON paper_submissions(user_email);
CREATE INDEX IF NOT EXISTS idx_paper_submissions_status ON paper_submissions(status);

-- Attendance tables indexes
CREATE INDEX IF NOT EXISTS idx_attendance_logs_portal_id ON attendance_logs(portal_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_registration_id ON attendance_logs(registration_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_scanned_at ON attendance_logs(scanned_at);
CREATE INDEX IF NOT EXISTS idx_attendance_portals_event_id ON attendance_portals(event_id);

-- ============================================
-- Optional: Insert sample data
-- ============================================

-- Sample Event
INSERT INTO events (title, description, type, mode, start_date, end_date, location, featured, past)
VALUES (
  'Campus Research Colloquium 2025',
  'Student and faculty presentations on applied research',
  'Conference',
  'Hybrid',
  '2025-03-15',
  '2025-03-16',
  'Adventist University of the Philippines, Cavite',
  true,
  false
) ON CONFLICT DO NOTHING;
