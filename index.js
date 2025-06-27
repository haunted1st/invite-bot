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

// Загружаем переменные из .env
const CATEGORY_ID = process.env.CATEGORY_ID;
const ROLES_ACCESS_IDS = process.env.ROLES_ACCESS_IDS.split(',');  // Разделяем роли по запятой
const CHANNEL_ACCEPT_ID = process.env.CHANNEL_ACCEPT_ID;
const CHANNEL_DECLINE_ID = process.env.CHANNEL_DECLINE_ID;
const CHANNEL_LOG_ID = process.env.CHANNEL_LOG_ID;
const INVITE_CHANNEL_ID = process.env.INVITE_CHANNEL_ID;
const VOICE_CATEGORY_ID = process.env.VOICE_CATEGORY_ID;

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
});

// Обработка всех взаимодействий с кнопками
client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()) {
    const targetUserId = interaction.customId.split(':')[1];
    const user = await interaction.guild.members.fetch(targetUserId).catch(() => null);
    const moderator = interaction.user;
    const guild = interaction.guild;

    if (!user) return interaction.reply({ content: 'Пользователь не найден', flags: 64 });

    if (interaction.customId.startsWith('accept_app:')) {
      // Обработка кнопки "Принять"
      const embed = createStatusNotificationEmbed('принято', 'G A R C I A', '', guild.id);

      await user.send({ embeds: [embed] }).catch(() => {});

      // Логирование в invite-logs
      const logChannel = await client.channels.fetch(CHANNEL_LOG_ID);
      await logChannel.send(`${moderator} принял заявку пользователя <@${targetUserId}>`);

      // Логирование в канал принятия
      const acceptChannel = await client.channels.fetch(CHANNEL_ACCEPT_ID);
      await acceptChannel.send(`Заявка от пользователя <@${targetUserId}> принята!`);

      await interaction.reply({ content: '✅ Уведомление о принятии отправлено.', flags: 64 });
    }

    if (interaction.customId.startsWith('decline_app:')) {
      // Обработка кнопки "Отклонить"
      const embed = createStatusNotificationEmbed('отклонено', 'G A R C I A', '', guild.id);

      await user.send({ embeds: [embed] }).catch(() => {});

      // Логирование в invite-logs
      const logChannel = await client.channels.fetch(CHANNEL_LOG_ID);
      await logChannel.send(`${moderator} отклонил заявку пользователя <@${targetUserId}>`);

      // Логирование в канал отклонений
      const declineChannel = await client.channels.fetch(CHANNEL_DECLINE_ID);
      await declineChannel.send(`Заявка от пользователя <@${targetUserId}> отклонена!`);

      await interaction.reply({ content: '❌ Заявка отклонена.', flags: 64 });
    }

    if (interaction.customId.startsWith('review_app:')) {
      // Обработка кнопки "Рассмотрение"
      const embed = createStatusNotificationEmbed('рассмотрение', 'G A R C I A', '', guild.id);
      await interaction.reply({ content: `Заявка взята на рассмотрение модератором ${moderator}`, flags: 64 });

      // Логирование в invite-logs
      const logChannel = await client.channels.fetch(CHANNEL_LOG_ID);
      await logChannel.send(`${moderator} взял заявку пользователя <@${targetUserId}> на рассмотрение.`);

      // Уведомление создателю заявки
      await user.send({
        content: `Ваша заявка на рассмотрении у модератора ${moderator}.`
      }).catch(() => {
        interaction.followUp({ content: '❌ Не удалось отправить личное сообщение пользователю.' });
      });
    }

    if (interaction.customId.startsWith('call_app:')) {
      // Обработка кнопки "Обзвон"
      const voiceCategory = await guild.channels.fetch(VOICE_CATEGORY_ID);
      const voiceChannels = voiceCategory.children.cache;

      // Список заранее определенных каналов по их ID
      const selectedChannels = [
        '1203029383871463444', // Первый канал
        '1327303833491345419', // Второй канал
        '1386828355499851806'  // Третий канал
      ];

      // Фильтруем доступные каналы, чтобы получить только нужные
      const availableChannels = selectedChannels
        .map(id => voiceChannels.get(id))  // Используем get для получения канала по ID
        .filter(channel => channel !== undefined);  // Фильтруем undefined значения

      if (availableChannels.length === 0) {
        console.log('Не удалось найти доступные выбранные голосовые каналы.');
        return interaction.reply({ content: 'Не удалось найти доступные выбранные голосовые каналы.', flags: 64 });
      }

      const randomChannel = availableChannels[Math.floor(Math.random() * availableChannels.length)];
      console.log('Выбран канал для обзвона:', randomChannel.name);

      await interaction.reply({
        content: `${user} был вызван на обзвон модератором ${moderator} в канал ${randomChannel.name}. Перейдите по [ссылке](${randomChannel.url}) для подключения.`,
        flags: 64,
      });

      try {
        await user.send({
          content: `Вы были вызваны на обзвон модератором ${moderator} в канал ${randomChannel.name}. Перейдите по [ссылке](${randomChannel.url}) для подключения.`
        });
      } catch (error) {
        console.log('Ошибка при отправке личного сообщения:', error);
      }
    }
  }
});

client.login(process.env.TOKEN);
