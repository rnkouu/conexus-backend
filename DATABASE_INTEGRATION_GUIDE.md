# Conexus Database Integration Guide

## 📋 Overview
Your application is ready to use Supabase for backend data management. The files are already structured to make Supabase queries.

## ✅ Step 1: Create Tables in Supabase

1. Go to your **Supabase Project Dashboard**
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the entire contents of `db/supabase-setup.sql`
5. Paste into the SQL editor
6. Click **Run**

### What this creates:
- ✅ `users` - User accounts and profiles
- ✅ `events` - Event information
- ✅ `registrations` - Event registrations
- ✅ `paper_submissions` - Research paper submissions
- ✅ `attendance_portals` - QR scanner portals
- ✅ `attendance_logs` - Attendance records

Row Level Security (RLS) is automatically enabled for all tables.

---

## ✅ Step 2: Verify Your Supabase Credentials

Check that your credentials in `js/supabaseClient.js` match your Supabase project:

```javascript
const SUPABASE_URL = "https://afmvwhymdjatlaamxxqz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_hx2yJG_QMt65JJzfEGqsoA_K94fF6l6";
```

✅ These look correct (your public keys are safe to share in browser code).

---

## ✅ Step 3: Test Database Connectivity

Open your browser console (F12) and run:

```javascript
// Test events table
supabaseClient.from('events').select('*').then(r => console.log(r))

// Test registrations
supabaseClient.from('registrations').select('*').then(r => console.log(r))
```

You should see:
- ✅ `data: [{...events...}]` (if tables exist)
- ✅ No permission errors

---

## 📝 How Your Code Uses the Database

### AdminDashboard.js
- **Loads events**: `supabase.from('events').select('*')`
- **Manages registrations**: `supabase.from('registrations').select('*')`
- **Creates attendance portals**: `supabase.from('attendance_portals').insert(...)`

### ParticipantDashboard.js
- **Views events**: `supabase.from('events').select('*')`
- **Creates registrations**: `supabase.from('registrations').insert(...)`
- **Downloads certificates**: Uses PDF generation

### PresenterDashboard.js
- **Views events**: `supabase.from('events').select('*')`
- **Submits papers**: `supabase.from('paper_submissions').insert(...)`
- **Uploads PDFs**: Uses Supabase Storage bucket (configure separately)

### AttendancePortal.js
- **QR scanning**: `supabase.from('attendance_portals').select('*')`
- **Log attendance**: `supabase.from('attendance_logs').insert(...)`

---

## 🔑 Important: Supabase Storage for PDF Files

Your PresenterDashboard allows PDF uploads. To enable this:

1. Go to **Supabase Dashboard** → **Storage**
2. Click **Create Bucket** → name it `papers`
3. Make it **Public** (so papers can be accessed)
4. Update `PresenterDashboard.js` to upload PDFs:

```javascript
// Example: Upload PDF to Storage
const { data, error } = await supabase.storage
  .from('papers')
  .upload(`${fileName}`, file);
```

---

## 🔒 Security Notes

### Row Level Security (RLS)
- All tables have RLS enabled
- Users can only see/modify their own data
- Admins have full access
- **Important**: You must use Supabase Auth for RLS to work

### Current Auth Status
⚠️ **Warning**: Your `AuthPage.js` uses local demo accounts. For production, set up **Supabase Authentication**:

```javascript
// Instead of demo users, use Supabase Auth:
const { data, error } = await supabase.auth.signInWithPassword({
  email: userEmail,
  password: userPassword
});
```

---

## 🧪 Testing the Database

### Sample Queries to Run in Browser Console:

```javascript
// 1. Get all events
supabaseClient.from('events').select('*').then(r => console.log('Events:', r.data))

// 2. Get registrations for a specific event
supabaseClient
  .from('registrations')
  .select('*')
  .eq('event_id', 1)
  .then(r => console.log('Registrations:', r.data))

// 3. Create a new registration
supabaseClient
  .from('registrations')
  .insert({
    event_id: 1,
    full_name: 'John Doe',
    email: 'john@example.com',
    university: 'AUP'
  })
  .then(r => console.log('Created:', r.data))

// 4. Get attendance logs for a portal
supabaseClient
  .from('attendance_logs')
  .select('*')
  .eq('portal_id', 'portal-uuid-here')
  .then(r => console.log('Attendance:', r.data))
```

---

## 📊 Database Schema Diagram

```
users (1) ──────────── (many) registrations
         └─────────────────────────────────┘
                        │
                        ├─→ (1) events
                        │
                        └─→ paper_submissions

events (1) ──────────── (many) attendance_portals
                                    │
                                    └─→ (many) attendance_logs
                                             ├─→ (1) registration
                                             └─→ (1) attendance_portal
```

---

## 🚀 Next Steps

1. ✅ Run the SQL setup script in Supabase
2. ✅ Test database connectivity
3. ⏳ Set up Supabase Storage for PDF uploads (optional)
4. ⏳ Implement Supabase Authentication (recommended for production)
5. ⏳ Update RLS policies as needed
6. ✅ Test all dashboards with real data

---

## ❓ Troubleshooting

### "CORS error" or "Not authenticated"
- Supabase URLs are case-sensitive
- Check `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `supabaseClient.js`
- Verify CORS is enabled in Supabase settings

### "RLS policy violation"
- You're likely not authenticated
- Currently, AuthPage uses local demo accounts
- Implement Supabase Auth for proper authentication

### "Storage bucket not found"
- The `papers` bucket doesn't exist yet
- Create it in Supabase Dashboard → Storage

### "Foreign key constraint failed"
- Make sure parent records exist (e.g., event_id exists in events table)
- Insert sample data first using the SQL script

---

## 📚 Useful Links

- [Supabase Docs](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript)
- [RLS Policy Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Storage Guide](https://supabase.com/docs/guides/storage)

---

## 💾 Files in This Setup

- `db/Conexus.dbs` - Original MySQL schema
- `db/supabase-setup.sql` - PostgreSQL schema for Supabase
- `DATABASE_SETUP.md` - General database guide
- `DATABASE_INTEGRATION_GUIDE.md` - This file

