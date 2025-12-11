import { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const SOURCE_CHANNEL = '1431695147426644179';
const DEST_CHANNEL = '1416917458316558356';

const pendingUpload = new Map();

// Register slash command
const commands = [
  new SlashCommandBuilder().setName('submit-media').setDescription('Open media submission panel'),
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand() && interaction.commandName === 'submit-media') {
    if (interaction.channelId !== SOURCE_CHANNEL) return interaction.reply({ content: '⚠ Use this command only in the designated channel.', ephemeral: true });

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('activity').setLabel('Activity').setEmoji('🎮').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('roleplay').setLabel('Roleplay').setEmoji('🎭').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('event').setLabel('Event').setEmoji('🎉').setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ content: '📤 Choose a category:', components: [buttons], ephemeral: true });
  }

  if (interaction.isButton() && ['activity','roleplay','event'].includes(interaction.customId)) {
    const modal = new ModalBuilder().setCustomId(`modal_${interaction.customId}`).setTitle(`${interaction.customId.toUpperCase()} Submission`);
    const rows = [];

    if (interaction.customId === 'activity') {
      rows.push(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('date').setLabel('Date').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('participants').setLabel('Participants').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('type').setLabel('Type of Activity').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('duration').setLabel('Duration').setStyle(TextInputStyle.Short).setRequired(true))
      );
    }

    if (interaction.customId === 'roleplay') {
      rows.push(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel('Roleplay Title').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('date').setLabel('Date').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('participants').setLabel('Participants').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('desc').setLabel('Description').setStyle(TextInputStyle.Paragraph).setRequired(true))
      );
    }

    if (interaction.customId === 'event') {
      rows.push(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('eventType').setLabel('Event Type').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('date').setLabel('Date').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('prize').setLabel('Prize').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('winner').setLabel('Winner').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('hoster').setLabel('Hoster (LWS)').setStyle(TextInputStyle.Short).setRequired(true))
      );
    }

    modal.addComponents(...rows);
    await interaction.showModal(modal);
  }

  if (interaction.isModalSubmit()) {
    const cat = interaction.customId.replace('modal_','');
    pendingUpload.set(interaction.user.id,{category: cat, data: interaction.fields.fields, ready:false});

    const uploadButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ready_upload').setLabel('Yes, I\'m ready to upload').setEmoji('📸').setStyle(ButtonStyle.Primary)
    );

    await interaction.reply({ content: 'Hey, are you ready to upload your screenshots?', components: [uploadButton], ephemeral: true });
  }

  if (interaction.isButton() && interaction.customId === 'ready_upload') {
    const userData = pendingUpload.get(interaction.user.id);
    if(!userData) return;
    userData.ready = true;
    pendingUpload.set(interaction.user.id,userData);

    await interaction.update({ content: '✅ Great! Please upload your screenshots below.', components: [], ephemeral: true });
  }
});

client.on('messageCreate', async message => {
  if(message.author.bot) return;

  const userData = pendingUpload.get(message.author.id);
  if(!userData || !userData.ready) return;

  if(message.attachments.size > 0){
    pendingUpload.delete(message.author.id);
    await message.react('✅');

    const destChannel = await client.channels.fetch(DEST_CHANNEL);

    const embed = new EmbedBuilder()
      .setTitle(`New ${userData.category.toUpperCase()} Submission`)
      .setAuthor({name: message.author.tag, iconURL: message.author.displayAvatarURL()})
      .setColor('Blue')
      .setTimestamp();

    userData.data.forEach((input,key)=>{
      embed.addFields({name:key.toUpperCase(), value:input.value});
    });

    await destChannel.send({embeds:[embed], files:[...message.attachments.values()]});
  }
});

client.login(process.env.TOKEN);
