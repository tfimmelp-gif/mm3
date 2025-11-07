// ===============================
// ✅ Company Portal — Server.js
// ===============================

import express from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 4000;
const __dirname = path.resolve();

// Middleware
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// Sessions folder
const SESSIONS_DIR = path.join(__dirname, "sessions");
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR);

// Mock users
const USERS = {
  "user1@company.com": "1234",
  "admin@company.com": "pass"
};

// Create new session file
function createSessionFile(token, username) {
  const filePath = path.join(SESSIONS_DIR, `session_${token}.json`);
  const sessionData = {
    username,
    token,
    created: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  };
  fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2));
  console.log(`🗂 Session created → ${filePath}`);
  return filePath;
}

// Retrieve session
function getSessionFromFile(token) {
  const filePath = path.join(SESSIONS_DIR, `session_${token}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (new Date(data.expiresAt) < new Date()) {
      fs.unlinkSync(filePath);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

// =========================
// 🚪 Login Route
// =========================
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  console.log(`🔐 Login attempt: ${username}`);

  if (!USERS[username]) {
    console.log("❌ Unknown email");
    return res.status(401).send("Email not recognized.");
  }

  if (USERS[username] !== password) {
    console.log("⚠️ Wrong password entered");
    return res.status(401).send("Invalid password. Please try again.");
  }

  // Successful login
  const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
  createSessionFile(token, username);

  res.cookie("session_id", token, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  console.log(`✅ Login success for ${username}`);
  res.status(200).json({ message: "Login successful", sessionFile: `/download/${token}` });
});

// =========================
// 🔐 Middleware
// =========================
function requireAuth(req, res, next) {
  const token = req.cookies.session_id;
  if (!token) return res.redirect("/");
  const session = getSessionFromFile(token);
  if (session) {
    req.user = session.username;
    return next();
  }
  res.clearCookie("session_id");
  res.redirect("/");
}

// =========================
// 🖥 Protected Dashboard
// =========================
app.get("/dashboard.html", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public/dashboard.html"));
});

// =========================
// 📦 Download Session File
// =========================
app.get("/download/:token", (req, res) => {
  const token = req.params.token;
  const filePath = path.join(SESSIONS_DIR, `session_${token}.json`);
  if (fs.existsSync(filePath)) {
    res.download(filePath, `session_${token}.json`);
  } else {
    res.status(404).send("Session file not found.");
  }
});

// =========================
// 🚪 Logout
// =========================
app.post("/logout", (req, res) => {
  const token = req.cookies.session_id;
  if (token) {
    const filePath = path.join(SESSIONS_DIR, `session_${token}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  res.clearCookie("session_id");
  res.sendStatus(200);
});

// =========================
// 🚀 Start Server
// =========================
app.listen(PORT, () => {
  console.log(`✅ Company Portal running on http://localhost:${PORT}`);
});
