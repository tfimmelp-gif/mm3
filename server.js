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

app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

const SESSIONS_DIR = path.join(__dirname, "sessions");
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR);

// Track per-user attempts
const attempts = {};

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
}

// ------------------ LOGIN ------------------
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!attempts[username]) attempts[username] = 0;
  attempts[username]++;

  console.log(`🔐 Attempt ${attempts[username]} for ${username}`);

  // First attempt rejected
  if (attempts[username] < 2) {
    return res.status(401).send("Incorrect password. Please try again.");
  }

  // Second attempt accepted
  const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
  createSessionFile(token, username);
  res.cookie("session_id", token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.status(200).json({ message: "Login successful", token });
});

// ------------------ DASHBOARD ------------------
app.get("/dashboard.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public/dashboard.html"));
});

// ------------------ START SERVER ------------------
app.listen(PORT, () => console.log(`✅ Running at http://localhost:${PORT}`));
