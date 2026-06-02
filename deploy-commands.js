require("dotenv").config();

const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [

  new SlashCommandBuilder()
    .setName("dm")
    .setDescription("Invia un DM (solo owner)")
    .addUserOption(o =>
      o.setName("utente").setDescription("Target").setRequired(true))
    .addStringOption(o =>
      o.setName("messaggio").setDescription("Testo").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("activity")
    .setDescription("Mostra attività settimanale"),

  new SlashCommandBuilder()
    .setName("report")
    .setDescription("Visualizza il report attività"),

  new SlashCommandBuilder()
    .setName("resetreport")
    .setDescription("Resetta tutte le attività")
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