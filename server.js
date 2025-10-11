import express from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 4000;
const __dirname = path.resolve();

// --- Middleware ---
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// --- Ensure /sessions folder exists ---
const SESSIONS_DIR = path.join(__dirname, "sessions");
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR);

// --- Simple user database ---
const USERS = { user1: "1234", admin: "pass" };

// --- Auto-cleanup old session files on startup ---
fs.readdirSync(SESSIONS_DIR).forEach(file => {
  const fullPath = path.join(SESSIONS_DIR, file);
  try {
    const data = JSON.parse(fs.readFileSync(fullPath));
    if (new Date(data.expiresAt) < new Date()) {
      fs.unlinkSync(fullPath);
      console.log(`🧹 Removed expired session: ${file}`);
    }
  } catch {
    fs.unlinkSync(fullPath);
  }
});

// --- Helpers ---
function createSessionFile(token, username) {
  const filePath = path.join(SESSIONS_DIR, `session_${token}.json`);
  const sessionData = {
    username,
    token,
    created: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
  };
  fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2));
}

function getSessionFromFile(token) {
  const filePath = path.join(SESSIONS_DIR, `session_${token}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(filePath));
    if (new Date(data.expiresAt) < new Date()) {
      fs.unlinkSync(filePath);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

// --- Routes ---
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (USERS[username] && USERS[username] === password) {
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    createSessionFile(token, username);
    res.cookie("session_id", token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    return res.sendStatus(200);
  }
  res.status(401).send("Invalid credentials");
});

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

app.get("/dashboard.html", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public/dashboard.html"));
});

app.post("/logout", (req, res) => {
  const token = req.cookies.session_id;
  if (token) {
    const filePath = path.join(SESSIONS_DIR, `session_${token}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  res.clearCookie("session_id");
  res.sendStatus(200);
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`✅ Cookie Login Website running at http://localhost:${PORT}`);
});
