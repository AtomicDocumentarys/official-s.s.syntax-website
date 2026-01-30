async function loadServers() {
    const token = localStorage.getItem('discord_token');
    const [userGuilds, botGuilds] = await Promise.all([
        fetch('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: `Bearer ${token}` }
        }).then(res => res.json()),
        fetch('/api/bot-guilds').then(res => res.json())
    ]);

    const grid = document.getElementById('serverGrid');
    grid.innerHTML = '';

    const botGuildIds = new Set(botGuilds.map(g => g.id));

    userGuilds.forEach(guild => {
        // Filter: Check for MANAGE_GUILD (0x20) or ADMIN (0x8)
        const perms = BigInt(guild.permissions);
        if ((perms & 0x20n) !== 0x20n && (perms & 0x8n) !== 0x8n) return;

        const card = document.createElement('div');
        card.className = 'server-card';
        const isBotIn = botGuildIds.has(guild.id);

        card.innerHTML = `
            <div class="server-icon">${guild.icon ? `<img src="https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png">` : guild.name[0]}</div>
            <div class="server-name">${guild.name}</div>
            <button class="btn">${isBotIn ? 'Manage' : 'Invite Bot'}</button>
        `;

        card.onclick = () => {
            if (isBotIn) {
                currentSelectedGuild = guild.id;
                document.querySelectorAll('.server-card').forEach(c => c.style.borderColor = 'transparent');
                card.style.borderColor = 'var(--primary)';
                showTab('command-tab');
            } else {
                window.open(`https://discord.com/oauth2/authorize?client_id=1466792124686008341&permissions=8&scope=bot%20applications.commands&guild_id=${guild.id}`, '_blank');
            }
        };
        grid.appendChild(card);
    });
                                                                  }
