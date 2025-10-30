// authDatabase.js
const fs = require('fs');
const path = require('path');

let DB_FILE = 'authData.json';
let data = { users: [], logins: [] };

function initAuthDB(filename) {
  DB_FILE = filename || DB_FILE;
  if (fs.existsSync(DB_FILE)) {
    try {
      data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (err) {
      console.error('⚠️ Failed to read auth database, resetting...', err);
      data = { users: [], logins: [] };
      save();
    }
  } else {
    save();
  }
}

function save() {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function getUser(studentId) {
  return data.users.find(u => u.studentId === studentId);
}

function addUser({ studentId, name, className, passwordHash }) {
  const existing = getUser(studentId);
  if (existing) return false;
  data.users.push({ studentId, name, className, passwordHash, createdAt: new Date().toISOString() });
  save();
  return true;
}

function updatePassword(studentId, newHash) {
  const user = getUser(studentId);
  if (!user) return false;
  user.passwordHash = newHash;
  save();
  return true;
}

function recordLogin(studentId) {
  data.logins.push({ studentId, date: new Date().toISOString() });
  save();
}

function getLogins(studentId) {
  return data.logins.filter(l => l.studentId === studentId);
}

function getAllUsers() {
  return data.users;
}

module.exports = {
  initAuthDB,
  getUser,
  addUser,
  updatePassword,
  recordLogin,
  getLogins,
  getAllUsers, // ✅ add this
};
