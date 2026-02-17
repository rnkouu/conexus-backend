# Conexus Database Setup Guide

## Current Setup
- **Backend**: Supabase (PostgreSQL)
- **Database File**: `db/Conexus.dbs` (MySQL schema)

## Steps to Migrate Database to Supabase

### 1. Create Tables in Supabase SQL Editor

Go to your Supabase project → SQL Editor → Create new query and run this:

```sql
-- Create users table
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  university_org VARCHAR(255),
  role VARCHAR(50) DEFAULT 'participant',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create events table
CREATE TABLE events (
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
);

-- Create registrations table
CREATE TABLE registrations (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT,
  event_id BIGINT,
  registration_type VARCHAR(50) DEFAULT 'Member',
  payment_status VARCHAR(50) DEFAULT 'Pending',
  accommodation_needed BOOLEAN DEFAULT FALSE,
  transportation_needed BOOLEAN DEFAULT FALSE,
  qr_code_data VARCHAR(255) UNIQUE,
  status VARCHAR(50) DEFAULT 'For approval',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Create paper_submissions table
CREATE TABLE paper_submissions (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  event_id BIGINT,
  user_email VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  abstract TEXT,
  file_path VARCHAR(500),
  file_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'under_review',
  feedback TEXT,
  presentation_video_url VARCHAR(500),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL
);

-- Create attendance_portals table
CREATE TABLE attendance_portals (
  id VARCHAR(36) PRIMARY KEY,
  event_id BIGINT,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Create attendance_logs table
CREATE TABLE attendance_logs (
  id BIGSERIAL PRIMARY KEY,
  portal_id VARCHAR(36),
  registration_id BIGINT,
  scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (portal_id) REFERENCES attendance_portals(id) ON DELETE CASCADE,
  FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE
);

-- Enable RLS (Row Level Security) for security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_portals ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
```

### 2. Set Up Row Level Security (RLS) Policies

Add these policies in Supabase Authentication → Policies for each table:

**For `users` table:**
- Allow users to view their own profile
- Allow admins to view all users

**For `events` table:**
- Allow public read access
- Allow admins to write

**For `registrations` table:**
- Allow users to view/create their own registrations
- Allow admins full access

### 3. Update Your JavaScript Client

Your `supabaseClient.js` is already set up correctly. Now update queries in other files to use the new table structure.

### 4. Key Changes from MySQL to PostgreSQL

| MySQL | PostgreSQL |
|-------|-----------|
| BIGINT AUTO_INCREMENT | BIGSERIAL |
| ENUM('value1', 'value2') | VARCHAR(50) |
| TIMESTAMP DEFAULT CURRENT_TIMESTAMP | TIMESTAMP DEFAULT CURRENT_TIMESTAMP |

---

## Next Steps

1. ✅ Create tables in Supabase
2. ✅ Set up RLS policies
3. Update your JavaScript files to use Supabase queries
4. Test all functionality

## Files to Update

- `js/AdminDashboard.js` - Event management queries
- `js/ParticipantDashboard.js` - Registration queries
- `js/PresenterDashboard.js` - Paper submission queries
- `js/AttendancePortal.js` - Attendance logging
