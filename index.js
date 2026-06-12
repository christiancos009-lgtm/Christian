require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");

// ================= CONFIG =================
const TOKEN = process.env.TOKEN;
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

// ================= DB =================
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

// ================= CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ]
});

// ================= SAFE ROLE CHECK =================
function hasAllowedRole(member) {
  return member?.roles?.cache?.some(r =>
    ALLOWED_ROLES.includes(r.id)
  );
}

// ================= VOICE TRACK =================
const voiceSessions = new Map();

client.once("ready", async () => {
  console.log(`Bot online come ${client.user.tag}`);

  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;

  // preload safe (evita fetch loop dopo)
  try {
    await guild.members.fetch();
  } catch (e) {
    console.log("Initial fetch skipped (rate limit safe)");
  }
});

// ================= VOICE STATE =================
client.on("voiceStateUpdate", (oldState, newState) => {
  const member = newState.member || oldState.member;
  if (!member) return;

  if (!hasAllowedRole(member)) return;

  const userId = member.id;

  if (!oldState.channelId && newState.channelId) {
    voiceSessions.set(userId, Date.now());
  }

  if (oldState.channelId && !newState.channelId) {
    const start = voiceSessions.get(userId);
    if (!start) return;

    const minutes = Math.floor((Date.now() - start) / 60000);

    const db = loadDB();
    db[userId] = (db[userId] || 0) + minutes;
    saveDB(db);

    voiceSessions.delete(userId);
  }
});

// ================= TIMER (ANTI RATE LIMIT FIX) =================
setInterval(() => {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;

  const db = loadDB();

  const members = guild.members.cache.filter(m =>
    m?.voice?.channel && hasAllowedRole(m)
  );

  for (const member of members.values()) {
    db[member.id] = (db[member.id] || 0) + 1;
  }

  saveDB(db);
}, 60000);

// ================= COMMANDS =================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // /activity
  if (interaction.commandName === "activity") {
    await interaction.deferReply({ ephemeral: true });

    if (!hasAllowedRole(interaction.member)) {
      return interaction.editReply("❌ Non autorizzato");
    }

    const db = loadDB();

    const minutes = db[interaction.user.id] || 0;
    const remaining = Math.max(WEEKLY_GOAL - minutes, 0);

    return interaction.editReply(
      `📊 ATTIVITÀ SETTIMANALE\n\n🎙️ Tempo vocale: ${minutes}m / ${WEEKLY_GOAL}m\n\n⏳ Mancano ${remaining} minuti`
    );
  }

  // /dm
  if (interaction.commandName === "dm") {
    if (!OWNER_IDS.includes(interaction.user.id)) {
      return interaction.reply({ content: "❌ Non autorizzato", ephemeral: true });
    }

    const user = interaction.options.getUser("utente");
    const text = interaction.options.getString("messaggio");

    try {
      await user.send(text);
      return interaction.reply({ content: "✅ DM inviato", ephemeral: true });
    } catch {
      return interaction.reply({ content: "❌ DM fallito", ephemeral: true });
    }
  }

  // ================= /report =================
  if (interaction.commandName === "report") {
    if (!OWNER_IDS.includes(interaction.user.id)) {
      return interaction.reply({ content: "❌ Non autorizzato", ephemeral: true });
    }

    const guild = interaction.guild;
    const db = loadDB();

    const members = guild.members.cache.filter(m => hasAllowedRole(m));

    let msg = "📊 REPORT SETTIMANALE\n\n";

    for (const member of members.values()) {
      const minutes = db[member.id] || 0;
      const ok = minutes >= WEEKLY_GOAL;

      msg += `${ok ? "✅" : "❌"} ${member.user.username} — ${minutes}m\n`;
    }

    return interaction.reply({ content: msg, ephemeral: true });
  }

  // ================= /resetreport =================
  if (interaction.commandName === "resetreport") {
    if (!OWNER_IDS.includes(interaction.user.id)) {
      return interaction.reply({ content: "❌ Non autorizzato", ephemeral: true });
    }

    const guild = interaction.guild;
    const db = loadDB();

    const members = guild.members.cache.filter(m => hasAllowedRole(m));

    let msg = "📊 REPORT FINALE (RESET)\n\n";

    for (const member of members.values()) {
      const minutes = db[member.id] || 0;
      const ok = minutes >= WEEKLY_GOAL;

      msg += `${ok ? "✅" : "❌"} ${member.user.username} — ${minutes}m\n`;
    }

    const channel = await guild.channels.fetch(REPORT_CHANNEL_ID);
    if (channel) await channel.send(msg);

    saveDB({});

    return interaction.reply({
      content: "🧹 Reset completato e report inviato nel canale",
      ephemeral: true
    });
  }
});

// ================= LOGIN =================
client.login(TOKEN);