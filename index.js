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
      await interaction.deferReply({ ephemeral: true });

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
        ...ROLES_ACCESS_IDS.map(roleId => ({ id: roleId, allow: [PermissionsBitField.Flags.ViewChannel] }))
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

      await channel.send({
        content: ROLES_ACCESS_IDS.map(id => `<@&${id}>`).join(' '),
        embeds: [embed],
        components: [buttons]
      });

      await interaction.editReply({ content: `✅ Ваша заявка отправлена: ${channel}` });
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
    if (!member) return interaction.reply({ content: 'Пользователь не найден', ephemeral: true });

    const moderator = interaction.user;

    const logChannel = await client.channels.fetch(CHANNEL_LOG_ID);
    await logChannel.send(`${moderator} взял заявку пользователя <@${targetUserId}> на рассмотрение.`);

    // Отправляем сообщение с упоминанием модератора
    await interaction.reply({
      content: `Заявка пользователя <@${targetUserId}> взята на рассмотрение модератором ${moderator}`,
      ephemeral: true,
    });
  }

  // Обработка кнопки "Обзвон"
  if (interaction.isButton() && interaction.customId.startsWith('call_app:')) {
    const targetUserId = interaction.customId.split(':')[1];
    const guild = interaction.guild;
    const member = await guild.members.fetch(targetUserId).catch(() => null);
    if (!member) return interaction.reply({ content: 'Пользователь не найден', ephemeral: true });

    const moderator = interaction.user;
    const voiceChannels = guild.channels.cache.filter(ch => ch.type === 'GUILD_VOICE');
    
    const voiceChannel = await interaction.channel.send({
      content: 'Пожалуйста, выберите голосовой канал для обзвона.',
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('select_channel').setLabel('Выбрать канал').setStyle(ButtonStyle.Primary)
        ),
      ],
    });

    // Примерно так: 
    // Пишем, что пользователь был вызван на обзвон и упоминаем канал
    await interaction.reply({
      content: `${member} был вызван на обзвон модератором ${moderator} в канал ${voiceChannel}`,
      ephemeral: true,
    });
  }

  // Обработка кнопки "Принять"
  if (interaction.isButton() && interaction.customId.startsWith('accept_app:')) {
    const targetUserId = interaction.customId.split(':')[1];
    const guild = interaction.guild;
    const member = await guild.members.fetch(targetUserId).catch(() => null);
    if (!member) return interaction.reply({ content: 'Пользователь не найден', ephemeral: true });

    const applicationName = 'G A R C I A';
    const guildId = guild.id;

    const embed = createStatusNotificationEmbed('принято', applicationName, '', guildId);

    await member.send({ embeds: [embed] }).catch(() => {});

    // Логирование в invite-logs
    const logChannel = await client.channels.fetch(CHANNEL_LOG_ID);
    await logChannel.send(`${interaction.user} принял заявку пользователя <@${targetUserId}>`);

    await interaction.reply({ content: '✅ Уведомление о принятии отправлено.', ephemeral: true });
  }

  // Обработка кнопки "Отклонить"
  if (interaction.isButton() && interaction.customId.startsWith('decline_app:')) {
    const targetUserId = interaction.customId.split(':')[1];
    const guild = interaction.guild;
    const member = await guild.members.fetch(targetUserId).catch(() => null);
    if (!member) return interaction.reply({ content: 'Пользователь не найден', ephemeral: true });

    const applicationName = 'G A R C I A';
    const guildId = guild.id;

    const embed = createStatusNotificationEmbed('отклонено', applicationName, '', guildId);

    await member.send({ embeds: [embed] }).catch(() => {});

    // Логирование в invite-logs
    const logChannel = await client.channels.fetch(CHANNEL_LOG_ID);
    await logChannel.send(`${interaction.user} отклонил заявку пользователя <@${targetUserId}>`);

    await interaction.reply({ content: '❌ Заявка отклонена.', ephemeral: true });
  }
});

client.login(process.env.TOKEN);
