require("dotenv").config();
const {
  Client,
  GatewayIntentBits
} = require("discord.js");

const sqlite3 = require("sqlite3").verbose();

// ================= CONFIG =================
const TOKEN = process.env.TOKEN;

const REPORT_CHANNEL_ID = "1509983822236614869";

const ALLOWED_ROLES = [
  "1438255779558981676",
  "1438255779558981675",
  "1438255779558981673"
];

const WEEKLY_GOAL = 60;

// ================= DB =================
const db = new sqlite3.Database("./activity.db");

db.run(`
CREATE TABLE IF NOT EXISTS activity (
  userId TEXT PRIMARY KEY,
  voiceTime INTEGER DEFAULT 0
)
`);

const voiceSessions = new Map();

// anti doppio report
let lastReport = 0;

// ================= CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ]
});

// ================= READY =================
client.once("ready", () => {
  console.log(`Bot online come ${client.user.tag}`);
});

// ================= ROLE CHECK =================
function hasAllowedRole(member) {
  return member.roles.cache.some(r =>
    ALLOWED_ROLES.includes(r.id)
  );
}

// ================= VOICE TRACKING =================
client.on("voiceStateUpdate", (oldState, newState) => {
  const member = newState.member || oldState.member;
  if (!member) return;

  if (!hasAllowedRole(member)) return;

  const userId = member.id;

  // entra in vocale
  if (!oldState.channelId && newState.channelId) {
    voiceSessions.set(userId, Date.now());
  }

  // esce da vocale
  if (oldState.channelId && !newState.channelId) {

    const start = voiceSessions.get(userId);
    if (!start) return;

    const minutes = Math.floor((Date.now() - start) / 60000);

    db.run(`
      INSERT INTO activity(userId, voiceTime)
      VALUES (?, ?)
      ON CONFLICT(userId)
      DO UPDATE SET voiceTime = voiceTime + ?
    `, [userId, minutes, minutes]);

    voiceSessions.delete(userId);
  }
});

// ================= /activity =================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "activity") {

    db.get(
      "SELECT voiceTime FROM activity WHERE userId = ?",
      [interaction.user.id],
      (err, row) => {

        const minutes = row?.voiceTime || 0;
        const remaining = Math.max(WEEKLY_GOAL - minutes, 0);
        const completed = minutes >= WEEKLY_GOAL;

        interaction.reply({
          content:
`📊 ATTIVITÀ SETTIMANALE

🎙️ Tempo vocale: ${minutes}m / ${WEEKLY_GOAL}m

${completed
  ? "✅ Obiettivo completato"
  : `⏳ Mancano ${remaining} minuti`
}`,
          ephemeral: true
        });
      }
    );
  }
});

// ================= REPORT FUNCTION =================
async function sendReport(guild) {

  const channel = await guild.channels.fetch(REPORT_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  db.all("SELECT * FROM activity", async (err, rows) => {

    let msg = "📊 REPORT SETTIMANALE\n\n";

    for (const row of rows) {

      const member = await guild.members.fetch(row.userId).catch(() => null);
      if (!member) continue;

      if (!hasAllowedRole(member)) continue;

      const ok = row.voiceTime >= WEEKLY_GOAL;

      msg += `${ok ? "✅" : "❌"} ${member.user.username} — ${row.voiceTime}m\n`;
    }

    await channel.send(msg);

    db.run("UPDATE activity SET voiceTime = 0");
  });
}

// ================= WEEKLY RESET (MONDAY 00:00) =================
setInterval(() => {

  const now = new Date();

  const isMondayMidnight =
    now.getDay() === 1 &&
    now.getHours() === 0 &&
    now.getMinutes() === 0;

  const nowTime = Date.now();

  if (isMondayMidnight && nowTime - lastReport > 60000) {

    lastReport = nowTime;

    const guild = client.guilds.cache.first();
    if (!guild) return;

    sendReport(guild);

    db.run("UPDATE activity SET voiceTime = 0");

    console.log("📊 Report settimanale inviato + reset completato");
  }

}, 60000);

// ================= LOGIN =================
client.login(TOKEN);