require("dotenv").config();

const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [

  new SlashCommandBuilder()
    .setName("dm")
    .setDescription("Invia un DM a un utente")
    .addUserOption(o =>
      o.setName("utente").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("messaggio").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("activity")
    .setDescription("Mostra attività settimanale")
];

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
    { body: commands.map(c => c.toJSON()) }
  );

  console.log("✅ Comandi aggiornati");
})();