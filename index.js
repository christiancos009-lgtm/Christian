require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");

// ================= CONFIG =================
const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;

const REPORT_CHANNEL_ID = "1515495400226684944";
const ROSTER_NOTIFICATION_CHANNEL_ID = "1522672039855656980";

const ROSTER_LEVELS = [
  { name: "Rookie", id: "1520245897588379830" },
  { name: "Academy", id: "1515495396149825625" },
  { name: "Talent", id: "1515495396166860880" },
  { name: "Main", id: "1515495396166860881" }
];

const ALLOWED_ROLES = [
  "1515495396166860881",
  "1515495396166860880",
  "1515495396149825625"
];

const OWNER_IDS = [
  "616719017234792450",
  "1092045280305762304",
  "1193517036786163742",
];

const WEEKLY_GOAL = 240;

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

// ================= ROLE CHECK =================
function hasAllowedRole(member) {
  return member?.roles?.cache?.some(role =>
    ALLOWED_ROLES.includes(role.id)
  );
}

// ================= ROSTER MANAGEMENT =================
async function changeRosterLevel(interaction, direction) {
  if (!OWNER_IDS.includes(interaction.user.id)) {
    return interaction.reply({ content: "❌ Non autorizzato", ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  const user = interaction.options.getUser("utente");
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);

  if (!member) {
    return interaction.editReply("❌ Utente non trovato nel server");
  }

  await interaction.guild.roles.fetch();

  const rosterRoles = ROSTER_LEVELS.map(level =>
    interaction.guild.roles.cache.get(level.id)
  );

  const currentLevels = rosterRoles
    .map((role, index) => ({ role, index }))
    .filter(({ role }) => role && member.roles.cache.has(role.id));

  if (currentLevels.length === 0) {
    return interaction.editReply(
      `❌ ${user} non ha un ruolo del roster (Rookie, Academy, Talent o Main)`
    );
  }

  if (currentLevels.length > 1) {
    return interaction.editReply(
      `❌ ${user} ha più di un ruolo del roster. Correggi i ruoli e riprova`
    );
  }

  const { role: currentRole, index: currentIndex } = currentLevels[0];

  if (direction === 1 && currentIndex === ROSTER_LEVELS.length - 1) {
    return interaction.editReply(
      `❌ ${user} è già nel roster più alto (Main)`
    );
  }

  if (direction === -1 && currentIndex === 0) {
    return interaction.editReply(
      `❌ ${user} non può scendere di livello: è già Rookie`
    );
  }

  const targetIndex = currentIndex + direction;
  const targetRole = rosterRoles[targetIndex];

  if (!targetRole) {
    return interaction.editReply(
      `❌ Il ruolo ${ROSTER_LEVELS[targetIndex].name} non è stato trovato nel server`
    );
  }

  const notificationChannel = await interaction.guild.channels
    .fetch(ROSTER_NOTIFICATION_CHANNEL_ID)
    .catch(() => null);

  if (!notificationChannel?.isTextBased()) {
    return interaction.editReply("❌ Canale delle promozioni non trovato");
  }

  let targetRoleAdded = false;

  try {
    await member.roles.add(targetRole);
    targetRoleAdded = true;
    await member.roles.remove(currentRole);
  } catch (error) {
    if (targetRoleAdded) {
      await member.roles.remove(targetRole).catch(() => null);
    }

    console.error("Errore durante il cambio di ruolo:", error);
    return interaction.editReply(
      "❌ Non riesco a modificare i ruoli. Controlla i permessi e la gerarchia del bot"
    );
  }

  const actionMessage = direction === 1
    ? `${user} è salito di roster in <@&${targetRole.id}>`
    : `${user} è sceso di roster in <@&${targetRole.id}>`;

  try {
    await notificationChannel.send({
      content: actionMessage,
      allowedMentions: {
        users: [user.id],
        roles: [targetRole.id]
      }
    });
  } catch (error) {
    console.error("Errore durante l'invio della notifica roster:", error);
    return interaction.editReply(
      `⚠️ ${user} è passato da ${currentRole.name} a ${targetRole.name}, ma non sono riuscito a inviare il messaggio nel canale`
    );
  }

  return interaction.editReply(
    `✅ ${user} è passato da ${currentRole.name} a ${targetRole.name}`
  );
}

// ================= READY =================
client.once("ready", async () => {
  console.log(`✅ Bot online come ${client.user.tag}`);

  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) {
    console.log("❌ Server non trovato. Controlla GUILD_ID.");
    return;
  }

  await guild.members.fetch();
  console.log("✅ Membri caricati.");
});

// ================= ACTIVE VOICE USERS =================
const activeVoiceUsers = new Set();

// ================= VOICE STATE =================
client.on("voiceStateUpdate", async (oldState, newState) => {
  const member = newState.member || oldState.member;
  if (!member) return;

  const userId = member.id;

  if (!hasAllowedRole(member)) {
    activeVoiceUsers.delete(userId);
    return;
  }

  if (!oldState.channelId && newState.channelId) {
    activeVoiceUsers.add(userId);
    console.log(`🎙️ START tracking ${member.user.username}`);
  }

  if (oldState.channelId && !newState.channelId) {
    activeVoiceUsers.delete(userId);
    console.log(`🚪 STOP tracking ${member.user.username}`);
  }
});

// ================= TIMER MINUTO PER MINUTO =================
setInterval(() => {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;

  const db = loadDB();

  for (const userId of activeVoiceUsers) {
    const member = guild.members.cache.get(userId);

    if (!member) {
      activeVoiceUsers.delete(userId);
      continue;
    }

    if (!member.voice.channelId) {
      activeVoiceUsers.delete(userId);
      continue;
    }

    if (!hasAllowedRole(member)) {
      activeVoiceUsers.delete(userId);
      continue;
    }

    db[userId] = (db[userId] || 0) + 1;
    console.log(`✅ +1 minuto a ${member.user.username} | Totale: ${db[userId]}m`);
  }

  saveDB(db);
}, 60000);

// ================= COMMANDS =================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // ================= /activity =================
  if (interaction.commandName === "activity") {
    await interaction.deferReply({ ephemeral: true });

    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);

    if (!member || !hasAllowedRole(member)) {
      return interaction.editReply("❌ Non autorizzato");
    }

    const db = loadDB();
    const minutes = db[interaction.user.id] || 0;
    const remaining = Math.max(WEEKLY_GOAL - minutes, 0);

    return interaction.editReply(
      `📊 ATTIVITÀ\n\n🎙️ ${minutes}m / ${WEEKLY_GOAL}m\n⏳ Mancano ${remaining}m`
    );
  }

  // ================= /dm =================
  if (interaction.commandName === "dm") {
    if (!OWNER_IDS.includes(interaction.user.id)) {
      return interaction.reply({ content: "❌ Non autorizzato", ephemeral: true });
    }

    const user = interaction.options.getUser("utente");
    const text = interaction.options.getString("messaggio");

    try {
      await user.send(text);
      return interaction.reply({ content: "✅ Inviato", ephemeral: true });
    } catch {
      return interaction.reply({ content: "❌ Errore DM", ephemeral: true });
    }
  }

  // ================= /report =================
  if (interaction.commandName === "report") {
    if (!OWNER_IDS.includes(interaction.user.id)) {
      return interaction.reply({ content: "❌ Non autorizzato", ephemeral: true });
    }

    const guild = interaction.guild;
    await guild.members.fetch();

    const db = loadDB();

    const members = guild.members.cache.filter(member =>
      hasAllowedRole(member)
    );

    let msg = "📊 REPORT SETTIMANALE\n\n";

    for (const member of members.values()) {
      const minutes = db[member.id] ?? 0;
      msg += `👤 ${member.user.username} — ${minutes}m\n`;
    }

    return interaction.reply({ content: msg, ephemeral: true });
  }

  // ================= /resetreport =================
  if (interaction.commandName === "resetreport") {
    if (!OWNER_IDS.includes(interaction.user.id)) {
      return interaction.reply({ content: "❌ Non autorizzato", ephemeral: true });
    }

    const guild = interaction.guild;
    await guild.members.fetch();

    const db = loadDB();

    const members = guild.members.cache.filter(member =>
      hasAllowedRole(member)
    );

    let msg = "📊 REPORT FINALE (RESET)\n\n";

    for (const member of members.values()) {
      const minutes = db[member.id] ?? 0;
      msg += `👤 ${member.user.username} — ${minutes}m\n`;
    }

    const channel = await guild.channels.fetch(REPORT_CHANNEL_ID).catch(() => null);
    if (channel) await channel.send(msg);

    saveDB({});

    return interaction.reply({
      content: "🧹 Reset completato",
      ephemeral: true
    });
  }

  // ================= /promote =================
  if (interaction.commandName === "promote") {
    return changeRosterLevel(interaction, 1);
  }

  // ================= /downgrade =================
  if (interaction.commandName === "downgrade") {
    return changeRosterLevel(interaction, -1);
  }
});

client.login(TOKEN);
