require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// 🔐 OWNER IDS
const OWNER_IDS = [
  "616719017234792450",
  "1092045280305762304",
  "1283221877535412356",
  "1129400258913370112"
];

// ✅ BOT ONLINE
client.once("clientReady", () => {
  console.log(`Bot online come ${client.user.tag}`);
});

// ✅ SLASH COMMAND
client.on("interactionCreate", async (interaction) => {

  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "dm") {

    // 🔒 SOLO OWNER
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

      console.error(err);

      return interaction.reply({
        content: "❌ Impossibile inviare il DM",
        ephemeral: true
      });
    }
  }
});

// 🔑 LOGIN
client.login(process.env.TOKEN);