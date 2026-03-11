require('dotenv').config();
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
const express = require('express');
const path = require('path'); 
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const app = express();

// --- CONFIGURATION ---
const PORT = process.env.PORT || 8000; 
const JWT_SECRET = process.env.JWT_SECRET || 'conexus_super_secret_key_2026'; // Added Secret

// TRANSPORTER COMMENTED OUT: Replaced by Google Webhook to bypass Railway Firewall
/* const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS  
    },
    tls: { rejectUnauthorized: false }
});
*/

// --- Ensure uploads directory exists ---
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
    console.log('📁 Created missing uploads folder');
}

// --- OJS Configuration ---
const OJS_CONFIG = {
    apiUrl: 'https://darkgoldenrod-kudu-650795.hostingersite.com/index.php/crj/api/v1',
    apiKey: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.WyJhM2Q0ZTIzYzAzNTJkMGE1NWYzNTM4YWM1NzVlMmU1Yzk3ZWZlY2E2Il0.G8bttl3F8jfti1uJGzTdMW-LYboKXK_x-RewWFgeOHo'
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
    // Added 'gender' to the destructured body
    const { name, email, password, university, gender } = req.body;
    
    const slug = name.toLowerCase().replace(/\s+/g, '-') + '-' + Math.floor(1000 + Math.random() * 9000);

    db.query("SELECT id FROM users WHERE email = ?", [email], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length > 0) return res.json({ success: false, message: 'Email taken' });

        // Updated INSERT query to include the gender column
        db.query("INSERT INTO users (full_name, email, password, university_org, role, profile_slug, gender) VALUES (?, ?, ?, ?, 'participant', ?, ?)", 
        [name, email, password, university, slug, gender], (err, result) => {
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
                        id: user.id, name: user.full_name, email: user.email, role: user.role, gender: user.gender, 
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

// --- PUBLIC: VERIFY CERTIFICATE ---
app.get('/api/verify/:id', (req, res) => {
    const sql = `
        SELECT r.id, r.status, r.certificate_issued_at, u.full_name, e.title as event_title 
        FROM registrations r 
        JOIN users u ON r.user_id = u.id 
        JOIN events e ON r.event_id = e.id 
        WHERE r.id = ? AND r.certificate_issued_at IS NOT NULL
    `;
    db.query(sql, [req.params.id], (err, results) => {
        if (err || results.length === 0) {
            return res.json({ valid: false });
        }
        res.json({ valid: true, data: results[0] });
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
        SELECT 
            r.id, r.user_id, r.event_id as eventId, r.registration_type, 
            r.payment_status, r.paper_status, r.files_status, r.accommodation_needed, 
            r.transportation_needed, r.qr_code_data, r.nfc_tag_id, r.nfc_card_id, 
            r.status, r.created_at, r.room_id, r.valid_id_path, r.admin_note, 
            r.certificate_issued_at as certificateIssuedAt, r.reg_role, 
            r.presentation_path, r.video_path, r.first_name, r.last_name, 
            r.middle_name, r.gender, r.age, r.contact_number, r.proof_of_payment_path,
            u.full_name as fullName, u.email as userEmail, u.university_org as university, 
            u.profile_slug, e.title as eventTitle, e.mode,
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

app.post('/api/register', verifyToken, upload.fields([
    { name: 'valid_id', maxCount: 1 },
    { name: 'proof_of_payment', maxCount: 1 }, 
    { name: 'presentation_file', maxCount: 1 },
    { name: 'video_file', maxCount: 1 }
]), (req, res) => {
    let { user_email, event_id, companions, reg_role, first_name, last_name, middle_name, gender, age, contact_number } = req.body;
    
    const valid_id_path = req.files && req.files['valid_id'] ? req.files['valid_id'][0].path : null;
    const proof_of_payment_path = req.files && req.files['proof_of_payment'] ? req.files['proof_of_payment'][0].path : null; 
    const presentation_path = req.files && req.files['presentation_file'] ? req.files['presentation_file'][0].path : null;
    const video_path = req.files && req.files['video_file'] ? req.files['video_file'][0].path : null;
    const role = reg_role || 'participant';

    if (typeof companions === 'string') {
        try { companions = JSON.parse(companions); } catch (e) { companions = []; }
    }

    db.getConnection((err, connection) => {
        if (err) return res.status(500).json({ error: "Database connection error" });
        connection.beginTransaction((err) => {
            if (err) { connection.release(); return res.status(500).json({ error: err.message }); }
            
            connection.query("SELECT id FROM users WHERE email = ?", [user_email], (err, users) => {
                if (err || users.length === 0) { return connection.rollback(() => { connection.release(); res.status(404).json({ message: 'User not found' }); }); }
                
                const sqlReg = "INSERT INTO registrations (user_id, event_id, status, valid_id_path, proof_of_payment_path, reg_role, presentation_path, video_path, first_name, last_name, middle_name, gender, age, contact_number, created_at) VALUES (?, ?, 'For approval', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())";
                
                connection.query(sqlReg, [users[0].id, event_id, valid_id_path, proof_of_payment_path, role, presentation_path, video_path, first_name, last_name, middle_name, gender, age, contact_number], (err, result) => {
                    if (err) { return connection.rollback(() => { connection.release(); res.status(500).json({ error: err.message }); }); }
                    
                    const regId = result.insertId;
                    if (companions && Array.isArray(companions) && companions.length > 0) {
                        const compSql = "INSERT INTO registration_companions (registration_id, name, relation, phone, email) VALUES ?";
                        const values = companions.map(c => [regId, c.name, c.relation, c.phone, c.email]);
                        connection.query(compSql, [values], (err) => {
                            if (err) { return connection.rollback(() => { connection.release(); res.status(500).json({ error: "Companion insert failed" }); }); }
                            connection.commit(() => { connection.release(); res.json({ success: true, regId }); });
                        });
                    } else {
                        connection.commit(() => { connection.release(); res.json({ success: true, regId }); });
                    }
                });
            });
        });
    });
});

app.post('/api/register/complete', verifyToken, upload.fields([
    { name: 'proof_of_payment', maxCount: 1 },
    { name: 'presentation_file', maxCount: 1 },
    { name: 'video_file', maxCount: 1 }
]), (req, res) => {
    const { registration_id, step } = req.body;
    
    let updates = [];
    let params = [];

    // If Step 3: Save Payment File
    if (Number(step) === 3 && req.files && req.files['proof_of_payment']) {
        updates.push('proof_of_payment_path = ?');
        params.push(req.files['proof_of_payment'][0].path);
        updates.push('payment_status = ?');
        params.push('Pending'); 
    } 
    // If Step 4: Save Presentation Files
    else if (Number(step) === 4 && req.files) {
        if (req.files['presentation_file']) {
            updates.push('presentation_path = ?');
            params.push(req.files['presentation_file'][0].path);
        }
        if (req.files['video_file']) {
            updates.push('video_path = ?');
            params.push(req.files['video_file'][0].path);
        }
        updates.push('files_status = ?');
        params.push('Pending');
    }

    if (updates.length === 0) {
        return res.status(400).json({ success: false, message: "No valid files received." });
    }

    const sql = `UPDATE registrations SET ${updates.join(', ')} WHERE id = ?`;
    params.push(registration_id);

    db.query(sql, params, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: "Files successfully saved to database." });
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

        // --- UPDATED OJS INTEGRATION BRIDGE ---
        try {
            console.log("Starting OJS Integration Sync...");

            // Step 1: Push Metadata to create the official submission in OJS
            const metadataPayload = {
                locale: "en",
                title: { en: title || "Untitled Research Paper" }, 
                abstract: { en: abstract || "Abstract synced from Conexus Dashboard." }, 
                sectionId: 1 
            };

            const submissionRes = await axios.post(
                `${OJS_CONFIG.apiUrl}/submissions`,
                metadataPayload,
                {
                    headers: {
                        'Authorization': `Bearer ${OJS_CONFIG.apiKey}`,
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'application/json, text/plain, */*'
                    }
                }
            );

            const ojsSubmissionId = submissionRes.data.id;
            console.log(`✅ Success! Created OJS Submission ID: ${ojsSubmissionId}`);

            // Step 2: Push the PDF file to Temporary Storage
            if (file) {
                const form = new FormData();
                form.append('file', fs.createReadStream(file.path));

                const tempFileRes = await axios.post(
                    `${OJS_CONFIG.apiUrl}/temporaryFiles`,
                    form,
                    {
                        headers: {
                            ...form.getHeaders(),
                            'Authorization': `Bearer ${OJS_CONFIG.apiKey}`,
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                        }
                    }
                );
                
                const temporaryFileId = tempFileRes.data.id;
                console.log(`✅ Success! Uploaded PDF to OJS Temp File ID: ${temporaryFileId}`);

                // --- NEW: Step 3 - Link the Temp File to the Submission ---
                console.log("🔗 Linking file to submission...");
                await axios.post(
                    `${OJS_CONFIG.apiUrl}/submissions/${ojsSubmissionId}/files`,
                    {
                        fileStage: 2, // 2 = Submission Stage
                        genreId: 1,   // 1 = Article Text (Default OJS genre)
                        temporaryFileId: temporaryFileId
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${OJS_CONFIG.apiKey}`,
                            'Content-Type': 'application/json',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                        }
                    }
                );
                console.log("✅ Success! File attached to submission.");

                // --- NEW: Step 4 - Mark submission as Complete (Remove 'Incomplete' status) ---
                console.log("🏁 Finalizing submission...");
                await axios.put(
                    `${OJS_CONFIG.apiUrl}/submissions/${ojsSubmissionId}`,
                    { submissionProgress: 0 }, // 0 tells OJS the wizard is complete
                    {
                        headers: {
                            'Authorization': `Bearer ${OJS_CONFIG.apiKey}`,
                            'Content-Type': 'application/json',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                        }
                    }
                );
                console.log("✅ Success! Submission finalized.");
            }

            // Return success for both systems
            return res.json({ success: true, id: insertId, ojsId: ojsSubmissionId, message: 'Saved to Conexus and fully synced with OJS.' });

        } catch (ojsError) {
            // We catch the error so if OJS times out, it doesn't crash your Conexus server!
            console.error("❌ OJS Integration Failed:", ojsError.response?.data || ojsError.message);
            return res.status(200).json({ success: true, id: insertId, message: "Saved to MySQL, but OJS sync failed. Admin will review manually." });
        }
        // --- END OJS INTEGRATION BRIDGE ---
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

app.put('/api/registrations/:id/steps', verifyToken, verifyAdmin, (req, res) => {
    const regId = req.params.id;
    const { status, paper_status, payment_status, files_status } = req.body;

    let sql = "UPDATE registrations SET ";
    let params = [];
    let updates = [];

    if (status) { updates.push("status = ?"); params.push(status); }
    if (paper_status) { updates.push("paper_status = ?"); params.push(paper_status); }
    if (payment_status) { updates.push("payment_status = ?"); params.push(payment_status); }
    if (files_status) { updates.push("files_status = ?"); params.push(files_status); }

    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });

    sql += updates.join(", ") + " WHERE id = ?";
    params.push(regId);

    db.query(sql, params, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: "Step updated successfully" });
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


// ==========================================
// WEBHOOK EMAIL ROUTES (BYPASSES FIREWALL)
// ==========================================

// 1. Single Certificate Route
app.put('/api/registrations/:id/mark-certificate', verifyToken, verifyAdmin, (req, res) => {
    const regId = req.params.id;

    const fetchSql = `
        SELECT r.*, u.full_name, u.email as user_email, e.title as event_title 
        FROM registrations r
        JOIN users u ON r.user_id = u.id
        JOIN events e ON r.event_id = e.id
        WHERE r.id = ?
    `;

    db.query(fetchSql, [regId], async (err, results) => {
        if (err || results.length === 0) {
            return res.status(500).json({ success: false, message: "Could not find registration details." });
        }

        const participant = results[0];

        // Format the exact same payload design
        const payload = {
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
            // Hit the Google Script URL instead of Nodemailer
            await axios.post(process.env.GOOGLE_WEBHOOK_URL, payload);

            // Update database only AFTER successful webhook
            db.query("UPDATE registrations SET certificate_issued_at = NOW() WHERE id = ?", [regId], (updateErr) => {
                if (updateErr) {
                    return res.status(500).json({ success: false, message: "Emailed, but failed to update database." });
                }
                res.json({ success: true, message: "Certificate emailed and marked as issued." });
            });
        } catch (error) {
            console.error("Webhook Error:", error.message);
            return res.status(500).json({ success: false, message: "Failed to send email." });
        }
    });
});

// 2. Batch Certificate Route
app.post('/api/registrations/batch-email-certificates', verifyToken, verifyAdmin, async (req, res) => {
    const { registrationIds } = req.body;
    
    if (!registrationIds || !Array.isArray(registrationIds) || registrationIds.length === 0) {
        return res.status(400).json({ success: false, message: "No registrations provided." });
    }

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

        for (const participant of results) {
            const payload = {
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
                // Send via Webhook
                await axios.post(process.env.GOOGLE_WEBHOOK_URL, payload);
                
                await new Promise((resolve, reject) => {
                    db.query("UPDATE registrations SET certificate_issued_at = NOW() WHERE id = ?", [participant.id], (updateErr) => {
                        if (updateErr) reject(updateErr);
                        else resolve();
                    });
                });
                successCount++;
            } catch (e) {
                console.error("Failed Webhook ID:", participant.id);
                errorsCount++;
            }
        }

        res.json({ success: true, processed: successCount, failed: errorsCount });
    });
});

app.listen(PORT, () => console.log(`🚀 DATABASE Server is now running on Port ${PORT}`));