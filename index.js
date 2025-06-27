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
  StringSelectMenuBuilder
} = require('discord.js');

const dayjs = require('dayjs');
const relativeTime = require('dayjs/plugin/relativeTime');
dayjs.extend(relativeTime);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

const CATEGORY_ID = '1200037290538451095';
const ROLES_ACCESS_IDS = [
  '1388191362922582047', // High PR
  '1388191362922582048'  // PR
];
const CHANNEL_ACCEPT_ID = '1386830144789942272';
const CHANNEL_DECLINE_ID = '1386830559136714825';
const CHANNEL_LOG_ID = '1304923881294925876';
const INVITE_CHANNEL_ID = '1387148896320487564';

// --- Добавлена универсальная функция для создания embed с цветом и текстом по статусу ---
function createStatusNotificationEmbed(status, applicationName, channelName = '', guildId, applicationLink = '') {
  let color;
  let title = '';
  let description = '';
  
  const timeAgo = dayjs().fromNow(); // Пример: "17 hours ago"
  
  switch (status.toLowerCase()) {
    case 'рассмотрение':
      color = 0xf1c40f; // жёлтый
      title = 'Рассмотрение заявки';
      description = `Ваша заявка в **${applicationName}** взята на рассмотрение!\n\n` +
                    `Ссылка на заявку: ${applicationLink || '⁠' + applicationName + '⁠unknown'}\n` +
                    `ID Дискорд сервера: ${guildId}\n` +
                    `Дата события: ${timeAgo}`;
      break;
    case 'обзвон':
      color = 0x3498db; // синий
      title = 'Приглашение на обзвон';
      description = `Вы были вызваны на обзвон!\n\n` +
                    `Вас приглашают присоединиться к голосовому каналу: **${applicationName}** ${channelName}\n` +
                    `ID Дискорд сервера: ${guildId}\n` +
                    `Дата события: ${timeAgo}`;
      break;
    case 'принято':
      color = 0x2ecc71; // зелёный
      title = 'Заявка принята';
      description = `Ваша заявка в **${applicationName}** успешно принята!\n\n` +
                    `ID Дискорд сервера: ${guildId}\n` +
                    `Дата события: ${timeAgo}`;
      break;
    case 'отклонено':
      color = 0xe74c3c; // красный
      title = 'Заявка отклонена';
      description = `К сожалению, ваша заявка в **${applicationName}** была отклонена.\n\n` +
                    `ID Дискорд сервера: ${guildId}\n` +
                    `Дата события: ${timeAgo}`;
      break;
    default:
      color = 0x2f3136; // серый
      title = 'Статус заявки обновлён';
      description = `Статус заявки **${applicationName}** изменён.\n\n` +
                    `ID Дискорд сервера: ${guildId}\n` +
                    `Дата события: ${timeAgo}`;
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
  const botMessage = messages.find(m => m.author.id === client.user.id);
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
  console.log('📥 Обработка ModalSubmit началась');

  try {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.user;
    const guild = interaction.guild;

    if (!guild) {
      console.error('❌ Guild не найден в ModalSubmit');
      return interaction.editReply({ content: '❌ Ошибка: команда доступна только на сервере.', ephemeral: true });
    }

    const nicknameStat = interaction.fields.getTextInputValue('nickname_stat');
    const irl = interaction.fields.getTextInputValue('irl_name_age');
    const history = interaction.fields.getTextInputValue('family_history');
    const servers = interaction.fields.getTextInputValue('servers');
    const recoil = interaction.fields.getTextInputValue('recoil_links');

    let channelName = `заявка-${user.username.toLowerCase()}`;
    channelName = channelName.replace(/[^a-z0-9\-а-я]/gi, '-').replace(/-+/g, '-').slice(0, 90);

    const overwrites = [
      { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
      ...ROLES_ACCESS_IDS.map(roleId => ({ id: roleId, allow: [PermissionsBitField.Flags.ViewChannel] }))
    ];

    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: CATEGORY_ID,
      permissionOverwrites: overwrites
    }).catch(err => {
      console.error('❌ Ошибка при создании канала:', err);
    });

    if (!channel) {
      console.error('❌ Канал не был создан');
      return interaction.editReply({ content: '❌ Не удалось создать канал.' });
    }

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
    }).catch(err => {
      console.error('❌ Ошибка при отправке embed и кнопок:', err);
    });

    await interaction.editReply({ content: `✅ Ваша заявка отправлена: ${channel}` });
  } catch (err) {
    console.error('❌ Ошибка в обработке ModalSubmit:', err);
    if (!interaction.deferred && !interaction.replied) {
      await interaction.reply({ content: '❌ Ошибка при отправке.', ephemeral: true }).catch(() => {});
    } else {
      await interaction.editReply({ content: '❌ Ошибка при отправке.' }).catch(() => {});
    }
  }
}

  // --- Обработка кнопки "Рассмотрение" с использованием новой функции ---
  if (interaction.isButton() && interaction.customId.startsWith('review_app:')) {
    const targetUserId = interaction.customId.split(':')[1];
    const guild = interaction.guild;
    const member = await guild.members.fetch(targetUserId).catch(() => null);
    if (!member) return interaction.reply({ content: 'Пользователь не найден', ephemeral: true });

    // Здесь можно динамически получить название заявки из твоих данных, пока пример с константой:
    const applicationName = 'G A R C I A';
    const guildId = guild.id;
    const applicationLink = ''; // Можно передать ссылку на заявку, если есть

    const embed = createStatusNotificationEmbed('рассмотрение', applicationName, '', guildId, applicationLink);

    await member.send({ embeds: [embed] }).catch(() => {});
    await interaction.reply({ content: '✅ Уведомление о рассмотрении отправлено.', ephemeral: true });
  }

  // --- Обработка кнопки "Обзвон" с использованием новой функции ---
  if (interaction.isButton() && interaction.customId.startsWith('call_app:')) {
    const targetUserId = interaction.customId.split(':')[1];
    const guild = interaction.guild;
    const member = await guild.members.fetch(targetUserId).catch(() => null);
    if (!member) return interaction.reply({ content: 'Пользователь не найден', ephemeral: true });

    const applicationName = 'G A R C I A';
    const channelName = '☎️・Обзвон #2';
    const guildId = guild.id;

    const embed = createStatusNotificationEmbed('обзвон', applicationName, channelName, guildId);

    await member.send({ embeds: [embed] }).catch(() => {});
    await interaction.reply({ content: '✅ Уведомление об обзвоне отправлено.', ephemeral: true });
  }

  // Остальной код (отклонение, обзвон с селектом и т.п.) без изменений
  if (interaction.isButton() && interaction.customId.includes('decline_app')) {
    const [action, targetUserId] = interaction.customId.split(':');
    const modal = new ModalBuilder()
      .setCustomId(`decline_modal:${targetUserId}`)
      .setTitle('Причина отказа');

    const reasonInput = new TextInputBuilder()
      .setCustomId('decline_reason')
      .setLabel('Укажите причину отказа')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setPlaceholder('Например: Недостаточно опыта, слабые откаты и т.д.');

    const modalRow = new ActionRowBuilder().addComponents(reasonInput);
    modal.addComponents(modalRow);

    return interaction.showModal(modal);
  }

  if (interaction.type === InteractionType.ModalSubmit && interaction.customId.startsWith('decline_modal:')) {
    const targetUserId = interaction.customId.split(':')[1];
    const reason = interaction.fields.getTextInputValue('decline_reason');
    const guild = interaction.guild;
    const member = await guild.members.fetch(targetUserId).catch(() => null);
    const logChannel = await guild.channels.fetch(CHANNEL_LOG_ID).catch(() => null);
    const targetChannel = await guild.channels.fetch(CHANNEL_DECLINE_ID).catch(() => null);
    const appChannel = interaction.channel;
    const embedToSend = interaction.message?.embeds?.[0];

    if (!member || !embedToSend) {
      return interaction.reply({ content: '❌ Не удалось отклонить заявку.', ephemeral: true });
    }

    const embedWithReason = EmbedBuilder.from(embedToSend)
      .addFields({ name: '❌ Причина отказа', value: reason });

    if (targetChannel?.isTextBased()) {
      await targetChannel.send({
        content: `❌ Заявка от <@${targetUserId}> была отклонена.`,
        embeds: [embedWithReason]
      });
    }

    await logChannel?.send({
      embeds: [new EmbedBuilder()
        .setTitle('❌ Заявка отклонена')
        .setDescription(`Заявка от <@${targetUserId}> была **отклонена** модератором <@${interaction.user.id}>.`)
        .addFields({ name: 'Причина', value: reason })
        .setColor('Red')
        .setTimestamp()]
    });

    await member.send({
      embeds: [new EmbedBuilder()
        .setTitle('❌ Ваша заявка отклонена')
        .setDescription(`К сожалению, ваша заявка была отклонена.\n**Причина:** ${reason}`)
        .setColor('Red')]
    }).catch(() => {});

    await interaction.reply({ content: '❌ Заявка отклонена с указанием причины.', ephemeral: true });
    setTimeout(() => appChannel.delete().catch(() => {}), 1000);
  }

  if (interaction.isStringSelectMenu()) {
    const [action, targetUserId] = interaction.customId.split(':');
    if (action !== 'call_select') return;

    const selectedChannel = interaction.guild.channels.cache.get(interaction.values[0]);
    const member = await interaction.guild.members.fetch(targetUserId).catch(() => null);
    if (!selectedChannel || !member) return;

    await interaction.channel.send(`📞 <@${targetUserId}> вызван на **обзвон** в канал ${selectedChannel} модератором <@${interaction.user.id}>`);
    await member.send({
      embeds: [new EmbedBuilder()
        .setTitle('📞 Вызов на обзвон')
        .setDescription(`Вы вызваны на **обзвон** модератором <@${interaction.user.id}> в канал **${selectedChannel.name}**.`)
        .setColor('Blurple')]
    }).catch(() => {});
    await interaction.update({ content: '📞 Обзвон назначен.', components: [] });
  }
});

console.log('🔐 Токен загружен');
client.login(process.env.TOKEN);
