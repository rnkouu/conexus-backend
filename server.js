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
const jwt = require('jsonwebtoken'); // NEW: JWT Library
const nodemailer = require('nodemailer'); // <-- 1. Require Nodemailer

const app = express();

// --- CONFIGURATION ---
const PORT = process.env.PORT || 8000; 
const JWT_SECRET = process.env.JWT_SECRET || 'conexus_super_secret_key_2026'; // Added Secret

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587, // This specific port bypasses Railway's spam block
    secure: false, // true for 465, false for other ports
    requireTLS: true, // Forces secure connection
    auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS  
    }
});


// --- Ensure uploads directory exists ---
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
    console.log('📁 Created missing uploads folder');
}

// OJS API BRIDGE CONFIGURATION
const OJS_CONFIG = {
    apiUrl: 'http://127.0.0.1:8080/index.php/crj/api/v1/submissions',
    apiKey: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.WyIwMTQ3NzQ3ZTNhODAyNTJiYjA3Y2ZkNDBlZmRkMmY1ZmVkYzY0YjhhIl0.krPm4K0lgwJReWfN_xwNzOrqsXR_gKIwXsSAWmYNmZM'
};

// --- CORS Configuration ---
app.use(cors({
    origin: [
        'https://cconexus.vercel.app',    // Your main live site
        'http://localhost:3000'           // Keep this for local testing
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'] 
}));

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '.')));
app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
    }
});
const upload = multer({ storage: storage });

// --- DATABASE CONNECTION (POOL) ---
const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, 
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test the pool connection
db.getConnection((err, conn) => {
    if (err) { 
        console.error('❌ Database connection failed:', err); 
    } else {
        console.log('✅ Connected to MySQL Database (Pool)');
        conn.release(); // Release it back to the pool
    }
});

// ==========================================
// SECURITY MIDDLEWARES
// ==========================================

// 1. Verify if user is logged in
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Expects "Bearer <token>"

    if (!token) return res.status(401).json({ success: false, message: 'Access Denied: No token provided' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, message: 'Access Denied: Invalid or expired token' });
        req.user = user; // Pass user data to the endpoint
        next();
    });
};

// 2. Verify if user is an admin
const verifyAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        return res.status(403).json({ success: false, message: 'Access Denied: Admin privileges required' });
    }
};

// ==========================================
// PUBLIC ROUTES (No Token Needed)
// ==========================================

app.post('/api/register_user', (req, res) => {
    const { name, email, password, university } = req.body;
    
    // Create a slug from the name (e.g., "John Doe" -> "john-doe-12345")
    const slug = name.toLowerCase().replace(/\s+/g, '-') + '-' + Math.floor(1000 + Math.random() * 9000);

    db.query("SELECT id FROM users WHERE email = ?", [email], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length > 0) return res.json({ success: false, message: 'Email taken' });

        // Added profile_slug to the columns and values
        db.query("INSERT INTO users (full_name, email, password, university_org, role, profile_slug) VALUES (?, ?, ?, ?, 'participant', ?)", 
        [name, email, password, university, slug], (err, result) => {
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
                // GENERATE JWT TOKEN
                const token = jwt.sign(
                    { id: user.id, email: user.email, role: user.role },
                    JWT_SECRET,
                    { expiresIn: '24h' }
                );

                res.json({ 
                    success: true, 
                    token: token, // Send token to client
                    user: { 
                        id: user.id, name: user.full_name, email: user.email, role: user.role, 
                        university: user.university_org, job_title: user.job_title,
                        designation: user.designation, phone: user.phone, 
                        university_org: user.university_org, bio: user.bio,
                        skills: user.skills, linkedin_url: user.linkedin_url,
                        facebook_url: user.facebook_url, twitter_url: user.twitter_url 
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

app.get('/api/events', (req, res) => {
    db.query("SELECT * FROM events ORDER BY created_at DESC", (err, results) => {
        if(err) return res.json([]); 
        res.json(results);
    });
});

app.get('/api/users/nfc/:profile_slug', (req, res) => {
    const query = "SELECT full_name, job_title, designation, university_org, bio, linkedin_url, facebook_url, twitter_url, phone, email FROM users WHERE profile_slug = ?";
    db.query(query, [req.params.profile_slug], (err, results) => {
        if (err) return res.status(500).json({ success: false });
        if (results.length > 0) res.json({ success: true, user: results[0] });
        else res.status(404).json({ success: false });
    });
});

app.post('/api/attendance/scan', (req, res) => {
    const { portal_id, input_code } = req.body;
    
    // 1. Fetch both the room name AND the event_id for this portal
    db.query("SELECT name, event_id FROM attendance_portals WHERE id = ?", [portal_id], (err, portals) => {
        if (err || portals.length === 0) {
            return res.json({success: false, status: 'not_found', message: 'Portal not found'});
        }

        const roomName = portals[0].name || "Unknown";
        const portalEventId = portals[0].event_id;

        // 2. Find ALL registrations across all events for this NFC card or Email
        const sql = `
            SELECT r.id, r.event_id, r.status, u.full_name 
            FROM registrations r 
            JOIN users u ON r.user_id = u.id 
            WHERE (r.nfc_card_id = ? OR u.email = ?)
        `;
        
        db.query(sql, [input_code, input_code], (err, results) => {
            // If 0 results, the card doesn't exist in the database at all
            if (err || results.length === 0) {
                return res.json({success: false, status: 'not_found'});
            }
            
            // 3. Card is recognized! See if they have a registration specifically for THIS event
            const validReg = results.find(r => r.event_id === portalEventId);
            
            if (!validReg) {
                // Known person, but wrong event
                return res.json({
                    success: false, 
                    status: 'wrong_event', 
                    name: results[0].full_name // We return their name so the UI can greet them!
                });
            }
            
            // 4. They are registered for this event. Check approval status.
            if (validReg.status !== 'Approved') {
                return res.json({success: false, status: 'not_approved', name: validReg.full_name});
            }
            
            // 5. Check for duplicate scans (within 5 minutes)
            db.query("SELECT id FROM attendance_logs WHERE registration_id = ? AND scanned_at > (NOW() - INTERVAL 5 MINUTE)", [validReg.id], (err, dups) => {
                if(dups.length > 0) return res.json({success: false, status: 'repeat', name: validReg.full_name});
                
                // 6. Log the attendance
                db.query("INSERT INTO attendance_logs (portal_id, room_name, registration_id, scanned_at) VALUES (?, ?, ?, NOW())", [portal_id, roomName, validReg.id], () => {
                    res.json({success: true, status: 'success', name: validReg.full_name});
                });
            });
        });
    });
});


// ==========================================
// PROTECTED ROUTES (Requires Token)
// ==========================================

// SECURED: Only returns all if admin. If participant, returns only their own.
app.get('/api/registrations', verifyToken, (req, res) => {
    let sql = `
        SELECT r.*, u.full_name, u.email as user_email, u.university_org as university, u.profile_slug, e.title as event_title, r.room_id,
        (SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'name', c.name, 
            'relation', c.relation, 
            'phone', c.phone, 
            'email', c.email
        )) FROM registration_companions c WHERE c.registration_id = r.id) as companions
        FROM registrations r
        JOIN users u ON r.user_id = u.id
        JOIN events e ON r.event_id = e.id
    `;
    let params = [];

    // Filter by user if not an admin
    if (req.user.role !== 'admin') {
        sql += ` WHERE u.email = ?`;
        params.push(req.user.email);
    }
    
    sql += ` ORDER BY r.created_at DESC`;

    db.query(sql, params, (err, results) => {
        if(err) return res.json([]);
        const formatted = results.map(r => ({
            ...r,
            companions: typeof r.companions === 'string' ? JSON.parse(r.companions) : (r.companions || [])
        }));
        res.json(formatted);
    });
});

app.post('/api/register', verifyToken, upload.single('valid_id'), (req, res) => {
    let { user_email, event_id, companions } = req.body;
    const valid_id_path = req.file ? req.file.path : null;

    if (typeof companions === 'string') {
        try { companions = JSON.parse(companions); } 
        catch (e) { companions = []; }
    }

    // FIX: Grab a specific connection from the pool for the transaction
    db.getConnection((err, connection) => {
        if (err) return res.status(500).json({ error: "Database connection error" });

        connection.beginTransaction((err) => {
            if (err) {
                connection.release();
                return res.status(500).json({ error: err.message });
            }
            
            connection.query("SELECT id FROM users WHERE email = ?", [user_email], (err, users) => {
                if (err || users.length === 0) {
                    return connection.rollback(() => {
                        connection.release();
                        res.status(404).json({ message: 'User not found' });
                    });
                }
                
                const sqlReg = "INSERT INTO registrations (user_id, event_id, status, valid_id_path, created_at) VALUES (?, ?, 'For approval', ?, NOW())";
                connection.query(sqlReg, [users[0].id, event_id, valid_id_path], (err, result) => {
                    if (err) {
                        return connection.rollback(() => {
                            connection.release();
                            res.status(500).json({ error: err.message });
                        });
                    }
                    
                    const regId = result.insertId;
                    if (companions && Array.isArray(companions) && companions.length > 0) {
                        const compSql = "INSERT INTO registration_companions (registration_id, name, relation, phone, email) VALUES ?";
                        const values = companions.map(c => [regId, c.name, c.relation, c.phone, c.email]);
                        
                        connection.query(compSql, [values], (err) => {
                            if (err) {
                                return connection.rollback(() => {
                                    connection.release();
                                    res.status(500).json({ error: "Companion insert failed" });
                                });
                            }
                            connection.commit(() => {
                                connection.release();
                                res.json({ success: true, regId });
                            });
                        });
                    } else {
                        connection.commit(() => {
                            connection.release();
                            res.json({ success: true, regId });
                        });
                    }
                });
            });
        });
    });
});

app.post('/api/submissions', verifyToken, upload.single('file'), (req, res) => {
    const { user_email, event_id, title, abstract } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const sql = "INSERT INTO paper_submissions (user_email, event_id, title, abstract, file_name, file_path, status) VALUES (?, ?, ?, ?, ?, ?, 'under_review')";
    db.query(sql, [user_email, event_id || null, title, abstract, file.originalname, file.path], async (err, result) => {
        if(err) return res.status(500).json({ success: false, error: err.message });
        const insertId = result.insertId;

        // BRIDGE TO OJS
        try {
            const ojsUrlWithToken = `${OJS_CONFIG.apiUrl}?apiToken=${OJS_CONFIG.apiKey}`;
            const ojsResponse = await axios.post(ojsUrlWithToken, {
                locale: 'en_US', sectionId: 1, title: { en_US: title }, abstract: { en_US: abstract }
            }, { headers: { 'Content-Type': 'application/json' } });
            
            return res.json({ success: true, id: insertId, ojsId: ojsResponse.data.id, message: 'Saved and synced.' });
        } catch (ojsError) {
            return res.status(500).json({ success: false, message: "Saved to MySQL, but OJS rejected it." });
        }
    }); 
}); 

// SECURED: Admins see all, participants only see their own
app.get('/api/submissions', verifyToken, (req, res) => {
    let filterEmail = req.query.email;
    if (req.user.role !== 'admin') {
        filterEmail = req.user.email; // Force their own email if not admin
    }

    const sql = `
        SELECT s.*, e.title as event_title FROM paper_submissions s
        LEFT JOIN events e ON s.event_id = e.id
        ${filterEmail ? " WHERE s.user_email = ?" : ""}
        ORDER BY s.created_at DESC
    `;
    db.query(sql, filterEmail ? [filterEmail] : [], (err, results) => {
        if(err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// ==========================================
// UPDATE USER PROFILE (Digital Business Card)
// ==========================================
app.put('/api/users/profile', verifyToken, (req, res) => {
    const { 
        email, 
        name, 
        job_title, 
        designation, 
        university_org, 
        phone, 
        bio, 
        linkedin_url, 
        facebook_url, 
        twitter_url 
    } = req.body;
    
    // Security check: Only let them update their own profile unless they are an admin
    if (req.user.email !== email && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Unauthorized profile update' });
    }

    const query = `
        UPDATE users 
        SET 
            full_name = ?, 
            job_title = ?, 
            designation = ?, 
            university_org = ?, 
            phone = ?, 
            bio = ?, 
            linkedin_url = ?, 
            facebook_url = ?, 
            twitter_url = ? 
        WHERE email = ?
    `;
    
    const values = [
        name || null, 
        job_title || null, 
        designation || null, 
        university_org || null, 
        phone || null, 
        bio || null, 
        linkedin_url || null, 
        facebook_url || null, 
        twitter_url || null, 
        email
    ];

    db.query(query, values, (err, result) => {
        if (err) {
            console.error("Error updating profile:", err);
            return res.status(500).json({ success: false, message: 'Database error saving profile' });
        }
        res.json({ success: true, message: 'Profile updated successfully' });
    });
});

// ==========================================
// ADMIN ONLY ROUTES (Requires Token + Admin)
// ==========================================

app.post('/api/create_event', verifyToken, verifyAdmin, (req, res) => {
    const { title, description, location, startDate, endDate, featured, type, mode } = req.body;
    const sql = "INSERT INTO events (title, description, location, start_date, end_date, featured, type, mode, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())";
    db.query(sql, [title, description, location, startDate, endDate, featured?1:0, type, mode], (err, result) => {
        if(err) return res.status(500).json({error: err.message});
        res.json({ success: true, newId: result.insertId });
    });
});

app.delete('/api/delete_event/:id', verifyToken, verifyAdmin, (req, res) => {
    db.query("DELETE FROM events WHERE id = ?", [req.params.id], (err) => {
        if(err) return res.status(500).json({error: err.message});
        res.json({ success: true });
    });
});

app.put('/api/events/:id', verifyToken, verifyAdmin, (req, res) => {
    const { title, description, location, startDate, endDate, featured, type, mode } = req.body;
    const sql = "UPDATE events SET title=?, description=?, location=?, start_date=?, end_date=?, featured=?, type=?, mode=? WHERE id=?";
    db.query(sql, [title, description, location, startDate, endDate, featured?1:0, type, mode, req.params.id], (err) => {
        if(err) return res.status(500).json({error: err.message});
        res.json({ success: true });
    });
});

app.put('/api/registrations/:id', verifyToken, verifyAdmin, (req, res) => {
    const { status, room_id, admin_note } = req.body;
    let sql = "UPDATE registrations SET status = ?";
    let params = [status];

    if (room_id !== undefined) { sql += ", room_id = ?"; params.push(room_id); }
    if (admin_note !== undefined) { sql += ", admin_note = ?"; params.push(admin_note); }

    sql += " WHERE id = ?";
    params.push(req.params.id);

    db.query(sql, params, (err) => {
        if(err) return res.status(500).json({error: err.message});
        res.json({ success: true });
    });
});

app.put('/api/registrations/:id/assign-nfc', verifyToken, verifyAdmin, (req, res) => {
    const { nfc_card_id } = req.body;
    db.query("SELECT id FROM registrations WHERE nfc_card_id = ? AND id != ?", [nfc_card_id, req.params.id], (err, results) => {
        if(results.length > 0) return res.status(400).json({ success: false, message: "Card already in use!" });
        db.query("UPDATE registrations SET nfc_card_id = ? WHERE id = ?", [nfc_card_id, req.params.id], (err) => {
            if(err) return res.status(500).json({error: err.message});
            res.json({ success: true });
        });
    });
});

app.delete('/api/registrations/:id', verifyToken, verifyAdmin, (req, res) => {
    db.query("DELETE FROM registrations WHERE id = ?", [req.params.id], (err) => {
        if(err) return res.status(500).json({error: err.message});
        res.json({ success: true });
    });
});

app.get('/api/dorms', verifyToken, (req, res) => {
    db.query("SELECT * FROM dorms ORDER BY name ASC", (err, results) => res.json(results || []));
});
app.post('/api/dorms', verifyToken, verifyAdmin, (req, res) => {
    db.query("INSERT INTO dorms (name, type) VALUES (?, ?)", [req.body.name, req.body.type], (err, result) => {
        if(err) return res.status(500).json({error: err.message});
        res.json({ success: true, id: result.insertId });
    });
});
app.delete('/api/dorms/:id', verifyToken, verifyAdmin, (req, res) => {
    db.query("DELETE FROM dorms WHERE id = ?", [req.params.id], (err) => res.json({ success: !err }));
});

app.get('/api/rooms', verifyToken, (req, res) => {
    db.query("SELECT * FROM rooms ORDER BY name ASC", (err, results) => res.json(results || []));
});
app.post('/api/rooms', verifyToken, verifyAdmin, (req, res) => {
    db.query("INSERT INTO rooms (dorm_id, name, beds, occupied) VALUES (?, ?, ?, 0)", [req.body.dormId, req.body.name, req.body.beds], (err, result) => {
        if(err) return res.status(500).json({error: err.message});
        res.json({ success: true, id: result.insertId });
    });
});
app.delete('/api/rooms/:id', verifyToken, verifyAdmin, (req, res) => {
    db.query("DELETE FROM rooms WHERE id = ?", [req.params.id], (err) => res.json({ success: !err }));
});

app.get('/api/portals', verifyToken, verifyAdmin, (req, res) => {
    db.query("SELECT p.*, e.title as event_title FROM attendance_portals p LEFT JOIN events e ON p.event_id = e.id ORDER BY p.created_at DESC", (err, results) => res.json(results || []));
});
app.post('/api/portals', verifyToken, verifyAdmin, (req, res) => {
    db.query("INSERT INTO attendance_portals (id, event_id, name, created_at) VALUES (?, ?, ?, NOW())", [req.body.id, req.body.eventId, req.body.name], (err) => res.json({ success: !err }));
});
app.delete('/api/portals/:id', verifyToken, verifyAdmin, (req, res) => {
    db.query("DELETE FROM attendance_portals WHERE id = ?", [req.params.id], (err) => res.json({ success: !err }));
});

app.get('/api/attendance_logs', verifyToken, verifyAdmin, (req, res) => {
    const sql = `SELECT al.id, al.scanned_at, al.room_name, COALESCE(u.full_name, 'Unknown') as participant_name, COALESCE(e.title, 'Unknown') as event_title FROM attendance_logs al LEFT JOIN registrations r ON al.registration_id = r.id LEFT JOIN users u ON r.user_id = u.id LEFT JOIN events e ON r.event_id = e.id ORDER BY al.scanned_at DESC`;
    db.query(sql, (err, results) => res.json(results || []));
});

app.put('/api/submissions/:id/status', verifyToken, verifyAdmin, (req, res) => {
    db.query("UPDATE paper_submissions SET status = ? WHERE id = ?", [req.body.status, req.params.id], (err) => res.json({ success: !err }));
});

app.put('/api/registrations/:id/mark-certificate', verifyToken, verifyAdmin, (req, res) => {
    const regId = req.params.id;

    // 1. Fetch the participant's exact details (including their specific email)
    const fetchSql = `
        SELECT r.*, u.full_name, u.email as user_email, e.title as event_title 
        FROM registrations r
        JOIN users u ON r.user_id = u.id
        JOIN events e ON r.event_id = e.id
        WHERE r.id = ?
    `;

    db.query(fetchSql, [regId], (err, results) => {
        if (err || results.length === 0) {
            return res.status(500).json({ success: false, message: "Could not find registration details." });
        }

        const participant = results[0];

        // 2. Draft the Email
        const mailOptions = {
            from: `"Conexus Event System" <${process.env.EMAIL_USER}>`,
            to: participant.user_email, // <-- This sends it to ANY email provider they used!
            subject: `Your Certificate for ${participant.event_title}`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid #e5e7eb; border-radius: 12px;">
                    <h2 style="color: #061f38;">Certificate Issued</h2>
                    <p>Dear <b>${participant.full_name}</b>,</p>
                    <p>Thank you for attending <b>${participant.event_title}</b>. Your certificate of participation has been officially issued by the organizers.</p>
                    <p>You can log in to your Conexus dashboard at any time to view and download your high-quality PDF certificate.</p>
                    <br/>
                    <p>Best regards,<br/><b>The Event Organizers</b></p>
                </div>
            `
        };

        // 3. Send the Email
        transporter.sendMail(mailOptions, (mailErr, info) => {
            if (mailErr) {
                console.error("Email Error:", mailErr);
                return res.status(500).json({ success: false, message: "Failed to send email." });
            }

            // 4. Only update the database AFTER the email successfully sends
            db.query("UPDATE registrations SET certificate_issued_at = NOW() WHERE id = ?", [regId], (updateErr) => {
                if (updateErr) {
                    return res.status(500).json({ success: false, message: "Emailed, but failed to update database." });
                }
                res.json({ success: true, message: "Certificate emailed and marked as issued." });
            });
        });
    });
});

// ==========================================
// BATCH EMAIL ROUTE
// ==========================================
app.post('/api/registrations/batch-email-certificates', verifyToken, verifyAdmin, async (req, res) => {
    const { registrationIds } = req.body;
    
    if (!registrationIds || !Array.isArray(registrationIds) || registrationIds.length === 0) {
        return res.status(400).json({ success: false, message: "No registrations provided." });
    }

    // Prepare SQL to grab data for ALL selected IDs at once
    const placeholders = registrationIds.map(() => '?').join(',');
    const fetchSql = `
        SELECT r.*, u.full_name, u.email as user_email, e.title as event_title 
        FROM registrations r
        JOIN users u ON r.user_id = u.id
        JOIN events e ON r.event_id = e.id
        WHERE r.id IN (${placeholders})
    `;

    db.query(fetchSql, registrationIds, async (err, results) => {
        if (err || results.length === 0) {
            return res.status(500).json({ success: false, message: "Could not find registration details." });
        }

        let successCount = 0;
        let errorsCount = 0;

        // Loop through each person and send their email one by one
        for (const participant of results) {
            const mailOptions = {
                from: `"Conexus Event System" <${process.env.EMAIL_USER}>`,
                to: participant.user_email,
                subject: `Your Certificate for ${participant.event_title}`,
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid #e5e7eb; border-radius: 12px;">
                        <h2 style="color: #061f38;">Certificate Issued</h2>
                        <p>Dear <b>${participant.full_name}</b>,</p>
                        <p>Thank you for attending <b>${participant.event_title}</b>. Your certificate of participation has been officially issued by the organizers.</p>
                        <p>You can log in to your Conexus dashboard at any time to view and download your high-quality PDF certificate.</p>
                        <br/>
                        <p>Best regards,<br/><b>The Event Organizers</b></p>
                    </div>
                `
            };

            try {
                // Wait for the email to send
                await transporter.sendMail(mailOptions);
                
                // If successful, update their specific row in the database
                await new Promise((resolve, reject) => {
                    db.query("UPDATE registrations SET certificate_issued_at = NOW() WHERE id = ?", [participant.id], (updateErr) => {
                        if (updateErr) reject(updateErr);
                        else resolve();
                    });
                });
                successCount++;
            } catch (e) {
                console.error("Failed to process email for ID:", participant.id, e);
                errorsCount++;
            }
        }

        // Return a summary of how many succeeded vs failed
        res.json({ success: true, processed: successCount, failed: errorsCount });
    });
});

app.listen(PORT, () => console.log(`🚀 DATABASE Server is now running on Port ${PORT}`));