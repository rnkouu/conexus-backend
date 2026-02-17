# Conexus AI Coding Instructions

**Project**: Research Event Management Portal  
**Stack**: React (browser-based), Supabase PostgreSQL, Tailwind CSS  
**Key Files**: `index.html`, `js/*.js`, `db/supabase-setup.sql`

---

## Architecture Overview

### Multi-Dashboard React SPA
Conexus is a single-page application with role-based dashboards:
- **Admin Dashboard** (`AdminDashboard.js`) - event creation, registration approvals, attendance portals
- **Participant Dashboard** (`ParticipantDashboard.js`) - event discovery, registration, certificate downloads
- **Presenter Dashboard** (`PresenterDashboard.js`) - paper submission with PDF upload, review tracking
- **Attendance Portal** (`AttendancePortal.js`) - QR code scanning for check-in

All components use a global Supabase client (`window.supabaseClient` from `supabaseClient.js`).

### Database Layer
6-table PostgreSQL schema with Row Level Security (RLS):
- **users** (UUID primary key, Supabase Auth compatible)
- **events** (featured/past event filtering)
- **registrations** (links users to events, tracks payment/accommodation needs)
- **paper_submissions** (research paper submissions with approval workflow)
- **attendance_portals** (QR scanner endpoints)
- **attendance_logs** (check-in records)

Analytics views: `event_registration_stats`, `paper_submission_stats`, `attendance_summary`

---

## Critical Developer Workflows

### Database Setup
```bash
# Single command: copy `db/supabase-setup.sql` into Supabase SQL Editor → Run
# Creates all tables, RLS policies, storage buckets, views, and indexes (idempotent)
```
**Key detail**: All policies use `DROP POLICY IF EXISTS` to allow re-running without errors.

### Testing Database Connectivity
```javascript
// Browser console (F12) to verify Supabase is wired:
supabaseClient.from('events').select('*').then(r => console.log(r))
supabaseClient.from('registrations').select('*').then(r => console.log(r))
```

### Supabase Credentials
Located in `js/supabaseClient.js`:
```javascript
const SUPABASE_URL = "https://jrduxxkcpvf1ycuoa.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_RucRoxxq4irUKtxjnLHFnw_djJxJC28";
```
Public anon key is safe in browser code (read-only without RLS bypass).

### File Upload Destinations
- **Papers PDF**: Supabase Storage bucket `papers` (PresenterDashboard.js)
- **Presentations**: Supabase Storage bucket `presentations`
- Upload flow: File → Storage → URL stored in `paper_submissions.file_path`

---

## Project-Specific Conventions

### Component Export Pattern (Critical)
All dashboard and UI components use **IIFE + global window property** to avoid React hook collisions:

```javascript
// PresenterDashboard.js, AdminDashboard.js, etc.
(function() {
  const { useState, useEffect } = React;
  
  function MyComponent() { /* ... */ }
  
  window.MyComponent = MyComponent;  // Expose globally
})();
```
**Why**: Multiple dashboard scripts loaded in same `index.html` cause "Identifier 'useState' has already been declared" errors without IIFE.

### Data Normalization
Dashboards convert database snake_case (PostgreSQL convention) to camelCase for React state:

```javascript
// AdminDashboard.js
function normalizeEvent(row) {
  return { id: row.id, title: row.title, startDate: row.start_date, ... };
}
```
After UI updates, **convert back to snake_case before inserting into Supabase**.

### Sample/Demo Data
`js/sampleData.js` and hardcoded `FAKE_EVENTS` in `App.js` for UI development before auth/database is live. Database INSERT statements are in `supabase-setup.sql` (single campus colloquium seeded).

### Authentication Status
⚠️ **Current**: `AuthPage.js` uses demo accounts (hardcoded in `PROTOTYPE_USERS` object).  
🔄 **Next**: Replace with Supabase Auth (`signInWithPassword`, `signUp`).  
**Impact**: RLS policies require `auth.uid()` and `auth.email()` to be set for enforcement.

---

## Integration Points & Data Flows

### Registrations → Attendance Logging
```
registrations.qr_code_data (unique)
    ↓
AttendancePortal scans QR
    ↓
attendance_logs.insert(portal_id, registration_id, timestamp)
```

### Paper Submission Workflow
```
presenter uploads PDF → storage.papers.upload()
  ↓
paper_submissions.insert({ file_path, file_name, user_email, status='under_review' })
  ↓
admin reviews, updates status (approved/rejected)
  ↓
PresenterDashboard.js polls for feedback via RLS
```

### Event Filtering
Admin creates events with `featured: true` and `past: false`.  
ParticipantDashboard queries `SELECT * FROM events WHERE featured=true AND past=false`.  
Views (`event_registration_stats`) provide counts without scanning large tables.

---

## RLS Policy Model (Security)

| Table | Rule |
|-------|------|
| `events` | Public read; only admins (role='admin') can insert/update |
| `registrations` | Users read own; anyone can insert (self-register); admins full access |
| `paper_submissions` | Public read; authenticated users can submit; authors can update own |
| `users` | Read own profile; update own |
| `attendance_logs` | Public read; authenticated can append |
| Storage (`papers`, `presentations`) | Authenticated users upload; public read |

**Missing**: Supabase Auth integration. Until implemented, set RLS to permissive or use service role key (backend only).

---

## When Modifying Code

### Add a New Dashboard View
1. Create `js/MyDashboard.js` with IIFE + window export pattern
2. Import into `index.html` **before** `App.js`
3. Reference in main `App()` component conditional on `view` state
4. Use `const supabase = getSupabaseClient()` or `window.supabaseClient`

### Add a New Database Table
1. Update `db/supabase-setup.sql`: add CREATE TABLE with indexes
2. Add RLS policies (DROP IF EXISTS first)
3. If foreign keys exist, add CASCADE rules
4. Run full script in Supabase SQL Editor (idempotent)
5. Update any views that reference new table

### Add Field to Existing Table
1. Supabase dashboard → SQL Editor → `ALTER TABLE table_name ADD COLUMN ...`
2. Update data normalization functions in dashboards (if snake_case conversion needed)
3. Update INSERT/UPDATE queries in affected components

---

## Common Pitfalls

1. **"RLS policy violation"** → Supabase Auth not configured; policies check `auth.uid()` which is null
2. **"Policy already exists"** → Old SQL script without DROP IF EXISTS; use updated `supabase-setup.sql`
3. **"Storage bucket not found"** → Manually create `papers` and `presentations` buckets in Supabase Dashboard
4. **Blank screen on dashboard load** → Component not exposed globally (`window.MyComponent = ...`); check browser console
5. **Foreign key constraint** → Parent record doesn't exist; insert events before registrations
6. **CSV import fails** → Column mismatch; verify names match table schema (snake_case)

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `index.html` | Single HTML entry point; loads React, Supabase, all JS modules |
| `js/App.js` | Main router component; handles view state (auth, participant, presenter, admin) |
| `js/supabaseClient.js` | Supabase client initialization; expose as `window.supabaseClient` |
| `js/AdminDashboard.js` | Event + registration management; calls `supabase.from('events').select()` |
| `js/ParticipantDashboard.js` | Browse events, register, download certificates |
| `js/PresenterDashboard.js` | Submit papers via PDF upload to Storage + DB insert |
| `js/AttendancePortal.js` | QR code scanning; logs to `attendance_logs` table |
| `js/uiComponents.js` | Reusable UI (Loader, Breadcrumbs, Accordion, Tabs, Carousel) |
| `db/supabase-setup.sql` | All DDL: tables, RLS, storage buckets, views, indexes |
| `DATABASE_INTEGRATION_GUIDE.md` | Setup steps, credential verification, troubleshooting |

---

## Next Priorities

1. ✅ Database: All tables + RLS + storage buckets created
2. 🔄 **Auth**: Integrate Supabase Authentication (replace demo accounts)
3. 🔄 **RLS Testing**: Verify policies enforce read/write correctly after auth
4. 🔄 **PDF Upload**: Wire PresenterDashboard to Storage, test file retrieval
5. 🔄 **Certificate Generation**: Implement PDF download from ParticipantDashboard
6. 🔄 **QR Scanning**: Test AttendancePortal with real device camera

---

**Last Updated**: January 2026  
**DB Status**: ✅ Supabase PostgreSQL with 6 tables, RLS, indexes, views
