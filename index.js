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

// ================= VOICE ENTER TRACK =================
const voiceSessions = new Map();

client.on("voiceStateUpdate", (oldState, newState) => {

  const member = newState.member || oldState.member;
  if (!member) return;

  if (!hasAllowedRole(member)) return;

  const userId = member.id;

  // entra in vocale
  if (!oldState.channelId && newState.channelId) {
    voiceSessions.set(userId, Date.now());
  }

  // esce dalla vocale (backup)
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

// ================= 🔥 MAIN FIX: TIMER OGNI 60 SECONDI =================
setInterval(async () => {

  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;

  await guild.members.fetch();

  const db = loadDB();

  for (const member of guild.members.cache.values()) {

    if (!member.voice.channel) continue;
    if (!hasAllowedRole(member)) continue;

    const userId = member.id;

    db[userId] = (db[userId] || 0) + 1; // +1 minuto ogni tick
  }

  saveDB(db);

}, 60 * 1000);

// ================= COMMANDS =================
client.on("interactionCreate", async (interaction) => {

  if (!interaction.isChatInputCommand()) return;

  // /activity
  if (interaction.commandName === "activity") {

    await interaction.deferReply({ ephemeral: true });

    const member = interaction.member;

    if (!hasAllowedRole(member)) {
      return interaction.editReply("❌ Non autorizzato (solo ASE roles)");
    }

    const db = loadDB();

    const minutes = db[interaction.user.id] || 0;
    const remaining = Math.max(WEEKLY_GOAL - minutes, 0);

    return interaction.editReply(
`📊 ATTIVITÀ SETTIMANALE

🎙️ Tempo vocale: ${minutes}m / ${WEEKLY_GOAL}m

⏳ Mancano ${remaining} minuti`
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
      return interaction.reply({
        content: "❌ Non autorizzato",
        ephemeral: true
      });
    }

    const db = loadDB();

    await interaction.guild.members.fetch();

    let msg = "📊 REPORT SETTIMANALE\n\n";

    for (const member of interaction.guild.members.cache.values()) {

      if (!hasAllowedRole(member)) continue;

      const minutes = db[member.id] || 0;
      const ok = minutes >= WEEKLY_GOAL;

      msg += `${ok ? "✅" : "❌"} ${member.user.username} — ${minutes}m\n`;
    }

    return interaction.reply({
      content: msg,
      ephemeral: true
    });
  }

  // ================= /resetreport =================
 if (interaction.commandName === "resetreport") {

  if (!OWNER_IDS.includes(interaction.user.id)) {
    return interaction.reply({
      content: "❌ Non autorizzato",
      ephemeral: true
    });
  }

  const db = loadDB();
  await interaction.guild.members.fetch();

  let msg = "📊 REPORT FINALE (RESET)\n\n";

  for (const member of interaction.guild.members.cache.values()) {

    if (!hasAllowedRole(member)) continue;

    const minutes = db[member.id] || 0;
    const ok = minutes >= WEEKLY_GOAL;

    msg += `${ok ? "✅" : "❌"} ${member.user.username} — ${minutes}m\n`;
  }

  const channel = await interaction.guild.channels.fetch(REPORT_CHANNEL_ID);
  await channel.send(msg);

  saveDB({}); // reset

  return interaction.reply({
    content: "🧹 Reset completato e report inviato nel canale",
    ephemeral: true
  });
}
// ================= LOGIN =================
client.login(TOKEN);