require("dotenv").config();

const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("dm")
    .setDescription("Invia un DM a un utente")
    
    .addUserOption(option =>
      option
        .setName("utente")
        .setDescription("Utente a cui inviare il DM")
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName("messaggio")
        .setDescription("Messaggio da inviare")
        .setRequired(true)
    )

    .toJSON()
];

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {

    console.log("🔄 Registrazione comando /dm...");

    await rest.put(
      Routes.applicationGuildCommands(
  process.env.CLIENT_ID,
  process.env.GUILD_ID
),
      { body: commands }
    );

    console.log("✅ Comando /dm registrato!");

  } catch (err) {
    console.error("❌ Errore:");
    console.error(err);
  }
})();