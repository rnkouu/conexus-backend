# Conexus Database Connectivity Test Guide

This guide helps you verify that your Supabase database is properly connected and working.

---

## Quick Start: Browser Console Test (2 minutes)

1. **Open your Conexus app** in a browser: `http://localhost:5000` (or your server URL)
2. **Open Developer Tools**: Press `F12` or right-click → "Inspect"
3. **Go to Console tab**
4. **Paste and run each test below** one at a time

---

## Test 1: Verify Supabase Client is Loaded ✅

```javascript
// Check if Supabase client exists
console.log("Supabase client:", window.supabaseClient);
console.log("URL:", window.SUPABASE_URL);
console.log("Anon Key:", window.SUPABASE_ANON_KEY);
```

**Expected Output:**
- Should show a Supabase client object
- URL should be: `https://jrduxxkcpvf1ycuoa.supabase.co`
- Anon key should start with `sb_publishable_...`

❌ **If blank or undefined**: Check that `index.html` loads `js/supabaseClient.js` BEFORE `js/App.js`

---

## Test 2: Query Events Table 📊

```javascript
// Fetch all events (public read access)
supabaseClient
  .from('events')
  .select('*')
  .then(response => {
    console.log('Events Response:', response);
    console.log('Data:', response.data);
    console.log('Error:', response.error);
  });
```

**Expected Output:**
- `data` contains an array of events (should have "Campus Research Colloquium 2025")
- `error` is `null`
- Count events: `response.data.length`

❌ **If error "relation 'events' does not exist"**: Run `db/supabase-setup.sql` in Supabase SQL Editor

---

## Test 3: Query Registrations Table 📝

```javascript
// Fetch registrations (requires auth or permissive RLS)
supabaseClient
  .from('registrations')
  .select('*')
  .then(response => {
    console.log('Registrations Response:', response);
    console.log('Count:', response.data?.length || 0);
  });
```

**Expected Output:**
- `data` array (initially empty or with test registrations)
- No auth errors (if RLS is permissive for select)

❌ **If error "new row violates row-level security (RLS) policy"**: RLS is too strict. Check policies in Supabase dashboard.

---

## Test 4: Query Paper Submissions 📄

```javascript
// Fetch paper submissions
supabaseClient
  .from('paper_submissions')
  .select('*')
  .then(response => {
    console.log('Papers Response:', response);
    console.log('Papers found:', response.data?.length || 0);
  });
```

**Expected Output:**
- `data` array (initially empty)
- `error` is `null`

---

## Test 5: Query Attendance Logs 🎯

```javascript
// Fetch attendance logs
supabaseClient
  .from('attendance_logs')
  .select('*')
  .then(response => {
    console.log('Attendance Logs:', response);
  });
```

**Expected Output:**
- `data` array (initially empty)
- `error` is `null`

---

## Test 6: Count Registrations Per Event 📈

```javascript
// Use the analytics view
supabaseClient
  .from('event_registration_stats')
  .select('*')
  .then(response => {
    console.log('Registration Stats:', response);
    console.table(response.data);
  });
```

**Expected Output:**
- Shows `Campus Research Colloquium 2025` with counts
- Displays `total_registrations`, `paid_registrations`, `unique_participants`

---

## Test 7: Insert Test Data (Requires Permission) 🆕

```javascript
// Try inserting a registration (if RLS allows INSERT without auth)
supabaseClient
  .from('registrations')
  .insert({
    event_id: 1,  // The seeded event ID
    full_name: 'Test User',
    email: 'test@example.com',
    university: 'Test University',
    status: 'For approval'
  })
  .then(response => {
    console.log('Insert Response:', response);
    if (response.error) {
      console.error('Error:', response.error.message);
    } else {
      console.log('Successfully inserted!', response.data);
    }
  });
```

**Expected Output:**
- `data` contains the new registration object with ID
- `error` is `null`

❌ **If error "INSERT policy"**: RLS doesn't allow public inserts. This is secure but requires authentication.

---

## Test 8: Check Storage Buckets 🗂️

```javascript
// List files in papers bucket
supabaseClient
  .storage
  .from('papers')
  .list()
  .then(response => {
    console.log('Papers Bucket Files:', response);
  });
```

**Expected Output:**
- `data` array (initially empty)
- Shows any PDFs that have been uploaded

❌ **If error "Bucket not found"**: Create `papers` and `presentations` buckets in Supabase dashboard.

---

## Test 9: Check Auth Status 🔐

```javascript
// Get current auth session (should be null until user logs in)
supabaseClient.auth.getSession().then(response => {
  console.log('Auth Session:', response);
  console.log('User:', response.data.session?.user);
});
```

**Expected Output:**
- `session` is `null` (user not logged in)
- After login, should show user object with UUID

---

## Complete Test Script 🚀

Copy this entire block and paste into console to run all tests at once:

```javascript
// ============================================
// Conexus Database Connectivity Test Suite
// ============================================

async function runAllTests() {
  console.log('🚀 Starting Conexus DB Tests...\n');
  
  // Test 1: Client loaded
  console.log('✅ Test 1: Client Loaded');
  console.log('URL:', window.SUPABASE_URL);
  console.log('Client:', !!window.supabaseClient ? 'Connected' : 'Failed\n');
  
  // Test 2: Events
  console.log('✅ Test 2: Events Table');
  const events = await supabaseClient.from('events').select('*');
  console.log('Events:', events.data?.length || 0, 'records');
  console.log('Error:', events.error?.message || 'None\n');
  
  // Test 3: Registrations
  console.log('✅ Test 3: Registrations Table');
  const registrations = await supabaseClient.from('registrations').select('*');
  console.log('Registrations:', registrations.data?.length || 0, 'records');
  console.log('Error:', registrations.error?.message || 'None\n');
  
  // Test 4: Papers
  console.log('✅ Test 4: Paper Submissions');
  const papers = await supabaseClient.from('paper_submissions').select('*');
  console.log('Papers:', papers.data?.length || 0, 'records');
  console.log('Error:', papers.error?.message || 'None\n');
  
  // Test 5: Attendance Logs
  console.log('✅ Test 5: Attendance Logs');
  const logs = await supabaseClient.from('attendance_logs').select('*');
  console.log('Logs:', logs.data?.length || 0, 'records');
  console.log('Error:', logs.error?.message || 'None\n');
  
  // Test 6: Views
  console.log('✅ Test 6: Analytics Views');
  const stats = await supabaseClient.from('event_registration_stats').select('*');
  console.log('Stats:', stats.data?.length || 0, 'records');
  console.log('Error:', stats.error?.message || 'None\n');
  
  // Test 7: Storage
  console.log('✅ Test 7: Storage Buckets');
  const files = await supabaseClient.storage.from('papers').list();
  console.log('Papers bucket:', files.data?.length || 0, 'files');
  console.log('Error:', files.error?.message || 'None\n');
  
  // Test 8: Auth
  console.log('✅ Test 8: Auth Status');
  const session = await supabaseClient.auth.getSession();
  console.log('Session:', session.data.session ? 'Active' : 'None (expected before login)');
  console.log('User ID:', session.data.session?.user.id || 'Not logged in\n');
  
  console.log('✅ All tests complete!');
}

// Run it
runAllTests().catch(err => console.error('Test error:', err));
```

---

## Troubleshooting 🔧

### ❌ "Cannot read properties of undefined"
**Problem**: `window.supabaseClient` is undefined  
**Solution**: 
- Verify `js/supabaseClient.js` is loaded in `index.html`
- Check network tab (F12 → Network) to ensure file loads
- Refresh page

### ❌ "relation 'tablename' does not exist"
**Problem**: Database tables haven't been created  
**Solution**:
- Copy `db/supabase-setup.sql` 
- Go to Supabase dashboard → SQL Editor
- Paste and click "Run"

### ❌ "RLS policy violation"
**Problem**: Row Level Security is blocking queries  
**Solution**:
- Temporarily disable RLS for testing: Supabase → Authentication → Policies → Disable
- Or set policies to permissive mode for development
- Re-enable after testing

### ❌ CORS error
**Problem**: Browser blocks Supabase requests  
**Solution**:
- Verify `SUPABASE_URL` is correct and case-sensitive
- Check Supabase dashboard → Project Settings → API
- Ensure anon key is correct

### ❌ "Storage bucket not found"
**Problem**: `papers` bucket doesn't exist  
**Solution**:
- Supabase dashboard → Storage → Create bucket
- Name: `papers`, set Public
- Create second bucket: `presentations`

---

## Expected Test Results Summary

| Test | Status | Notes |
|------|--------|-------|
| Supabase Client | ✅ Should connect | Check URL in console |
| Events Query | ✅ Should return 1 | "Campus Research Colloquium 2025" |
| Registrations Query | ✅ Should return 0+ | No records initially |
| Papers Query | ✅ Should return 0+ | No records initially |
| Attendance Logs | ✅ Should return 0+ | No records initially |
| Analytics Views | ✅ Should show stats | Event registration counts |
| Storage Buckets | ✅ Should be empty | 0 files initially |
| Auth Status | ✅ Session null | Expected before login |

---

## Next Steps After Successful Test

✅ **If all tests pass:**
1. Database is fully operational
2. You can proceed to test frontend features:
   - Participant registration
   - Paper submission
   - Attendance QR scanning
   - Admin event creation

⚠️ **If tests fail:**
1. Check the specific error message
2. Review RLS policies: Supabase → Authentication → Policies
3. Verify SQL script ran without errors: Supabase → SQL Editor → View Logs
4. Ask for help with specific error

---

**Last Updated**: January 2026  
**For**: Conexus Database Connectivity Testing
