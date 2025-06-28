// == Настройка окружения ==
require('dotenv').config();
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('✅ Бот работает'));
app.listen(3000, () => console.log('🌐 Express сервер запущен на порту 3000'));

// == Импорты ==
const {
  Client, GatewayIntentBits, Partials,
  EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChannelType, PermissionsBitField, InteractionType,
  StringSelectMenuBuilder
} = require('discord.js');

const dayjs = require('dayjs');
const relativeTime = require('dayjs/plugin/relativeTime');
dayjs.extend(relativeTime);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

// == Константы ==
const CATEGORY_ID = '1200037290538451095';
const CHANNEL_ACCEPT_ID = '1386830144789942272';
const CHANNEL_DECLINE_ID = '1386830559136714825';
const CHANNEL_LOG_ID = '1304923881294925876';
const INVITE_CHANNEL_ID = '1387148896320487564';
const ALLOWED_ROLES = ['1203016198850355231', '1203021666800902184', '1200040982746517595', '1200045928460058768' ]; // PR и High PR
const voiceChannelIdsForCall = ['1203029383871463444', '1386828355499851806', '1327303833491345419'];

function hasAllowedRole(member) {
  return member.roles.cache.some(role => ALLOWED_ROLES.includes(role.id));
}

function createStatusNotificationEmbed(status, applicationName, channelName = '', guildId, applicationLink = '') {
  let color, title = '', description = '';
  const timeAgo = dayjs().fromNow();

  switch (status.toLowerCase()) {
    case 'рассмотрение':
      color = 0xf1c40f;
      title = 'Рассмотрение заявки';
      description = `Ваша заявка в **${applicationName}** взята на рассмотрение!`;
      break;
    case 'обзвон':
      color = 0x3498db;
      title = 'Приглашение на обзвон';
      description = `Вы были вызваны на обзвон!`;
      break;
    case 'принято':
      color = 0x2ecc71;
      title = 'Заявка принята';
      description = `Ваша заявка в **${applicationName}** успешно принята!`;
      break;
    case 'отклонено':
      color = 0xe74c3c;
      title = 'Заявка отклонена';
      description = `К сожалению, ваша заявка в **${applicationName}** была отклонена.`;
      break;
    default:
      color = 0x2f3136;
      title = 'Статус заявки обновлён';
      description = `Статус заявки **${applicationName}** изменён.`;
  }

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

client.once('ready', async () => {
  console.log(`✅ Бот запущен как ${client.user.tag}`);

  const inviteChannel = await client.channels.fetch(INVITE_CHANNEL_ID);
  if (!inviteChannel || !inviteChannel.isTextBased()) return;

  const messages = await inviteChannel.messages.fetch({ limit: 10 });
  const botMessage = messages.find((m) => m.author.id === client.user.id);
  if (botMessage) await botMessage.delete().catch(() => {});

  const embed = new EmbedBuilder()
    .setTitle('📋 Заполните форму')
    .setDescription(
      'Нажмите на кнопку ниже, чтобы оставить заявку.\n\n' +
      '**Как это работает?**\n' +
      '1. Нажмите на кнопку **Оставить заявку**.\n' +
      '2. Заполните все поля формы.\n' +
      '3. Отправьте форму, и мы рассмотрим вашу заявку в ближайшее время.'
    )
    .setImage('https://media.discordapp.net/attachments/1300952767078203493/1388174214187581582/ezgif-61741d6e62f365.gif')
    .setColor(0x2f3136);

  const button = new ButtonBuilder()
    .setCustomId('open_modal')
    .setLabel('Оставить заявку')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(button);
  await inviteChannel.send({ embeds: [embed], components: [row] });
});

client.on('interactionCreate', async interaction => {
  if (interaction.isButton() && interaction.customId === 'open_modal') {
    const modal = new ModalBuilder().setCustomId('application_modal').setTitle('📝 Заявка в семью');
    const fields = [
      { id: 'nickname_stat', label: 'Никнейм | статик', style: TextInputStyle.Short, placeholder: 'Sky Garcia | 100000' },
      { id: 'irl_name_age', label: 'IRL Имя | возраст', style: TextInputStyle.Short, placeholder: 'Тима | 20' },
      { id: 'family_history', label: 'В каких семьях состояли ранее', style: TextInputStyle.Paragraph, placeholder: 'Укажите, если были в других семьях' },
      { id: 'servers', label: 'На каких серверах вкачаны персонажи?', style: TextInputStyle.Short, placeholder: '06, 11, 15' },
      { id: 'recoil_links', label: 'Откаты стрельбы (YouTube / Rutube)', style: TextInputStyle.Paragraph, placeholder: 'https://youtube.com..' }
    ];
    modal.addComponents(...fields.map(f => new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId(f.id).setLabel(f.label).setStyle(f.style).setPlaceholder(f.placeholder).setRequired(true)
    )));
    return interaction.showModal(modal);
  }

  if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'application_modal') {
    await interaction.deferReply({ ephemeral: true });
    const user = interaction.user;
    const guild = interaction.guild;
    const values = {
      nickname: interaction.fields.getTextInputValue('nickname_stat'),
      irl: interaction.fields.getTextInputValue('irl_name_age'),
      history: interaction.fields.getTextInputValue('family_history'),
      servers: interaction.fields.getTextInputValue('servers'),
      recoil: interaction.fields.getTextInputValue('recoil_links')
    };
    const overwrites = [
      { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
      ...ALLOWED_ROLES.map(id => ({ id, allow: [PermissionsBitField.Flags.ViewChannel] }))
    ];
    const channel = await guild.channels.create({
      name: `заявка-${user.username}`.toLowerCase().replace(/[^a-z0-9а-яё\-]/gi, '-'),
      type: ChannelType.GuildText,
      parent: CATEGORY_ID,
      permissionOverwrites: overwrites
    });

    const embed = new EmbedBuilder()
      .setTitle('📨 Заявка')
      .addFields(
        { name: 'Никнейм и статик', value: values.nickname },
        { name: 'IRL имя и возраст', value: values.irl },
        { name: 'Семьи ранее', value: values.history },
        { name: 'Сервера', value: values.servers },
        { name: 'Откаты стрельбы', value: values.recoil },
        { name: 'Пользователь', value: `<@${user.id}>` }
      )
      .setFooter({ text: `ID: ${user.id}` })
      .setColor(0x2f3136)
      .setTimestamp();

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`accept_app:${user.id}`).setLabel('Принять').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`review_app:${user.id}`).setLabel('Рассмотреть').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`call_app:${user.id}`).setLabel('Обзвон').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`decline_app:${user.id}`).setLabel('Отклонить').setStyle(ButtonStyle.Danger)
    );

    const rolesToMention = ['1203016198850355200', '1203021666800902100'];

    await channel.send({
      content: rolesToMention.map(id => `<@&${id}>`).join(' '),
      embeds: [embed],
      components: [buttons]
    });

    await interaction.editReply({ content: `✅ Ваша заявка отправлена: ${channel}` });
  }
});

  // Обработка кнопок
  client.on('interactionCreate', async interaction => {
  if (interaction.isButton()) {
    const [action, userId] = interaction.customId.split(':');
    if (!['accept_app', 'decline_app', 'review_app', 'call_app'].includes(action)) return;

    const guild = interaction.guild;
    const logChannel = guild.channels.cache.get(CHANNEL_LOG_ID);
    const acceptChannel = guild.channels.cache.get(CHANNEL_ACCEPT_ID);
    const declineChannel = guild.channels.cache.get(CHANNEL_DECLINE_ID);
    const targetUser = await client.users.fetch(userId).catch(() => null);
    if (!targetUser) return interaction.reply({ content: 'Пользователь не найден.', ephemeral: true });

    const appChannel = interaction.channel;
    const member = await guild.members.fetch(interaction.user.id).catch(() => null);

    if (!member || !hasAllowedRole(member)) {
      return interaction.reply({ content: 'У вас нет прав для этого действия.', ephemeral: true });
    }

    if (action === 'accept_app') {
      await interaction.update({ content: `Заявка **принята** ${interaction.user}`, components: [] });
      await targetUser.send(`Ваша заявка была **принята**!`).catch(() => {});
      logChannel?.send(`✅ Заявка от ${targetUser.tag} принята модератором ${interaction.user.tag}`);
      acceptChannel?.send(`✅ Заявка от ${targetUser} принята модератором ${interaction.user}`);
      await appChannel.send(`✅ Заявка от ${targetUser} принята модератором ${interaction.user}`);
      return;
    }

    if (action === 'decline_app') {
      const modal = new ModalBuilder()
        .setCustomId(`decline_reason:${userId}`)
        .setTitle('Причина отклонения заявки');
      const reasonInput = new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('Причина')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Опишите причину отклонения')
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
      await interaction.showModal(modal);
      return;
    }

    if (action === 'review_app') {
      await interaction.update({ content: `Заявка **на рассмотрении**. Ответственный: ${interaction.user}`, components: [] });
      await targetUser.send(`Ваша заявка взята на рассмотрение модератором ${interaction.user.tag}`).catch(() => {});
      logChannel?.send(`⚠️ Заявка от ${targetUser.tag} взята на рассмотрение ${interaction.user.tag}`);
      await appChannel.send(`⚠️ Модератор ${interaction.user} взял заявку на рассмотрение.`);
      return;
    }

    if (action === 'call_app') {
      const voiceChannels = voiceChannelIdsForCall
        .map(id => guild.channels.cache.get(id))
        .filter(ch => ch && ch.type === ChannelType.GuildVoice);
      if (voiceChannels.length === 0) {
        return interaction.reply({ content: 'Голосовые каналы для обзвона не найдены.', ephemeral: true });
      }
      const options = voiceChannels.map(ch => ({ label: ch.name, value: ch.id }));
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`select_call_channel:${userId}`)
        .setPlaceholder('Выберите голосовой канал для обзвона')
        .addOptions(options);
      const row = new ActionRowBuilder().addComponents(selectMenu);
      await interaction.reply({ content: 'Выберите голосовой канал для обзвона:', components: [row], ephemeral: true });
      return;
    }
  }

  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('select_call_channel:')) {
    try {
      const userId = interaction.customId.split(':')[1];
      const guild = interaction.guild;
      const targetUser = await client.users.fetch(userId).catch(() => null);
      if (!targetUser) return interaction.reply({ content: 'Пользователь не найден.', ephemeral: true });

      const selectedChannelId = interaction.values[0];
      const selectedChannel = guild.channels.cache.get(selectedChannelId);
      if (!selectedChannel || selectedChannel.type !== ChannelType.GuildVoice) {
        return interaction.reply({ content: 'Выбранный голосовой канал не найден.', ephemeral: true });
      }

      const voiceLink = `https://discord.com/channels/${guild.id}/${selectedChannel.id}`;
      const now = `<t:${Math.floor(Date.now() / 1000)}:f>`;
      const logChannel = guild.channels.cache.get(CHANNEL_LOG_ID);

      logChannel?.send(
  `📞 Заявка от <@${targetUser.id}> вызвана на обзвон.\n` +
  `🔊 Канал: **${selectedChannel.name}**\n` +
  `👤 Вызвал: ${interaction.user}\n` +
  `🔗 ${voiceLink}`
);

      await interaction.update({
      content: `📞 Модератор ${interaction.user} вызвал ${targetUser} на обзвон в **${selectedChannel.name}**\n🔗 Ссылка: ${selectedChannel}`,
      components: []
    });

      const dmEmbed = new EmbedBuilder()
        .setTitle('📞 Приглашение на обзвон')
        .setDescription(
          `Вы были вызваны на обзвон!\n\n` +
          `Вас приглашают присоединиться к голосовому каналу:\n[${selectedChannel.name}](${voiceLink})\n\n` +
          `**ID Дискорд сервера:** \`${guild.id}\`\n` +
          `**Дата события:** ${now}`
        )
        .setColor(0x3498db)
        .setTimestamp();

      await targetUser.send({ embeds: [dmEmbed] }).catch(() => {});

    } catch (error) {
      console.error('Ошибка при обработке select_call_channel:', error);
      if (!interaction.replied) {
        await interaction.reply({ content: 'Произошла ошибка при обработке выбора.', ephemeral: true });
      }
    }
  }
}); // <-- закрываем client.on('interactionCreate')

client.login(process.env.TOKEN);
