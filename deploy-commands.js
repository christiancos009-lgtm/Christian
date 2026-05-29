require("dotenv").config();

const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [

  new SlashCommandBuilder()
    .setName("dm")
    .setDescription("Invia un DM a un utente")
    .addUserOption(option =>
      option
        .setName("utente")
        .setDescription("Utente a cui inviare il messaggio")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("messaggio")
        .setDescription("Testo del messaggio")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("activity")
    .setDescription("Mostra la tua attività settimanale")
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