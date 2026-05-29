require("dotenv").config();

const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [

  // ================= /dm =================
  new SlashCommandBuilder()
    .setName("dm")
    .setDescription("Invia un DM a un utente (solo owner)")
    .addUserOption(option =>
      option.setName("utente")
        .setDescription("Utente target")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("messaggio")
        .setDescription("Testo messaggio")
        .setRequired(true)
    ),

  // ================= /activity =================
  new SlashCommandBuilder()
    .setName("activity")
    .setDescription("Mostra la tua attività settimanale"),

  // ================= /report =================
  new SlashCommandBuilder()
    .setName("report")
    .setDescription("Invia report settimanale manuale (solo owner)")
];

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log("🔄 Registrazione comandi...");

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands.map(c => c.toJSON()) }
    );

    console.log("✅ Comandi aggiornati!");
  } catch (err) {
    console.error(err);
  }
})();