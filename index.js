const fs = require("fs");
const path = require("path");
require("colors");
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageEmbed,
} = require("discord.js");
const wait = require("node:timers/promises").setTimeout;
const { AutoCatcher } = require("./autocatcher/index");
const { startt, stopp, market, checkStatus } = require("./autocatcher/market");
const config = require("./config");
const { log } = require("./utils/utils");
const { statMsg, autocatchers, start, stop, addToken, removeToken } = require("./functions/functions");
const { transfer } = require("./functions/markett");
const { showMarketPanel, handleAccountSelection, handleServerSelection, handleMarketPurchase } = require("./market/marketPanel");
const { solveCaptcha, checkApiKeyBalance, sendCaptchaMessage } = require("./utils/captchaSolver");
const { compileFunction } = require("vm");
const { chunk } = require("./utils/utils");

const poketwo = "716390085896962058";
let owners = config.owners;
let prefix = config.prefix;
let mainIDInstance = null;
let tokens = []; // Define tokens array
const tokenFilePath = path.join(__dirname, "data", "tokens.txt");

try {
  if (process.env.TOKENS) {
    // Load tokens from environment variable (comma or newline separated)
    tokens = process.env.TOKENS.split(/[\n,]+/).map(t => t.trim()).filter(t => t !== "");
    console.log(`✅ Loaded ${tokens.length} tokens from environment variable`);
  } else {
    // Fallback to file
    const fileContent = fs.readFileSync(tokenFilePath, "utf-8");
    tokens = fileContent.split(/\r?\n/).filter(line => line.trim() !== "");
    console.log(`✅ Loaded ${tokens.length} tokens from data/tokens`);
  }
} catch (err) {
  console.error("❌ Failed to load tokens:", err);
}
const PAGE_SIZE = 5; // Define PAGE_SIZE constant
const p2Filter = (p2Msg) => p2Msg.author.id === poketwo;

const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

bot.on("ready", () => {
  log(`Connected as ${bot.user.tag}`.cyan);
});

bot.on("interactionCreate", async (interaction) => {
  if (!owners.includes(interaction.user.id)) {
    if (interaction.isButton() || interaction.isModalSubmit()) {
      await interaction.reply({ content: "You are not authorised to use this!", flags: 64 });
      return;
    }
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId.startsWith("market_account_select")) {
      await handleAccountSelection(interaction, autocatchers);
    } else if (interaction.customId.startsWith("market_server_select")) {
      await handleServerSelection(interaction);
    }
  } else if (interaction.isButton()) {
    if (interaction.customId.startsWith("previous") || interaction.customId.startsWith("next")) {
      await handleTokenPageNavigation(interaction);
    } else if (interaction.customId.startsWith("statPage")) {
      await handlePageNavigation(interaction);
    } else if (interaction.customId === "add_token_modal") {
      await showAddTokenModal(interaction);
    } else if (interaction.customId === "remove_token_modal") {
      await showRemoveTokenModal(interaction);
    } else if (interaction.customId.startsWith("pdata_nav_")) {
      // Handle pokemon pagination navigation
      const parts = interaction.customId.split("_");
      const category = parts[2];
      const currentPage = parseInt(parts[3]);
      const direction = parts[4];

      let newPage = currentPage;
      if (direction === "next") newPage++;
      if (direction === "prev") newPage--;

      // Recreate the pokemon list for this category
      let allPokemon = [];
      let categoryName = "";
      let emoji = "";

      for (const ac of autocatchers) {
        let categoryPokemon = [];
        switch (category) {
          case "legendary":
            categoryPokemon = ac.pokemonData.legendary;
            categoryName = "Legendary Pokémon";
            emoji = "🔴";
            break;
          case "shiny":
            categoryPokemon = ac.pokemonData.shiny;
            categoryName = "Shiny Pokémon";
            emoji = "✨";
            break;
          case "mythical":
            categoryPokemon = ac.pokemonData.mythical;
            categoryName = "Mythical Pokémon";
            emoji = "🟣";
            break;
          case "ultrabeast":
            categoryPokemon = ac.pokemonData.ultraBeast;
            categoryName = "Ultra Beast Pokémon";
            emoji = "🟠";
            break;
          case "rareiv":
            categoryPokemon = ac.pokemonData.rareIV;
            categoryName = "Rare IV Pokémon";
            emoji = "📊";
            break;
          case "event":
            categoryPokemon = ac.pokemonData.event;
            categoryName = "Event Pokémon";
            emoji = "🎉";
            break;
          case "regional":
            categoryPokemon = ac.pokemonData.regional;
            categoryName = "Regional Pokémon";
            emoji = "🌍";
            break;
          case "all":
            categoryPokemon = ac.pokemonData.all;
            categoryName = "All Pokémon";
            emoji = "📋";
            break;
        }

        categoryPokemon.forEach(pokemon => {
          allPokemon.push({
            ...pokemon,
            user: ac.client.user.username
          });
        });
      }

      allPokemon.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      const itemsPerPage = 10;
      const pages = chunk(allPokemon, itemsPerPage);

      const embed = new EmbedBuilder()
        .setTitle(`${emoji} ${categoryName}`)
        .setColor("#3498db")
        .setDescription(
          pages[newPage].map((pokemon, index) => {
            const ivColor = pokemon.iv > 90 ? "🟢" : pokemon.iv < 10 ? "🔴" : "🟡";
            const shinyIcon = pokemon.shiny ? "✨" : "";
            return `**${newPage * itemsPerPage + index + 1}.** ${shinyIcon}${pokemon.name} ${ivColor}\n` +
              `   • **IV:** ${pokemon.iv.toFixed(2)}% • **Lvl:** ${pokemon.level} • **User:** ${pokemon.user}`;
          }).join("\n")
        )
        .setFooter({
          text: `Page ${newPage + 1} of ${pages.length} | Total: ${allPokemon.length} Pokémon`
        });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`pdata_nav_${category}_${newPage}_prev`)
          .setLabel("◀ Previous")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(newPage === 0),
        new ButtonBuilder()
          .setCustomId(`pdata_nav_${category}_${newPage}_next`)
          .setLabel("Next ▶")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(newPage >= pages.length - 1),
        new ButtonBuilder()
          .setCustomId("pdata_back")
          .setLabel("🔙 Back to Categories")
          .setStyle(ButtonStyle.Primary)
      );

      await interaction.update({ embeds: [embed], components: [row] });
    } else if (interaction.customId.startsWith("pdata_")) {
      const category = interaction.customId.replace("pdata_", "");

      // Collect all pokemon from all autocatchers for the specified category
      let allPokemon = [];
      let categoryName = "";
      let emoji = "";

      for (const ac of autocatchers) {
        let categoryPokemon = [];
        switch (category) {
          case "legendary":
            categoryPokemon = ac.pokemonData.legendary;
            categoryName = "Legendary Pokémon";
            emoji = "🔴";
            break;
          case "shiny":
            categoryPokemon = ac.pokemonData.shiny;
            categoryName = "Shiny Pokémon";
            emoji = "✨";
            break;
          case "mythical":
            categoryPokemon = ac.pokemonData.mythical;
            categoryName = "Mythical Pokémon";
            emoji = "🟣";
            break;
          case "ultrabeast":
            categoryPokemon = ac.pokemonData.ultraBeast;
            categoryName = "Ultra Beast Pokémon";
            emoji = "🟠";
            break;
          case "rareiv":
            categoryPokemon = ac.pokemonData.rareIV;
            categoryName = "Rare IV Pokémon";
            emoji = "📊";
            break;
          case "event":
            categoryPokemon = ac.pokemonData.event;
            categoryName = "Event Pokémon";
            emoji = "🎉";
            break;
          case "regional":
            categoryPokemon = ac.pokemonData.regional;
            categoryName = "Regional Pokémon";
            emoji = "🌍";
            break;
          case "all":
            categoryPokemon = ac.pokemonData.all;
            categoryName = "All Pokémon";
            emoji = "📋";
            break;
        }

        // Add user info to each pokemon
        categoryPokemon.forEach(pokemon => {
          allPokemon.push({
            ...pokemon,
            user: ac.client.user.username
          });
        });
      }

      if (allPokemon.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle(`${emoji} ${categoryName}`)
          .setDescription("No Pokémon found in this category yet.")
          .setColor("#95a5a6");

        await interaction.reply({ embeds: [embed], flags: 64 });
        return;
      }

      // Sort by timestamp (newest first)
      allPokemon.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Create pages of 10 pokemon each
      const itemsPerPage = 10;
      const pages = chunk(allPokemon, itemsPerPage);
      const currentPage = 0;

      const embed = new EmbedBuilder()
        .setTitle(`${emoji} ${categoryName}`)
        .setColor("#3498db")
        .setDescription(
          pages[currentPage].map((pokemon, index) => {
            const ivColor = pokemon.iv > 90 ? "🟢" : pokemon.iv < 10 ? "🔴" : "🟡";
            const shinyIcon = pokemon.shiny ? "✨" : "";
            return `**${currentPage * itemsPerPage + index + 1}.** ${shinyIcon}${pokemon.name} ${ivColor}\n` +
              `   • **IV:** ${pokemon.iv.toFixed(2)}% • **Lvl:** ${pokemon.level} • **User:** ${pokemon.user}`;
          }).join("\n")
        )
        .setFooter({
          text: `Page ${currentPage + 1} of ${pages.length} | Total: ${allPokemon.length} Pokémon`
        });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`pdata_nav_${category}_${currentPage}_prev`)
          .setLabel("◀ Previous")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage === 0),
        new ButtonBuilder()
          .setCustomId(`pdata_nav_${category}_${currentPage}_next`)
          .setLabel("Next ▶")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage >= pages.length - 1),
        new ButtonBuilder()
          .setCustomId("pdata_back")
          .setLabel("🔙 Back to Categories")
          .setStyle(ButtonStyle.Primary)
      );

      await interaction.reply({ embeds: [embed], components: [row], flags: 64 });
    } else if (interaction.customId === "pdata_back") {
      const embed = new EmbedBuilder()
        .setTitle("🗃️ Pokémon Data Categories")
        .setDescription("Select a category to view caught Pokémon:")
        .setColor("#3498db")
        .setFooter({
          text: "Powered by Your Hoopa",
        });

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("pdata_legendary")
          .setLabel("Legendary")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("pdata_shiny")
          .setLabel("Shiny")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("pdata_mythical")
          .setLabel("Mythical")
          .setStyle(ButtonStyle.Secondary)
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("pdata_ultrabeast")
          .setLabel("Ultra Beast")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("pdata_rareiv")
          .setLabel("Rare IV")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("pdata_event")
          .setLabel("Event")
          .setStyle(ButtonStyle.Secondary)
      );

      const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("pdata_all")
          .setLabel("All Pokemon")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("pdata_regional")
          .setLabel("Regional")
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.update({ embeds: [embed], components: [row1, row2, row3] });
    } else if (interaction.customId === "refresh_stats") {
      await statMsg(interaction, 0);
    }
  } else if (interaction.isModalSubmit()) {
    if (interaction.customId === "addTokenModal") {
      await handleAddTokenModal(interaction);
    } else if (interaction.customId === "removeTokenModal") {
      await handleRemoveTokenModal(interaction);
    } else if (interaction.customId.startsWith("market_buy_modal")) {
      await handleMarketPurchase(interaction, autocatchers);
    }
  }
});


function generateTokenEmbed(currentPage, autocatchers) {
  const start = currentPage * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const tokensToShow = autocatchers.slice(start, end);

  const embed = new EmbedBuilder()
    .setTitle(`Token List - Page ${currentPage + 1}`)
    .setColor("#90EE90")
    .setTimestamp();

  if (tokensToShow.length === 0) {
    embed.setDescription("No tokens available.");
  } else {
    tokensToShow.forEach((ac, index) => {
      const user = ac.client.user;
      const username = user ? user.tag : "Unknown User"; // Ensure username is fetched correctly
      embed.addFields({
        name: `Token ${start + index + 1}`,
        value: `**Username**: **${username}**\n**Token**: \`\`\`${ac.token || "No token provided"}\`\`\``, // Ensure token is handled correctly
        inline: false,
      });
    });
  }

  return embed;
}
function generatePaginationButtons(currentPage, autocatchers) {
  return [
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`previous_${currentPage}`)
          .setLabel('Previous')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(currentPage === 0),
        new ButtonBuilder()
          .setCustomId(`next_${currentPage}`)
          .setLabel('Next')
          .setStyle(ButtonStyle.Primary)
          .setDisabled((currentPage + 1) * PAGE_SIZE >= autocatchers.length)
      )
  ];
}

async function handleTokenPageNavigation(interaction) {
  const args = interaction.customId.split("_");
  let currentPage = parseInt(args[1]);

  if (interaction.customId.startsWith("previous")) {
    if (currentPage > 0) currentPage--;
  } else if (interaction.customId.startsWith("next")) {
    if ((currentPage + 1) * PAGE_SIZE < autocatchers.length) currentPage++;
  } else {
    return;
  }

  // Generate the updated embed
  const embed = generateTokenEmbed(currentPage, autocatchers);

  // Update the existing message with the new embed and buttons
  await interaction.update({
    embeds: [embed],
    components: generatePaginationButtons(currentPage, autocatchers),
  });

  // Clear buttons after 1 minute
  setTimeout(async () => {
    try {
      const fetchedMessage = await interaction.message.fetch();
      await fetchedMessage.edit({ components: [] }); // Clear buttons
    } catch (error) {
      console.error("Error clearing buttons:", error);
    }
  }, 60000);
}

async function handlePageNavigation(interaction) {
  const args = interaction.customId.split("-");
  const currentPage = parseInt(args[2]);
  const direction = args[1] === "L" ? -1 : 1;
  const newPage = currentPage + direction;
  await statMsg(interaction, newPage);
}

async function showAddTokenModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('addTokenModal')
    .setTitle('Add Token');

  const tokenInput = new TextInputBuilder()
    .setCustomId('tokenInput')
    .setLabel("Discord Bot Token")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Enter your Discord bot token here...")
    .setRequired(true);

  const firstActionRow = new ActionRowBuilder().addComponents(tokenInput);
  modal.addComponents(firstActionRow);

  await interaction.showModal(modal);
}

async function showRemoveTokenModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('removeTokenModal')
    .setTitle('Remove Token');

  const tokenInput = new TextInputBuilder()
    .setCustomId('tokenInput')
    .setLabel("Discord Bot Token to Remove")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Enter the token you want to remove...")
    .setRequired(true);

  const firstActionRow = new ActionRowBuilder().addComponents(tokenInput);
  modal.addComponents(firstActionRow);

  await interaction.showModal(modal);
}

async function handleAddTokenModal(interaction) {
  const token = interaction.fields.getTextInputValue('tokenInput');

  await interaction.deferReply({ flags: 64 });

  addToken(token, async (res, success) => {
    await interaction.editReply({
      content: `${success ? `✅ Added token!` : `❌ Unable to add token!`}\n` +
        "```ansi\n" +
        res +
        "```"
    });

  });

}

async function handleRemoveTokenModal(interaction) {
  const token = interaction.fields.getTextInputValue('tokenInput');


  await interaction.deferReply({ flags: 64 });

  const autocatcherIndex = autocatchers.findIndex((ac) => ac.token === token);

  if (autocatcherIndex === -1) {
    await interaction.editReply({
      content: "❌ Token not found in the autocatcher list!"
    });
    return;
  }

  try {
    // Destroy the client connection
    await autocatchers[autocatcherIndex].client.destroy();

    // Remove from autocatchers array
    autocatchers.splice(autocatcherIndex, 1);

    // Remove from tokens array
    const tokenIndex = tokens.findIndex(t => t === token);
    if (tokenIndex !== -1) {
      tokens.splice(tokenIndex, 1);
    }

    await interaction.editReply({
      content: "✅ Token successfully removed from autocatcher!"
    });
  } catch (error) {
    await interaction.editReply({
      content: `❌ Error removing token: ${error.message}`
    });

  }
}

bot.login(config.botToken);

bot.on("messageCreate", async (message) => {
  if (!message.content.startsWith(prefix)) return;

  if (!owners.includes(message.author.id)) {
    await message.reply("You are not authorised to use this command!");
    return;
  }

  let [command, ...args] = message.content
    .slice(prefix.length)
    .trim()
    .split(/\s+/);
  command = command.toLowerCase();
  args = args.map((x) => x.toLowerCase());

  if (command === "ping") {
    const startTime = Date.now();
    const m = await message.reply("Pinging...");
    const ping = Date.now() - startTime;
    await m.edit(`Pinged with **${ping}ms!**`);
  } else if (command === "stats") {
    await statMsg(message, 0);
  } else if (command == `pokemon` || command == `pdata`) {
    if (autocatchers.length === 0) {
      return message.reply("No autocatchers are running!");
    }

    // Create pokemon data selection embed
    const embed = new EmbedBuilder()
      .setTitle("🗃️ Pokémon Data Categories")
      .setDescription("Select a category to view caught Pokémon:")
      .setColor("#3498db")
      .setFooter({
        text: "Powered by Your Hoopa",
      });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("pdata_legendary")
        .setLabel("Legendary")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("pdata_shiny")
        .setLabel("Shiny")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("pdata_mythical")
        .setLabel("Mythical")
        .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("pdata_ultrabeast")
        .setLabel("Ultra Beast")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("pdata_rareiv")
        .setLabel("Rare IV")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("pdata_event")
        .setLabel("Event")
        .setStyle(ButtonStyle.Secondary)
    );

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("pdata_all")
        .setLabel("All Pokemon")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("pdata_regional")
        .setLabel("Regional")
        .setStyle(ButtonStyle.Secondary)
    );

    await message.channel.send({ embeds: [embed], components: [row1, row2, row3] });
  } else if (command === "reload") {
    const MAX_FIELD_LENGTH = 1024;
    const MAX_FIELDS_PER_EMBED = 25; // Discord allows up to 25 fields per embed

    function chunkText(text, maxLength) {
      const chunks = [];
      let currentChunk = '';

      text.split('\n').forEach(line => {
        const newChunk = currentChunk + line + '\n';
        if (newChunk.length > maxLength) {
          chunks.push(currentChunk);
          currentChunk = line + '\n';
        } else {
          currentChunk = newChunk;
        }
      });

      if (currentChunk) {
        chunks.push(currentChunk);
      }

      return chunks;
    }

    function createEmbeds(fields) {
      const embeds = [];
      for (let i = 0; i < fields.length; i += MAX_FIELDS_PER_EMBED) {
        const embed = new EmbedBuilder()
          .setTitle("Currently Connected")
          .setColor("#1E90FF")
          .setTimestamp();

        fields.slice(i, i + MAX_FIELDS_PER_EMBED).forEach((field, index) => {
          embed.addFields({
            name: `Field ${i + index + 1}`,
            value: field,
          });
        });

        embeds.push(embed);
      }

      return embeds;
    }

    try {
      await stop();
      const logs = await start();

      if (!logs || logs.length === 0) {
        await message.channel.send("***Successfully reloaded 0 tokens...***");
      } else {
        await message.channel.send(
          `***Successfully reloaded ${logs.length} tokens...***`
        );

        const formattedLogs = logs
          .map((log, index) => `${index + 1}. 🔹 ${log}`)
          .join('\n');

        const logChunks = chunkText(formattedLogs, MAX_FIELD_LENGTH);
        const embeds = createEmbeds(logChunks);

        embeds.forEach(embed => {
          message.channel.send({ embeds: [embed] });
        });
      }
    } catch (error) {
      console.error("Error during reload:", error);
      await message.channel.send("❌ Failed to reload. Please check the logs.");
    }
  } else if (command === "add-token") {
    const token = message.content.split(" ")[1];
    if (!token) {
      await message.reply("***Please provide a token to add.***");
      return;
    }

    let replyMessage = await message.reply(`*Attempting to add token...*`);

    addToken(token, (res, success) => {
      replyMessage.edit(
        `${success ? `✅ Added token!` : `❌ Unable to add token!`}\n` +
        "```ansi\n" +
        res +
        "```"
      );
    });
  } else if (command == `captcha`) {
    let id = args[0];
    if (!id) {
      await message.reply(
        `Please give me an ID or mention if its global!\n\`${prefix}captcha <id/on/off>\``
      );
      return;
    }

    id = id.toLowerCase();
    if (args[0] == `on` || args[0] == `off`) {
      let start = args[0] == `on`;
      for (let i = 0; i < autocatchers.length; i++)
        autocatchers[i].captcha = start;
      await message.reply(
        `Successfully toggled **${start ? `on` : `off`
        }** in captcha status globally!`
      );
      return;
    }
    id = parseInt(id);
    if (isNaN(id)) return message.reply(`Please give me a valid ID!`);
    let ac = autocatchers.find((x) => x.client.user.id == id);
    if (!ac) return message.reply(`Unable to locate that Hoopa!`);
    if (args[1]) {
      if (args[1].toLowerCase() == `on`) ac.captcha = false;
      if (args[1].toLowerCase() == `off`) ac.captcha = true;
    }
    message.reply(
      `Captcha has been **toggled __${ac.captcha ? `OFF` : `ON`}__** for ${ac.client.user.globalName || ac.client.user.displayName || `User`
      }\n- Captcha URL: 🔗 [Link](https://verify.poketwo.net/captcha/${ac.client.user.id
      })`
    );
    ac.captcha = ac.captcha ? false : true;
  } else if (command == `catcher`) {
    let id = args[0];
    if (!id) {
      await message.reply(
        `Please give me an ID or mention if its global!\n\`${config.prefix}catcher <id/on/off>\``
      );
      return;
    }
    id = id.toLowerCase();
    if (args[0] == `start` || args[0] == `stop`) {
      let start = args[0] == `start`;
      for (let i = 0; i < autocatchers.length; i++)
        autocatchers[i].catch = start;
      await message.reply(
        `Successfully **${start ? `started` : `stopped`}** globally!`
      );
      return;
    }
    id = parseInt(id);
    if (isNaN(id)) return message.reply(`Please give me a valid ID!`);
    let ac = autocatchers.find((x) => x.client.user.id == id);
    if (!ac) return message.reply(`Unable to locate that Hoopa!`);

    if (!args[1])
      return message.reply(
        `Please give provide an option! => \`<start/stop>\``
      );
    args[1] = args[1].toLowerCase();
    if (args[1] == `start` || args[1] == `stop`) {
      let start = args[1] == `start`;
      ac.catch = start;
      await message.reply(
        `Successfully **${start ? `started` : `stopped`}** ${ac.client.user.globalName || ac.client.user.displayName || `User`
        }!`
      );
    }
  } else if (command == `ai-catch`) {
    let id = args[0];
    if (!id) {
      await message.reply(
        `Please give me an ID or mention if its global!\n\`${config.prefix}ai-catch <id/on/off>\``
      );
      return;
    }
    id = id.toLowerCase();
    if (args[0] == `start` || args[0] == `stop`) {
      let start = args[0] == `start`;
      for (let i = 0; i < autocatchers.length; i++)
        autocatchers[i].aiCatch = start;
      await message.reply(
        `Successfully **${start ? `started` : `stopped`}** AI globally!`
      );
      return;
    }
    id = parseInt(id);
    if (isNaN(id)) return message.reply(`Please give me a valid ID!`);
    let ac = autocatchers.find((x) => x.client.user.id == id);
    if (!ac) return message.reply(`Unable to locate that Hoopa!`);

    if (!args[1])
      return message.reply(
        `Please give provide an option! => \`<start/stop>\``
      );
    args[1] = args[1].toLowerCase();
    if (args[1] == `start` || args[1] == `stop`) {
      let start = args[1] == `start`;
      ac.aiCatch = start;
      await message.reply(
        `Successfully **${start ? `started` : `stopped`}** AI catching on${ac.client.user.globalName || ac.client.user.displayName || `User`
        }!`
      );
    }
  } else if (command === "set-prefix") {
    const new_prefix = message.content.split(" ")[1];
    if (!new_prefix) {
      return message.reply(`Please provide me a **new prefix** to change.`);
    }
    prefix = new_prefix;
    await message.reply(`Successfully changed prefix to ${new_prefix}`);
  } else if (command === "owner") {
    let id = args[0];
    if (!id) {
      await message.reply(
        `Please provide an ID!\n\`${prefix}owner <id> <add/remove>\``
      );
      return;
    }
    if (isNaN(id)) return message.reply(`Please provide a valid ID!`);

    const isOwner = owners.includes(id);

    if (!args[1]) {
      return message.reply(`Please provide an action! => \`<add/remove>\``);
    }

    if (args[1] === "add") {
      if (isOwner) {
        return message.reply(`ID ${id} is already an owner.`);
      }
      owners.push(id);
      await message.reply(
        `Successfully **added** <@${id}> to **Owners whitelist**`
      );
    } else if (args[1] === "remove") {
      if (!isOwner) {
        return message.reply(`ID ${id} is not in the owners list.`);
      }
      owners = owners.filter((ownerId) => ownerId !== id);
      await message.reply(`Successfully **removed** ID ${id} from owners.`);
    } else {
      await message.reply(
        `Invalid action! Please use \`<add/remove>\` as the second argument.`
      );
    }
  } else if (command === "m-start") {
    const x = message.content.split(" ");
    const token = x[1];
    const channelId = x[2];
    if (!token || !channelId) {
      await message.reply(
        "➤ Please provide both a token and a channel ID.\n" +
        "```" +
        "Format: $m-start <Token> <Channel Id>" +
        "```"
      );
      return;
    }

    await startt(token, channelId, (response) => message.reply(response));
  } else if (command === "m-stop") {
    await stopp((response) => message.reply(response));
  } else if (command == `transfer`) {
    const running = await checkStatus();
    if (!running) {
      return message.reply(`***Please start the client first***`);
    }
    await message.reply(`***Starting to transfer***`);
    await transfer(tokens, (total) => {
      message.reply(`Successfully transferred **${total} pokecoins..**`);
    });
  } else if (command === "current-tokens") {
    const currentPage = 0;
    const embed = generateTokenEmbed(currentPage, autocatchers);
    const components = generatePaginationButtons(currentPage, autocatchers);

    await message.channel.send({
      embeds: [embed],
      components: components,
    });
  } else if (command === "mpanel") {
    await showMarketPanel(message, autocatchers);
  } else if (command === "solver") {
    // Parse the command properly - split by spaces but handle token and userid separately
    const commandParts = message.content.slice(prefix.length).trim().split(/\s+/);

    if (commandParts.length < 3) {
      return message.reply("❌ Please provide both token and user ID!\nUsage: `$solver <token> <userid>`");
    }

    const token = commandParts[1]; // Get the token (2nd part)
    const userId = commandParts[2]; // Get the user ID (3rd part)

    console.log(`🔍 Solver Test Debug:`);
    console.log(`   Token: ${token}`);
    console.log(`   User ID: ${userId}`);
    console.log(`   API Key: ${config.captchaApiKey}`);
    console.log(`   Hostname: ${config.captchaApiHostname}`);

    try {
      await message.reply("🔄 Testing captcha solver...");

      // Send captcha detected message
      await sendCaptchaMessage("Test User", userId, "detected");

      const startTime = Date.now();
      const result = await solveCaptcha(config.captchaApiKey, userId, token, config.captchaApiHostname);
      const timeTaken = ((Date.now() - startTime) / 1000).toFixed(3) + "s";

      // Log the full response for debugging
      console.log(`🎯 Captcha Solver Response:`, JSON.stringify(result, null, 2));

      if (result.success) {
        await sendCaptchaMessage("Test User", userId, "solved", "Hoopa Captcha Solver", timeTaken);
        await message.reply(`✅ **Captcha solver test successful!**\nSolved in: ${timeTaken}\nResult: ${result.result}`);
      } else {
        await sendCaptchaMessage("Test User", userId, "failed", "Hoopa Captcha Solver");
        await message.reply(`❌ **Captcha solver test failed!**\nError: ${result.error || 'Unknown error'}\nFull response logged to console.`);
      }
    } catch (error) {
      console.error(`💥 Captcha solver exception:`, error);
      await sendCaptchaMessage("Test User", userId, "failed", "Hoopa Captcha Solver");
      await message.reply(`❌ **Error testing captcha solver:**\n${error.message}`);
    }
  } else if (command === "test-ai") {
    const testImageUrl = args[0];
    if (!testImageUrl) {
      return message.reply("Please provide an image URL to test AI catching!");
    }

    try {
      const { getNamee } = require("./utils/api");
      const result = await getNamee(testImageUrl);

      if (result && !result.error && result.prediction) {
        const confidence = (result.confidence * 100) || 0;
        await message.reply(`✅ AI Test Successful!\nPokemon: ${result.prediction}\nConfidence: ${confidence.toFixed(2)}%`);
      } else {
        await message.reply(`❌ AI Test Failed!\nError: ${result.error || 'No prediction returned'}\nFull response: ${JSON.stringify(result)}`);
      }
    } catch (error) {
      await message.reply(`❌ AI Test Error: ${error.message}`);
    }
  } else if (command === "balance") {
    try {
      const result = await checkApiKeyBalance(config.captchaApiKey, config.captchaApiHostname);

      if (result.success) {
        const embed = new EmbedBuilder()
          .setTitle("🔑 API Key Balance")
          .setColor("#00FF00")
          .addFields(
            { name: "Remaining Solves", value: result.remaining.toString(), inline: true },
            { name: "Key Created", value: result.created ? "Yes" : "No", inline: true },
            { name: "Key Revoked", value: result.revoked ? "Yes" : "No", inline: true }
          )
          .setFooter({ text: "Captcha Solver API" })
          .setTimestamp();

        await message.channel.send({ embeds: [embed] });
      } else {
        await message.reply(`❌ **Failed to check API balance:**\n${result.error}`);
      }
    } catch (error) {
      await message.reply(`❌ **Error checking API balance:**\n${error.message}`);
    }
  } else if (command === "help") {
    const embed = new EmbedBuilder()
      .setTitle("🎯 Pokemon AutoCatcher Commands")
      .setColor("#FFC0CB")
      .setThumbnail(bot.user.displayAvatarURL())
      .setDescription("**Trident SHUU CATCHER**")
      .addFields(
        {
          name: "⚡ **System Commands**",
          value:
            "🔸 `ping` - Check bot response time and server latency\n" +
            "🔸 `help` - Display this comprehensive command guide\n" +
            "🔸 `reload` - Restart all autocatcher instances with fresh settings\n" +
            "🔸 `set-prefix <prefix>` - Change the command prefix (default: $)",
          inline: false
        },
        {
          name: "👑 **Administration**",
          value:
            "🔸 `owner <id> <add/remove>` - Manage bot administrators\n" +
            "🔸 `add-token <token>` - Add new bot account to autocatcher\n" +
            "🔸 `current-tokens` - View all connected bot accounts with pagination",
          inline: false
        },
        {
          name: "🎣 **Catching Controls**",
          value:
            "🔸 `catcher <id/start/stop>` - Toggle autocatcher for specific bot or globally\n" +
            "🔸 `ai-catch <id/start/stop>` - Enable/disable P2 ASS identification\n" +
            "🔸 `captcha <id/on/off>` - Manage captcha solver for accounts",
          inline: false
        },
        {
          name: "📊 **Data & Analytics**",
          value:
            "🔸 `stats` - View detailed catching statistics with pagination\n" +
            "🔸 `pokemon` - Browse caught Pokemon by categories (Legendary, Shiny, etc.)",
          inline: false
        },
        {
          name: "💰 **Market Operations**",
          value:
            "🔸 `mpanel` - Open interactive market panel for buying Pokemon\n" +
            "🔸 `m-start <token> <channel>` - Initialize market trading client\n" +
            "🔸 `m-stop` - Terminate active market client\n" +
            "🔸 `transfer` - Auto-transfer Pokecoins to market account",
          inline: false
        },
        {
          name: "🔧 **Captcha Solver**",
          value:
            "🔸 `solver <token> <userid>` - Test captcha solver for specific account\n" +
            "🔸 `balance` - Check API key balance and usage",
          inline: false
        }
      )
      .setFooter({
        text: "Advanced Pokemon Data System | Use commands with care",
        iconURL: bot.user.displayAvatarURL()
      })
      .setTimestamp();

    await message.channel.send({ embeds: [embed] });
  }
});

// ─────────────── WEB SERVER FOR RENDER ───────────────
const http = require('http');
const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Bot is running!');
});

server.listen(port, () => {
  console.log(`Web server listening on port ${port}`);
});