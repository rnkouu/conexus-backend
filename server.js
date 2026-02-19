require('dotenv').config();
const express = require('express');
const path = require('path'); 
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const app = express();

// --- CONFIGURATION ---
const PORT = process.env.PORT || 8000; 

// OJS API BRIDGE CONFIGURATION
const OJS_CONFIG = {
    apiUrl: 'http://127.0.0.1:8080/index.php/crj/api/v1/submissions',
    apiKey: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.WyIwMTQ3NzQ3ZTNhODAyNTJiYjA3Y2ZkNDBlZmRkMmY1ZmVkYzY0YjhhIl0.krPm4K0lgwJReWfN_xwNzOrqsXR_gKIwXsSAWmYNmZM'
};

app.use(cors({
    origin: [
        'https://conexus-frontend-chi.vercel.app', // Your specific Vercel URL
        'http://localhost:3000',                  // For local testing
        'http://127.0.0.1:5500'                   // For Live Server testing
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));
app.use(bodyParser.json());

// --- CLOUD & FILE HANDLING ---
app.use(express.static(path.join(__dirname, '.')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
    }
});

const upload = multer({ storage: storage });

// --- DATABASE CONNECTION ---
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

app.post('/api/register_user', (req, res) => {
    const { name, email, password, university } = req.body;
    db.query("SELECT id FROM users WHERE email = ?", [email], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length > 0) return res.json({ success: false, message: 'Email taken' });

        db.query("INSERT INTO users (full_name, email, password, university_org, role) VALUES (?, ?, ?, ?, 'participant')", 
        [name, email, password, university], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, userId: result.insertId });
        });
    });
});

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
                        job_title: user.job_title,
                        designation: user.designation, // ADD THIS
                        phone: user.phone,             // ADD THIS
                        university_org: user.university_org,
                        bio: user.bio,
                        skills: user.skills,
                        linkedin_url: user.linkedin_url,
                        facebook_url: user.facebook_url, // ADD THIS
                        twitter_url: user.twitter_url    // ADD THIS
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
    db.query("DELETE FROM events WHERE id = ?", [req.params.id], (err) => {
        if(err) return res.status(500).json({error: err.message});
        res.json({ success: true });
    });
});

app.put('/api/events/:id', (req, res) => {
    const { title, description, location, startDate, endDate, featured, type, mode } = req.body;
    const sql = "UPDATE events SET title=?, description=?, location=?, start_date=?, end_date=?, featured=?, type=?, mode=? WHERE id=?";
    db.query(sql, [title, description, location, startDate, endDate, featured?1:0, type, mode, req.params.id], (err) => {
        if(err) return res.status(500).json({error: err.message});
        res.json({ success: true });
    });
});

// --- REGISTRATIONS ---

app.get('/api/registrations', (req, res) => {
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

// --- REGISTRATIONS (UPDATED WITH FILE UPLOAD) ---

// 1. Add 'upload.single' middleware to handle the image
app.post('/api/register', upload.single('valid_id'), (req, res) => {
    // 2. Destructure body data
    let { user_email, event_id, companions } = req.body;
    
    // 3. Get the file path if uploaded
    const valid_id_path = req.file ? req.file.path : null;

    // 4. Important: When using FormData (required for file uploads), 
    // nested objects/arrays like 'companions' arrive as JSON strings.
    if (typeof companions === 'string') {
        try {
            companions = JSON.parse(companions);
        } catch (e) {
            companions = [];
        }
    }

    db.beginTransaction((err) => {
        if (err) return res.status(500).json({ error: err.message });

        db.query("SELECT id FROM users WHERE email = ?", [user_email], (err, users) => {
            if (err || users.length === 0) {
                return db.rollback(() => res.status(404).json({ message: 'User not found' }));
            }

            // 5. Update SQL to insert 'valid_id_path'
            const sqlReg = "INSERT INTO registrations (user_id, event_id, status, valid_id_path, created_at) VALUES (?, ?, 'For approval', ?, NOW())";
            
            db.query(sqlReg, [users[0].id, event_id, valid_id_path], (err, result) => {
                if (err) return db.rollback(() => res.status(500).json({ error: err.message }));
                
                const regId = result.insertId;

                if (companions && Array.isArray(companions) && companions.length > 0) {
                    const compSql = "INSERT INTO registration_companions (registration_id, name, relation, phone, email) VALUES ?";
                    const values = companions.map(c => [regId, c.name, c.relation, c.phone, c.email]);
                    
                    db.query(compSql, [values], (err) => {
                        if (err) return db.rollback(() => res.status(500).json({ error: "Companion insert failed" }));
                        db.commit(() => res.json({ success: true, regId }));
                    });
                } else {
                    db.commit(() => res.json({ success: true, regId }));
                }
            });
        });
    });
});

// In server.js (Replace the existing PUT /api/registrations/:id)
app.put('/api/registrations/:id', (req, res) => {
    const { status, room_id, admin_note } = req.body;
    
    // Base Query
    let sql = "UPDATE registrations SET status = ?";
    let params = [status];

    // Conditionally add fields to query
    if (room_id !== undefined) {
        sql += ", room_id = ?";
        params.push(room_id);
    }
    
    if (admin_note !== undefined) {
        sql += ", admin_note = ?";
        params.push(admin_note);
    }

    sql += " WHERE id = ?";
    params.push(req.params.id);

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
        const sql = "SELECT r.id, r.status, u.full_name FROM registrations r JOIN users u ON r.user_id = u.id WHERE (r.nfc_card_id = ? OR u.email = ?) LIMIT 1";
        db.query(sql, [input_code, input_code], (err, results) => {
            if(results.length === 0) return res.json({success: false, status: 'not_found'});
            const reg = results[0];
            if(reg.status !== 'Approved') return res.json({success: false, status: 'not_approved', name: reg.full_name});
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
        SELECT al.id, al.scanned_at, al.room_name, COALESCE(u.full_name, 'Unknown User') as participant_name, COALESCE(e.title, 'Unknown Event') as event_title 
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

// --- SUBMISSIONS & OJS API BRIDGE (FIXED) ---
app.post('/api/submissions', upload.single('file'), (req, res) => {
    const { user_email, event_id, title, abstract } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const file_name = file.originalname;
    const file_path = file.path;

    // 1. ALWAYS SAVE TO MYSQL FIRST
    const sql = "INSERT INTO paper_submissions (user_email, event_id, title, abstract, file_name, file_path, status) VALUES (?, ?, ?, ?, ?, ?, 'under_review')";
    
    db.query(sql, [user_email, event_id || null, title, abstract, file_name, file_path], async (err, result) => {
        if(err) {
            console.error("❌ MySQL Error:", err.message);
            return res.status(500).json({ success: false, error: err.message });
        }
        
        const insertId = result.insertId;

        // 2. BRIDGE TO OJS
        try {
            console.log("📥 MySQL save successful. Syncing to OJS...");
            
            const ojsUrlWithToken = `${OJS_CONFIG.apiUrl}?apiToken=${OJS_CONFIG.apiKey}`;
            
            const ojsResponse = await axios.post(ojsUrlWithToken, {
                locale: 'en_US', 
                sectionId: 1,    
                title: { en_US: title || "Untitled Submission" },
                abstract: { en_US: abstract || "No abstract provided." }
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            console.log("✅ OJS Sync successful! ID:", ojsResponse.data.id);
            return res.json({ success: true, id: insertId, ojsId: ojsResponse.data.id, message: 'Saved and synced.' });

        } catch (ojsError) {
            console.error("❌ OJS REJECTED THE PAYLOAD:");
            console.error(JSON.stringify(ojsError.response?.data, null, 2) || ojsError.message);
            
            return res.status(500).json({ 
                success: false, 
                message: "Saved to MySQL, but OJS rejected it." 
            });
        }
    }); 
}); 

app.get('/api/submissions', (req, res) => {
    const { email } = req.query;
    const sql = `
        SELECT s.*, e.title as event_title FROM paper_submissions s
        LEFT JOIN events e ON s.event_id = e.id
        ${email ? " WHERE s.user_email = ?" : ""}
        ORDER BY s.created_at DESC
    `;
    db.query(sql, email ? [email] : [], (err, results) => {
        if(err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.put('/api/submissions/:id/status', (req, res) => {
    const { status } = req.body;
    db.query("UPDATE paper_submissions SET status = ? WHERE id = ?", [status, req.params.id], (err) => {
        if(err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// --- NFC BUSINESS CARD ---

app.get('/api/users/nfc/:profile_slug', (req, res) => {
    const query = "SELECT full_name, job_title, designation, university_org, bio, linkedin_url, facebook_url, twitter_url, phone, email FROM users WHERE profile_slug = ?";
    db.query(query, [req.params.profile_slug], (err, results) => {
        if (err) return res.status(500).json({ success: false });
        if (results.length > 0) res.json({ success: true, user: results[0] });
        else res.status(404).json({ success: false });
    });
});

app.put('/api/users/profile', (req, res) => {
    const { 
        email, 
        name,           
        job_title, 
        designation,    
        university_org, 
        phone,          
        bio, 
        skills, 
        linkedin_url, 
        facebook_url,   
        twitter_url     
    } = req.body;

    const query = `
        UPDATE users 
        SET full_name = ?, 
            job_title = ?, 
            designation = ?, 
            university_org = ?, 
            phone = ?, 
            bio = ?, 
            skills = ?, 
            linkedin_url = ?, 
            facebook_url = ?, 
            twitter_url = ? 
        WHERE email = ?`;

    db.query(query, [
        name, 
        job_title, 
        designation, 
        university_org, 
        phone, 
        bio, 
        skills, 
        linkedin_url, 
        facebook_url, 
        twitter_url, 
        email
    ], (err) => {
        if (err) {
            console.error("❌ Profile Update Error:", err.message);
            return res.status(500).json({ success: false });
        }
        res.json({ success: true });
    });
});

//CERTIFICATE
app.put('/api/registrations/:id/mark-certificate', (req, res) => {
    db.query("UPDATE registrations SET certificate_issued_at = NOW() WHERE id = ?", [req.params.id], (err) => {
        if(err) return res.status(500).json({error: err.message});
        res.json({ success: true });
    });
});

app.listen(PORT, () => console.log(`🚀 DATABASE Server is now running on Port ${PORT}`));