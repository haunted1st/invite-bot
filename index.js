require('dotenv').config();

const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('✅ Бот работает'));
app.listen(3000, () => console.log('🌐 Express сервер запущен на порту 3000'));

const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionsBitField,
  InteractionType,
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
  ],
  partials: [Partials.Channel],
});

const CATEGORY_ID = '1200037290538451095';
const ROLES_ACCESS_IDS = [
  '1203016198850355231', // роль для High PR
  '1203021666800902184',  // роль для PR
];
const CHANNEL_ACCEPT_ID = '1386830144789942272'; // Канал для принятия заявок
const CHANNEL_DECLINE_ID = '1386830559136714825'; // Канал для отклонения заявок
const CHANNEL_LOG_ID = '1304923881294925876'; // Канал логов
const INVITE_CHANNEL_ID = '1387148896320487564'; // Канал приглашений
const VOICE_CATEGORY_ID = '1203018614253555812'; // ID категории для голосовых каналов

// Функция создания уведомления о статусе заявки
function createStatusNotificationEmbed(status, applicationName, channelName = '', guildId, applicationLink = '') {
  let color;
  let title = '';
  let description = '';

  const timeAgo = dayjs().fromNow();

  switch (status.toLowerCase()) {
    case 'рассмотрение':
      color = 0xf1c40f; // жёлтый
      title = 'Рассмотрение заявки';
      description = `Ваша заявка в **${applicationName}** взята на рассмотрение!`;
      break;
    case 'обзвон':
      color = 0x3498db; // синий
      title = 'Приглашение на обзвон';
      description = `Вы были вызваны на обзвон!`;
      break;
    case 'принято':
      color = 0x2ecc71; // зелёный
      title = 'Заявка принята';
      description = `Ваша заявка в **${applicationName}** успешно принята!`;
      break;
    case 'отклонено':
      color = 0xe74c3c; // красный
      title = 'Заявка отклонена';
      description = `К сожалению, ваша заявка в **${applicationName}** была отклонена.`;
      break;
    default:
      color = 0x2f3136; // серый
      title = 'Статус заявки обновлён';
      description = `Статус заявки **${applicationName}** изменён.`;
  }

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

// Этот блок выполняется, когда бот готов к работе
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

// Обработка всех взаимодействий с кнопками
client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton() && interaction.customId === 'open_modal') {
    const modal = new ModalBuilder().setCustomId('application_modal').setTitle('📝 Заявка в семью');
    const fields = [
      { id: 'nickname_stat', label: 'Никнейм | статик', style: TextInputStyle.Short, placeholder: 'Sky Garcia | 100000' },
      { id: 'irl_name_age', label: 'IRL Имя | возраст', style: TextInputStyle.Short, placeholder: 'Тима | 20' },
      { id: 'family_history', label: 'В каких семьях состояли ранее?', style: TextInputStyle.Paragraph, placeholder: 'Укажите, если были в других семьях' },
      { id: 'servers', label: 'На каких серверах вкачаны персонажи?', style: TextInputStyle.Short, placeholder: '06, 11, 15' },
      { id: 'recoil_links', label: 'Откаты стрельбы (YouTube / Rutube)', style: TextInputStyle.Paragraph, placeholder: 'https://youtube.com/...' }
    ];
    modal.addComponents(
      ...fields.map(f =>
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId(f.id)
            .setLabel(f.label)
            .setStyle(f.style)
            .setPlaceholder(f.placeholder)
            .setRequired(true)
        )
      )
    );
    return interaction.showModal(modal);
  }

  if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'application_modal') {
    try {
      await interaction.deferReply({ flags: 64 });

      const user = interaction.user;
      const guild = interaction.guild;
      const nicknameStat = interaction.fields.getTextInputValue('nickname_stat');
      const irl = interaction.fields.getTextInputValue('irl_name_age');
      const history = interaction.fields.getTextInputValue('family_history');
      const servers = interaction.fields.getTextInputValue('servers');
      const recoil = interaction.fields.getTextInputValue('recoil_links');

      const channelName = `заявка-${user.username}`.toLowerCase().replace(/[^a-z0-9\-а-я]/gi, '-');
      const overwrites = [
        { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
        ...ROLES_ACCESS_IDS.map(roleId => ({ id: roleId, allow: [PermissionsBitField.Flags.ViewChannel] })), 
      ];

      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: CATEGORY_ID,
        permissionOverwrites: overwrites
      });

      const embed = new EmbedBuilder()
        .setTitle('📨 Заявка')
        .addFields(
          { name: 'Никнейм и статик', value: nicknameStat },
          { name: 'IRL имя и возраст', value: irl },
          { name: 'Семьи ранее', value: history },
          { name: 'Сервера', value: servers },
          { name: 'Откаты стрельбы', value: recoil },
          { name: 'Пользователь', value: `<@${user.id}>` }
        )
        .setFooter({ text: `ID: ${user.id}` })
        .setColor(0xf1c40f)
        .setTimestamp();

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`accept_app:${user.id}`).setLabel('Принять').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`review_app:${user.id}`).setLabel('Рассмотрение').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`call_app:${user.id}`).setLabel('Обзвон').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`decline_app:${user.id}`).setLabel('Отклонить').setStyle(ButtonStyle.Danger)
    );

    console.log('Отправляем кнопки в канал заявки:', channelName); // Логируем название канала

    await channel.send({
     content: ROLES_ACCESS_IDS.map(id => `<@&${id}>`).join(' '),
     embeds: [embed],
     components: [buttons]
    });
      await interaction.editReply({ content: `✅ Ваша заявка отправлена: ${channel}`, flags: 64 });
    } catch (err) {
      console.error('Modal error:', err);
      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({ content: '❌ Ошибка при отправке.', flags: 64 }).catch(() => {});
      } else {
        await interaction.editReply({ content: '❌ Ошибка при отправке.' }).catch(() => {});
      }
    }
  }

  // Обработка кнопки "Рассмотрение"
  if (interaction.isButton() && interaction.customId.startsWith('review_app:')) {
    const targetUserId = interaction.customId.split(':')[1];
    const guild = interaction.guild;
    const member = await guild.members.fetch(targetUserId).catch(() => null);
    if (!member) return interaction.reply({ content: 'Пользователь не найден', flags: 64 });

    const moderator = interaction.user;

    // Логирование в канал логов
    const logChannel = await client.channels.fetch(CHANNEL_LOG_ID);
    await logChannel.send(`${moderator} взял заявку пользователя <@${targetUserId}> на рассмотрение.`);

    // Отправка уведомления в канал с упоминанием
    await interaction.reply({
      content: `Заявка пользователя <@${targetUserId}> взята на рассмотрение модератором ${moderator}`,
      flags: 64,
    });

    // Отправка личного сообщения пользователю с упоминанием модератора
    await member.send({
      content: `Здравствуйте, ваша заявка находится на рассмотрении у модератора ${moderator}.`
    }).catch(() => {
      // Если не удается отправить личное сообщение
      interaction.followUp({ content: '❌ Не удалось отправить личное сообщение пользователю.' });
    });
  }

  client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const { customId } = interaction;
  console.log('Получено взаимодействие с кнопкой:', customId);

  // Обработка открытия модала
  if (customId === 'open_modal') {
    // Код для открытия модала
  }

  // Обработка модальных окон
  if (interaction.type === InteractionType.ModalSubmit && customId === 'application_modal') {
    // Код для обработки модального окна
  }

  // Обработка кнопки "Обзвон"
  if (customId.startsWith('call_app:')) {
    const targetUserId = customId.split(':')[1];
    console.log('Обрабатываем обзвон для пользователя с ID:', targetUserId);

    const guild = interaction.guild;
    const member = await guild.members.fetch(targetUserId).catch(() => null);
    if (!member) return interaction.reply({ content: 'Пользователь не найден', flags: 64 });

    console.log('Пользователь найден:', member.user.tag);

    const moderator = interaction.user;
    const voiceCategory = await guild.channels.fetch(VOICE_CATEGORY_ID);

    if (!voiceCategory) {
      console.log('Категория для голосовых каналов не найдена!');
      return interaction.reply({ content: 'Категория для голосовых каналов не найдена.', flags: 64 });
    }

    const voiceChannels = voiceCategory.children;
    console.log('Найдено голосовых каналов:', voiceChannels.size);

    const selectedChannels = [
      '1203029383871463444',
      '1327303833491345419',
      '1386828355499851806'
    ];

    const availableChannels = selectedChannels
      .map(id => voiceChannels.find(channel => channel.id === id))  // Используем find для поиска по ID
      .filter(channel => channel !== undefined);  // Фильтруем undefined значения

    if (availableChannels.length === 0) {
      console.log('Не удалось найти доступные выбранные голосовые каналы.');
      return interaction.reply({ content: 'Не удалось найти доступные выбранные голосовые каналы.', flags: 64 });
    }

    const randomChannel = availableChannels[Math.floor(Math.random() * availableChannels.length)];
    console.log('Выбран канал для обзвона:', randomChannel.name);

    await interaction.reply({
      content: `${member} был вызван на обзвон модератором ${moderator} в канал ${randomChannel.name}.`,
      flags: 64,
    });

    try {
      await member.send({
        content: `Вы были вызваны на обзвон модератором ${moderator} в канал ${randomChannel.name}. Перейдите по [ссылке](${randomChannel.url}) для подключения.`
      });
    } catch (error) {
      console.log('Ошибка при отправке личного сообщения:', error);
    }
  }

  // Обработка других кнопок (принять, отклонить и т.д.)
  if (customId.startsWith('accept_app:')) {
    // Обработка кнопки "Принять"
  }

  if (customId.startsWith('decline_app:')) {
    // Обработка кнопки "Отклонить"
  }
});

  // Обработка кнопки "Принять"
  if (interaction.isButton() && interaction.customId.startsWith('accept_app:')) {
    const targetUserId = interaction.customId.split(':')[1];
    const guild = interaction.guild;
    const member = await guild.members.fetch(targetUserId).catch(() => null);
    if (!member) return interaction.reply({ content: 'Пользователь не найден', flags: 64 });

    const applicationName = 'G A R C I A';
    const guildId = guild.id;

    const embed = createStatusNotificationEmbed('принято', applicationName, '', guildId);

    await member.send({ embeds: [embed] }).catch(() => {});

    // Логирование в invite-logs
    const logChannel = await client.channels.fetch(CHANNEL_LOG_ID);
    await logChannel.send(`${interaction.user} принял заявку пользователя <@${targetUserId}>`);

    // Логирование в канал принятия
    const acceptChannel = await client.channels.fetch(CHANNEL_ACCEPT_ID);
    await acceptChannel.send(`Заявка от пользователя <@${targetUserId}> принята!`);

    await interaction.reply({ content: '✅ Уведомление о принятии отправлено.', flags: 64 });
  }

  // Обработка кнопки "Отклонить"
  if (interaction.isButton() && interaction.customId.startsWith('decline_app:')) {
    const targetUserId = interaction.customId.split(':')[1];
    const guild = interaction.guild;
    const member = await guild.members.fetch(targetUserId).catch(() => null);
    if (!member) return interaction.reply({ content: 'Пользователь не найден', flags: 64 });

    const applicationName = 'G A R C I A';
    const guildId = guild.id;

    const embed = createStatusNotificationEmbed('отклонено', applicationName, '', guildId);

    await member.send({ embeds: [embed] }).catch(() => {});

    // Логирование в invite-logs
    const logChannel = await client.channels.fetch(CHANNEL_LOG_ID);
    await logChannel.send(`${interaction.user} отклонил заявку пользователя <@${targetUserId}>`);

    // Логирование в канал отклонений
    const declineChannel = await client.channels.fetch(CHANNEL_DECLINE_ID);
    await declineChannel.send(`Заявка от пользователя <@${targetUserId}> отклонена!`);

    await interaction.reply({ content: '❌ Заявка отклонена.', flags: 64 });
  }
});

client.login(process.env.TOKEN);
