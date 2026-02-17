require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const app = express();
const PORT = 8000;

app.use(cors());
app.use(bodyParser.json());

// Serve the uploads folder so admins can download the PDFs later
app.use('/uploads', express.static('uploads'));

// Configure Multer to save files with their original names
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
    }
});


const upload = multer({ storage: storage });
// Database Connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, 
    database: process.env.DB_NAME
});

db.connect((err) => {
    if (err) { console.error('❌ Database connection failed:', err); return; }
    console.log('✅ Connected to MySQL Database');
});

// --- AUTHENTICATION ---

// Register User (Plain Text Password)
app.post('/api/register_user', (req, res) => {
    const { name, email, password, university } = req.body;
    
    // 1. Check if email exists
    db.query("SELECT id FROM users WHERE email = ?", [email], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length > 0) return res.json({ success: false, message: 'Email taken' });

        // 2. Insert User (Storing password directly)
        db.query("INSERT INTO users (full_name, email, password, university_org, role) VALUES (?, ?, ?, ?, 'participant')", 
        [name, email, password, university], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, userId: result.insertId });
        });
    });
});

// Login User (Plain Text Comparison)
// Login User (Now including business card fields)
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (results.length > 0) {
            const user = results[0];
            
            if (password === user.password) {
                res.json({ 
                    success: true, 
                    user: { 
                        id: user.id, 
                        name: user.full_name, 
                        email: user.email, 
                        role: user.role, 
                        university: user.university_org,
                        // NEW: These fields ensure data persists on reload
                        job_title: user.job_title,
                        university_org: user.university_org,
                        bio: user.bio,
                        skills: user.skills,
                        linkedin_url: user.linkedin_url
                    } 
                });
            } else {
                res.json({ success: false, message: 'Invalid credentials' });
            }
        } else {
            res.json({ success: false, message: 'User not found' });
        }
    });
});

// --- EVENTS ---

app.get('/api/events', (req, res) => {
    db.query("SELECT * FROM events ORDER BY created_at DESC", (err, results) => {
        if(err) return res.json([]); 
        res.json(results);
    });
});

app.post('/api/create_event', (req, res) => {
    const { title, description, location, startDate, endDate, featured, type, mode } = req.body;
    const sql = "INSERT INTO events (title, description, location, start_date, end_date, featured, type, mode, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())";
    db.query(sql, [title, description, location, startDate, endDate, featured?1:0, type, mode], (err, result) => {
        if(err) return res.status(500).json({error: err.message});
        res.json({ success: true, newId: result.insertId });
    });
});

app.delete('/api/delete_event/:id', (req, res) => {
    // Cascade handles deleting registrations
    db.query("DELETE FROM events WHERE id = ?", [req.params.id], (err) => {
        if(err) return res.status(500).json({error: err.message});
        res.json({ success: true });
    });
});

// --- REGISTRATIONS ---

app.get('/api/registrations', (req, res) => {
    // Improved Query: JSON_ARRAYAGG handles companions correctly
    const sql = `
        SELECT r.*, u.full_name, u.email as user_email, u.university_org as university, e.title as event_title, r.room_id,
        (SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'name', c.name, 
            'relation', c.relation, 
            'phone', c.phone, 
            'email', c.email
        )) FROM registration_companions c WHERE c.registration_id = r.id) as companions
        FROM registrations r
        JOIN users u ON r.user_id = u.id
        JOIN events e ON r.event_id = e.id
        ORDER BY r.created_at DESC
    `;
    db.query(sql, (err, results) => {
        if(err) return res.json([]);
        const formatted = results.map(r => ({
            ...r,
            companions: typeof r.companions === 'string' ? JSON.parse(r.companions) : (r.companions || [])
        }));
        res.json(formatted);
    });
});

// Register with Transaction
app.post('/api/register', (req, res) => {
    const { user_email, event_id, companions } = req.body;

    // Start Transaction
    db.beginTransaction((err) => {
        if (err) return res.status(500).json({ error: err.message });

        // 1. Get User ID
        db.query("SELECT id FROM users WHERE email = ?", [user_email], (err, users) => {
            if (err || users.length === 0) {
                return db.rollback(() => res.status(404).json({ message: 'User not found' }));
            }

            // 2. Insert Registration
            const sqlReg = "INSERT INTO registrations (user_id, event_id, status, created_at) VALUES (?, ?, 'For approval', NOW())";
            db.query(sqlReg, [users[0].id, event_id], (err, result) => {
                if (err) {
                    return db.rollback(() => res.status(500).json({ error: err.message }));
                }

                const regId = result.insertId;

                // 3. Insert Companions (if any)
                if (companions && Array.isArray(companions) && companions.length > 0) {
                    const compSql = "INSERT INTO registration_companions (registration_id, name, relation, phone, email) VALUES ?";
                    const values = companions.map(c => [regId, c.name, c.relation, c.phone, c.email]);

                    db.query(compSql, [values], (err) => {
                        if (err) {
                            return db.rollback(() => res.status(500).json({ error: "Companion insert failed" }));
                        }
                        // Commit Transaction
                        db.commit(() => res.json({ success: true, regId }));
                    });
                } else {
                    // Commit Transaction (No companions)
                    db.commit(() => res.json({ success: true, regId }));
                }
            });
        });
    });
});

app.put('/api/registrations/:id', (req, res) => {
    const { status, room_id } = req.body;
    let sql = "UPDATE registrations SET status = ? WHERE id = ?";
    let params = [status, req.params.id];
    
    if (room_id !== undefined) {
        sql = "UPDATE registrations SET status = ?, room_id = ? WHERE id = ?";
        params = [status, room_id, req.params.id];
    }
    
    db.query(sql, params, (err) => {
        if(err) return res.status(500).json({error: err.message});
        res.json({ success: true });
    });
});

app.put('/api/registrations/:id/assign-nfc', (req, res) => {
    const { nfc_card_id } = req.body;
    db.query("SELECT id FROM registrations WHERE nfc_card_id = ? AND id != ?", [nfc_card_id, req.params.id], (err, results) => {
        if(results.length > 0) return res.status(400).json({ success: false, message: "Card already in use!" });
        db.query("UPDATE registrations SET nfc_card_id = ? WHERE id = ?", [nfc_card_id, req.params.id], (err) => {
            if(err) return res.status(500).json({error: err.message});
            res.json({ success: true });
        });
    });
});

app.delete('/api/registrations/:id', (req, res) => {
    db.query("DELETE FROM registrations WHERE id = ?", [req.params.id], (err) => {
        if(err) return res.status(500).json({error: err.message});
        res.json({ success: true });
    });
});

// --- ACCOMMODATION ---

app.get('/api/dorms', (req, res) => {
    db.query("SELECT * FROM dorms ORDER BY name ASC", (err, results) => res.json(results || []));
});

app.post('/api/dorms', (req, res) => {
    const { name, type } = req.body;
    db.query("INSERT INTO dorms (name, type) VALUES (?, ?)", [name, type], (err, result) => {
        if(err) return res.status(500).json({error: err.message});
        res.json({ success: true, id: result.insertId });
    });
});

app.delete('/api/dorms/:id', (req, res) => {
    // ON DELETE CASCADE in DB handles rooms and room_id updates
    db.query("DELETE FROM dorms WHERE id = ?", [req.params.id], (err) => {
        if(err) return res.status(500).json({error: err.message});
        res.json({ success: true });
    });
});

app.get('/api/rooms', (req, res) => {
    db.query("SELECT * FROM rooms ORDER BY name ASC", (err, results) => res.json(results || []));
});

app.post('/api/rooms', (req, res) => {
    const { dormId, name, beds } = req.body;
    db.query("INSERT INTO rooms (dorm_id, name, beds, occupied) VALUES (?, ?, ?, 0)", [dormId, name, beds], (err, result) => {
        if(err) return res.status(500).json({error: err.message});
        res.json({ success: true, id: result.insertId });
    });
});

app.delete('/api/rooms/:id', (req, res) => {
    // ON DELETE SET NULL in DB handles registration updates
    db.query("DELETE FROM rooms WHERE id = ?", [req.params.id], (err) => {
        if(err) return res.status(500).json({error: err.message});
        res.json({ success: true });
    });
});

// --- PORTALS ---

app.get('/api/portals', (req, res) => {
    const sql = "SELECT p.*, e.title as event_title FROM attendance_portals p LEFT JOIN events e ON p.event_id = e.id ORDER BY p.created_at DESC";
    db.query(sql, (err, results) => {
        if(err) return res.json([]); 
        res.json(results);
    });
});

app.post('/api/portals', (req, res) => {
    const { id, eventId, name } = req.body;
    db.query("INSERT INTO attendance_portals (id, event_id, name, created_at) VALUES (?, ?, ?, NOW())", [id, eventId, name], (err, result) => {
        if(err) return res.status(500).json({error: err.message});
        res.json({ success: true });
    });
});

app.delete('/api/portals/:id', (req, res) => {
    db.query("DELETE FROM attendance_portals WHERE id = ?", [req.params.id], (err) => {
        if(err) return res.status(500).json({error: err.message});
        res.json({ success: true });
    });
});

// --- ATTENDANCE ---

app.post('/api/attendance/scan', (req, res) => {
    const { portal_id, input_code } = req.body;
    
    db.query("SELECT name FROM attendance_portals WHERE id = ?", [portal_id], (err, portals) => {
        const roomName = portals[0]?.name || "Unknown";
        
        // Find registration by NFC or Email
        const sql = "SELECT r.id, r.status, u.full_name FROM registrations r JOIN users u ON r.user_id = u.id WHERE (r.nfc_card_id = ? OR u.email = ?) LIMIT 1";
        
        db.query(sql, [input_code, input_code], (err, results) => {
            if(results.length === 0) return res.json({success: false, status: 'not_found'});
            
            const reg = results[0];
            if(reg.status !== 'Approved') return res.json({success: false, status: 'not_approved', name: reg.full_name});
            
            // Check for duplicate scans (within 5 mins)
            db.query("SELECT id FROM attendance_logs WHERE registration_id = ? AND scanned_at > (NOW() - INTERVAL 5 MINUTE)", [reg.id], (err, dups) => {
                if(dups.length > 0) return res.json({success: false, status: 'repeat', name: reg.full_name});
                
                db.query("INSERT INTO attendance_logs (portal_id, room_name, registration_id, scanned_at) VALUES (?, ?, ?, NOW())", [portal_id, roomName, reg.id], () => {
                    res.json({success: true, status: 'success', name: reg.full_name});
                });
            });
        });
    });
});

app.get('/api/attendance_logs', (req, res) => {
    const sql = `
        SELECT 
            al.id, al.scanned_at, al.room_name, 
            COALESCE(u.full_name, 'Unknown User') as participant_name, 
            COALESCE(e.title, 'Unknown Event') as event_title 
        FROM attendance_logs al 
        LEFT JOIN registrations r ON al.registration_id = r.id 
        LEFT JOIN users u ON r.user_id = u.id 
        LEFT JOIN events e ON r.event_id = e.id 
        ORDER BY al.scanned_at DESC
    `;
    db.query(sql, (err, results) => {
        if(err) return res.json([]); 
        res.json(results);
    });
});

// --- SUBMISSIONS ---

// --- SUBMISSIONS & OJS API BRIDGE ---
app.post('/api/submissions', upload.single('file'), (req, res) => {
    // 1. Extract data and file from the FormData structure
    const { user_email, event_id, title, abstract } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const file_name = file.originalname;
    const file_path = file.path; // e.g., 'uploads/12345-paper.pdf'

    // 2. Save local backup to Conexus MySQL Database
    const sql = "INSERT INTO paper_submissions (user_email, event_id, title, abstract, file_name, file_path, status) VALUES (?, ?, ?, ?, ?, ?, 'under_review')";
    
    db.query(sql, [user_email, event_id || null, title, abstract, file_name, file_path], async (err, result) => {
        if(err) return res.status(500).json({error: err.message});
        
        const insertId = result.insertId;

        // 3. The OJS API Bridge (Forwarding to external OJS server)
        try {
            // TODO: Replace these with the actual details provided by the OJS Administrator later
            const OJS_API_URL = "https://your-institution-ojs-site.com/index.php/journal/api/v1/submissions"; 
            const OJS_API_KEY = "YOUR_OJS_API_KEY_HERE";

            // Package it for OJS
            const ojsFormData = new FormData();
            ojsFormData.append('title', title);
            ojsFormData.append('abstract', abstract);
            ojsFormData.append('authorEmail', user_email);
            ojsFormData.append('file', fs.createReadStream(file.path), file_name);

            /* * UNCOMMENT THIS BLOCK once you have the real OJS_API_URL and OJS_API_KEY
             *
            await axios.post(OJS_API_URL, ojsFormData, {
                headers: {
                    ...ojsFormData.getHeaders(),
                    'Authorization': `Bearer ${OJS_API_KEY}`
                }
            });
            */
            
            console.log(`✅ Paper saved locally and queued for OJS: ${title}`);
            res.json({ success: true, id: insertId, message: 'Saved locally and queued for OJS' });
        } catch (ojsError) {
            console.error("❌ OJS API Error:", ojsError.message);
            // Even if OJS rejects it, we return success because the local Conexus backup was saved
            res.json({ success: true, id: insertId, message: 'Saved locally, but OJS bridge failed.' });
        }
    });
});

app.get('/api/submissions', (req, res) => {
    const { email } = req.query;
    // Join with events to get the title for the admin view
    const sql = `
        SELECT s.*, e.title as event_title 
        FROM paper_submissions s
        LEFT JOIN events e ON s.event_id = e.id
        ${email ? " WHERE s.user_email = ?" : ""}
        ORDER BY s.created_at DESC
    `;
    db.query(sql, email ? [email] : [], (err, results) => {
        if(err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// ADD THIS: Route to update submission status (Accept/Reject/Under Review)
app.put('/api/submissions/:id/status', (req, res) => {
    const { status } = req.body;
    db.query("UPDATE paper_submissions SET status = ? WHERE id = ?", [status, req.params.id], (err) => {
        if(err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

/* ==========================================
   NFC DIGITAL BUSINESS CARD ROUTE
   ========================================= */
app.get('/api/users/nfc/:profile_slug', (req, res) => {
  const profileSlug = req.params.profile_slug;

  // Query the database for the user matching this specific slug
  const query = `
    SELECT full_name, job_title, university_org, bio, skills, linkedin_url, email 
    FROM users 
    WHERE profile_slug = ?
  `;

  db.query(query, [profileSlug], (err, results) => {
    if (err) {
      console.error("Database error fetching NFC profile:", err);
      return res.status(500).json({ success: false, message: "Database error" });
    }

    if (results.length > 0) {
      // Success! We found the user, send their data to the React frontend
      res.json({ success: true, user: results[0] });
    } else {
      // The slug doesn't exist or the card is inactive
      res.status(404).json({ success: false, message: "Profile not found" });
    }
  });
});

/* ==========================================
   UPDATE USER BUSINESS CARD PROFILE
   ========================================= */
app.put('/api/users/profile', (req, res) => {
  const { email, job_title, university_org, bio, skills, linkedin_url } = req.body;

  const query = `
    UPDATE users 
    SET job_title = ?, university_org = ?, bio = ?, skills = ?, linkedin_url = ?
    WHERE email = ?
  `;

  db.query(query, [job_title, university_org, bio, skills, linkedin_url, email], (err, result) => {
    if (err) {
      console.error("Error updating profile:", err);
      return res.status(500).json({ success: false, message: "Database error" });
    }
    res.json({ success: true, message: "Business card updated successfully!" });
  });
});


app.listen(PORT, () => console.log(`🚀 DATABASE Server is now running on http://localhost:${PORT}`));