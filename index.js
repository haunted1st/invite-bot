require('dotenv').config();
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
  '1200040982746517595',
  '1200045928460058768',
  '1203021666800902184',
  '1203016198850355231'
];
const CHANNEL_ACCEPT_ID = '1386830144789942272';
const CHANNEL_DECLINE_ID = '1386830559136714825';
const CHANNEL_LOG_ID = '1304923881294925876';
const INVITE_CHANNEL_ID = '1387148896320487564';

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
    .setImage('https://media.discordapp.net/attachments/1300952214164209746/1387916836452044907/video_3_2_smooth.gif')
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
      { id: 'nickname_stat', label: 'Никнейм и статик', style: TextInputStyle.Short, placeholder: 'Murasaki Ice | 56314' },
      { id: 'irl_name_age', label: 'IRL Имя и возраст', style: TextInputStyle.Short, placeholder: 'Кирилл | 18' },
      { id: 'family_history', label: 'В каких семьях состояли ранее?', style: TextInputStyle.Paragraph, placeholder: 'Укажите, если были в других семьях' },
      { id: 'servers', label: 'На каких серверах качали перса?', style: TextInputStyle.Short, placeholder: '11, 15' },
      { id: 'recoil_links', label: 'Откаты стрельбы (YouTube ссылки)', style: TextInputStyle.Paragraph, placeholder: 'https://youtube.com/...' }
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

      const channelName = `заявка-в-семью-${user.username}`.toLowerCase().replace(/[^a-z0-9\-а-я]/gi, '-');
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
        .setColor(0x2f3136)
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

  if (interaction.isButton() && interaction.customId.includes('app:')) {
    const [action, targetUserId] = interaction.customId.split(':');
    const guild = interaction.guild;
    const member = await guild.members.fetch(targetUserId).catch(() => null);
    const appChannel = interaction.channel;
    const logChannel = await guild.channels.fetch(CHANNEL_LOG_ID).catch(() => null);
    if (!member) return;

    const embedToSend = interaction.message.embeds?.[0];

    if (action === 'accept_app') {
      const targetChannel = await guild.channels.fetch(CHANNEL_ACCEPT_ID).catch(() => null);
      if (targetChannel?.isTextBased() && embedToSend) {
        await targetChannel.send({
          content: `✅ Принятая заявка от <@${targetUserId}>`,
          embeds: [embedToSend]
        });
      }

      await logChannel?.send({
        embeds: [new EmbedBuilder()
          .setTitle('✅ Заявка принята')
          .setDescription(`Заявка от <@${targetUserId}> была **принята** модератором <@${interaction.user.id}>.`)
          .setColor('Green')
          .setTimestamp()]
      });

      await member.send({
        embeds: [new EmbedBuilder()
          .setTitle('✅ Ваша заявка принята')
          .setDescription(`Поздравляем! Ваша заявка была принята. Добро пожаловать!`)
          .setColor('Green')]
      }).catch(() => {});

      await interaction.reply({ content: '✅ Заявка перемещена в принятые.', ephemeral: true });
      setTimeout(() => appChannel.delete().catch(() => {}), 1000);
    }

    if (action === 'review_app') {
      await appChannel.send(`📥 Заявка <@${targetUserId}> взята на рассмотрение модератором <@${interaction.user.id}>`);
      await member.send({
        embeds: [new EmbedBuilder()
          .setTitle('🔎 Рассмотрение заявки')
          .setDescription(`Ваша заявка в семью взята на рассмотрение!\nСсылка: ${appChannel}`)
          .setColor('Orange')]
      }).catch(() => {});
      return interaction.reply({ content: '📥 Заявка взята на рассмотрение.', ephemeral: true });
    }

    if (action === 'call_app') {
      const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice);
      const options = voiceChannels.map(vc => ({ label: vc.name, value: vc.id })).slice(0, 25);
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`call_select:${targetUserId}`)
        .setPlaceholder('Выберите голосовой канал для обзвона')
        .addOptions(options);

      return interaction.reply({
        content: '🔊 Выберите голосовой канал для обзвона:',
        components: [new ActionRowBuilder().addComponents(selectMenu)],
        ephemeral: true
      });
    }

    if (action === 'decline_app') {
      const targetChannel = await guild.channels.fetch(CHANNEL_DECLINE_ID).catch(() => null);
      if (targetChannel?.isTextBased() && embedToSend) {
        await targetChannel.send({
          content: `❌ Заявка от <@${targetUserId}> была отклонена.`,
          embeds: [embedToSend]
        });
      }

      await logChannel?.send({
        embeds: [new EmbedBuilder()
          .setTitle('❌ Заявка отклонена')
          .setDescription(`Заявка от <@${targetUserId}> была **отклонена** модератором <@${interaction.user.id}>.`)
          .setColor('Red')
          .setTimestamp()]
      });

      await member.send({
        embeds: [new EmbedBuilder()
          .setTitle('❌ Ваша заявка отклонена')
          .setDescription('К сожалению, ваша заявка была отклонена. Не отчаивайтесь и попробуйте позже!')
          .setColor('Red')]
      }).catch(() => {});

      await interaction.reply({ content: '❌ Заявка отклонена.', ephemeral: true });
      setTimeout(() => appChannel.delete().catch(() => {}), 1000);
    }
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
