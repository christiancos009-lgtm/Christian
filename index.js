require("dotenv").config();
const {
  Client,
  GatewayIntentBits
} = require("discord.js");

const fs = require("fs");

// ================= CONFIG =================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const REPORT_CHANNEL_ID = "1509983822236614869";

const ALLOWED_ROLES = [
  "1438255779558981676",
  "1438255779558981675",
  "1438255779558981673"
];

const OWNER_IDS = [
  "616719017234792450",
  "1092045280305762304",
  "1283221877535412356",
  "1129400258913370112"
];

const WEEKLY_GOAL = 60;

// ================= JSON DATABASE =================
const DB_FILE = "./activity.json";

function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({}));
  }
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ================= VOICE SESSIONS =================
const voiceSessions = new Map();

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
  const db = loadDB();

  if (!db[userId]) db[userId] = 0;

  if (!oldState.channelId && newState.channelId) {
    voiceSessions.set(userId, Date.now());
  }

  if (oldState.channelId && !newState.channelId) {

    const start = voiceSessions.get(userId);
    if (!start) return;

    const minutes = Math.floor((Date.now() - start) / 60000);

    db[userId] += minutes;

    saveDB(db);

    voiceSessions.delete(userId);
  }
});

// ================= COMMANDS =================
client.on("interactionCreate", async (interaction) => {

  if (!interaction.isChatInputCommand()) return;

  // ---------------- /activity ----------------
  if (interaction.commandName === "activity") {

    const db = loadDB();

    const minutes = db[interaction.user.id] || 0;
    const remaining = Math.max(WEEKLY_GOAL - minutes, 0);
    const completed = minutes >= WEEKLY_GOAL;

    return interaction.reply({
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

  // ---------------- /dm ----------------
  if (interaction.commandName === "dm") {

    if (!OWNER_IDS.includes(interaction.user.id)) {
      return interaction.reply({
        content: "❌ Non autorizzato",
        ephemeral: true
      });
    }

    const user = interaction.options.getUser("utente");
    const text = interaction.options.getString("messaggio");

    try {
      await user.send(text);

      return interaction.reply({
        content: "✅ DM inviato",
        ephemeral: true
      });

    } catch (err) {

      return interaction.reply({
        content: "❌ Impossibile inviare DM",
        ephemeral: true
      });
    }
  }
});

// ================= REPORT =================
async function sendReport(guild) {

  const channel = await guild.channels.fetch(REPORT_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const db = loadDB();

  let msg = "📊 REPORT SETTIMANALE\n\n";

  for (const userId in db) {

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) continue;

    if (!hasAllowedRole(member)) continue;

    const minutes = db[userId];
    const ok = minutes >= WEEKLY_GOAL;

    msg += `${ok ? "✅" : "❌"} ${member.user.username} — ${minutes}m\n`;
  }

  await channel.send(msg);

  saveDB({});
}

// ================= RESET WEEKLY =================
setInterval(() => {

  const now = new Date();

  const isMondayMidnight =
    now.getDay() === 1 &&
    now.getHours() === 0 &&
    now.getMinutes() === 0;

  const nowTime = Date.now();

  if (isMondayMidnight && nowTime - lastReport > 60000) {

    lastReport = nowTime;

    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) return;

    sendReport(guild);

    console.log("📊 Report inviato + reset completato");
  }

}, 60000);

// ================= LOGIN =================
client.login(TOKEN);