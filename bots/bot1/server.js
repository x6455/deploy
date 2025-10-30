// server.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const DB_NAME = process.env.DB_NAME || 'database.json';
console.log(`🗄️  Using database file: ${DB_NAME}`);

let db = require('./database');


const authDB = require('./authDatabase');
authDB.initAuthDB('authData.json'); // initialize once at startup

const mediaDir = path.join(__dirname, 'mediaFromTeacher');
if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir);



// initialize database with chosen file
if (typeof db.initDB === 'function') db.initDB(DB_NAME);

let Student = db.Student;
let Grade = db.Grade;
let Attendance = db.Attendance;
let User = db.User;
let Announcement = db.Announcement;

// --- Express setup ---  


const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public/portal')));
app.use('/media', express.static(path.join(__dirname, 'mediaFromTeacher')));



const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';
const TOKEN_EXPIRES = '8h';

setInterval(() => {
  try {
    delete require.cache[require.resolve('./database')];
    db = require('./database');
    if (typeof db.initDB === 'function') db.initDB(DB_NAME);

    Student = db.Student;
    Grade = db.Grade;
    Attendance = db.Attendance;
    User = db.User;
    Announcement = db.Announcement; // ✅ include this line!

  } catch (err) {
    console.error('⚠️  Database auto-refresh error:', err.message);
  }
}, 1000);


// --- Helpers ---
function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}
function verifyPassword(password, hashed) {
  return hashPassword(password) === hashed;
}

// --- Auth Middleware ---
async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer '))
    return res.status(401).json({ error: 'Unauthorized' });

  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const student = await Student.findOne({ studentId: payload.studentId });
    if (!student) return res.status(401).json({ error: 'Invalid token' });
    req.student = student;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// --- ROUTES ---
// 🔹 Check student existence + whether account exists in authDB
app.get('/api/auth/check/:studentId', async (req, res) => {
  try {
    const studentId = (req.params.studentId || '').trim().toUpperCase();
    if (!studentId) return res.status(400).json({ error: 'studentId required' });

    // 1️⃣ Check if the student exists in main student database
    const student = await Student.findOne({ studentId });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    // 2️⃣ Check if this student already has an account in authDB
    const user = authDB.getUser(studentId);
    const hasPassword = !!(user && user.passwordHash);

    // Return safe info for frontend
    const safe = {
      studentId: student.studentId,
      name: student.name || null,
      class: student.class || null
    };

    return res.json({ exists: true, student: safe, hasPassword });
  } catch (err) {
    console.error('Check endpoint error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});


// ✅ Announcements API route
app.get('/api/announcements', async (req, res) => {
  try {
    const { studentId } = req.query;

    if (!studentId) return res.json([]);

    const student = await Student.findOne({ studentId });
    if (!student) return res.json([]);

    // Match announcements for the student's class or subjects
    const classAnns = await Announcement.find({
      type: 'class',
      target: student.class
    });

    const subjectAnns = await Announcement.find({
      type: 'subject'
    });

    // Combine and sort by date
    const all = [...classAnns, ...subjectAnns].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.json({
      announcements: all.map(a => ({
        teacherName: a.teacherName,
        type: a.type,
        target: a.target,
        text: a.message?.text || null,
        mediaUrl: a.message?.mediaPath || null,
        mediaType: a.message?.mediaType || null,
        createdAt: a.createdAt
      }))
    });
    

  } catch (err) {
    console.error('Error in /api/announcements:', err);
    res.status(500).json({ error: 'Server error loading announcements' });
  }
});



// 🔹 Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { studentId, password, name } = req.body;
    if (!studentId || !password)
      return res.status(400).json({ error: 'studentId and password required' });

    const student = await Student.findOne({ studentId: studentId.trim().toUpperCase() });
    if (!student)
      return res.status(404).json({ error: 'Student not found' });

    const existing = authDB.getUser(student.studentId);
    if (existing)
      return res.status(409).json({ error: 'Account already exists' });

    const passwordHash = hashPassword(password);
    authDB.addUser({
      studentId: student.studentId,
      name: student.name || name,
      className: student.class,
      passwordHash,
    });

    res.json({ ok: true, message: 'Account registered successfully.' });
  } catch (err) {
    console.error('Register error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 🔹 Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { studentId, password } = req.body;
    if (!studentId || !password)
      return res.status(400).json({ error: 'studentId and password required' });

    const user = authDB.getUser(studentId.trim().toUpperCase());
    if (!user)
      return res.status(401).json({ error: 'Account not found. Please register first.' });

    if (!verifyPassword(password, user.passwordHash))
      return res.status(401).json({ error: 'Incorrect password' });

    const token = jwt.sign({ studentId: user.studentId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRES });
    authDB.recordLogin(user.studentId);

    res.json({ ok: true, token, student: { studentId: user.studentId, name: user.name, class: user.className } });
  } catch (err) {
    console.error('Login error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Profile
app.get('/api/me', authMiddleware, async (req, res) => {
  const s = req.student.toObject ? req.student.toObject() : req.student;
  delete s.passwordHash;
  res.json({ ok: true, student: s });
});

// Grades
app.get('/api/grades', authMiddleware, async (req, res) => {
  try {
    const studentId = req.student.studentId;
    const grades = await Grade.find({ studentId }).sort({ date: -1 });
    res.json({
      ok: true,
      grades: grades.map((g) => (g.toObject ? g.toObject() : g)),
    });
  } catch (err) {
    console.error('Grades fetch error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Attendance
app.get('/api/attendance', authMiddleware, async (req, res) => {
  try {
    const studentId = req.student.studentId;
    const attendances = await Attendance.find({
      students: { $elemMatch: { studentId } },
    }).sort({ date: -1 });
    const result = attendances.map((att) => {
      const entry = (att.students || []).find(
        (s) => s.studentId === studentId
      );
      return {
        date: att.date,
        subject: att.subject,
        className: att.className,
        status: entry ? entry.status : 'unknown',
        teacherName: att.teacherName,
      };
    });
    res.json({ ok: true, attendance: result });
  } catch (err) {
    console.error('Attendance fetch error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Change password
app.post('/api/auth/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res
        .status(400)
        .json({ error: 'currentPassword and newPassword required' });

    const student = req.student;
    if (!verifyPassword(currentPassword, student.passwordHash))
      return res.status(401).json({ error: 'Current password incorrect' });

    student.passwordHash = hashPassword(newPassword);
    await student.save();
    res.json({ ok: true, message: 'Password changed.' });
  } catch (err) {
    console.error('Change password error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`🎓 Student portal API running on port ${PORT}`)
);
