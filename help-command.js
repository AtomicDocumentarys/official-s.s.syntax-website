// Built-in Help Command for S.S. Syntax Bot
// This code gets executed when someone types "-help"

const helpEmbed = {
    title: "🤖 S.S. Syntax Bot Help",
    description: "Your premier multi-language Discord bot with unlimited customization!",
    color: 0x64ffda,
    fields: [
        {
            name: "🎯 What I Can Do",
            value: "• Execute commands in JavaScript, Python, TypeScript, Go\n• Custom prefix and slash commands\n• Message content triggers\n• Reaction-based actions\n• Member join/leave events",
            inline: false
        },
        {
            name: "🔧 Supported Languages",
            value: "• JavaScript (Node.js)\n• Python 3.x\n• TypeScript\n• Go (Golang)"
        },
        {
            name: "⚡ Quick Start",
            value: "1. Go to our dashboard: [Website URL]\n2. Login with Discord\n3. Create custom commands\n4. Deploy to your server!",
            inline: false
        },
        {
            name: "🛡️ Bot Permissions",
            value: "• Manage Roles\n• Send Messages\n• Embed Links\n• Read Message History\n• View Channels"
        },
        {
            name: "❓ Getting Help",
            value: "• Dashboard: Create and manage commands\n• Documentation: Full feature guides\n• Support: [Your Support Server]"
        },
        {
            name: "📝 Command Types",
            value: "• Prefix Commands (-help)\n• Slash Commands (/help)\n• Message Triggers\n• Reaction Events"
        },
        {
            name: "🚀 Key Features",
            value: "• Multi-language execution\n• Real-time code deployment\n• No arbitrary limits\n• Full customization"
        },
        {
            name: "⚠️ Limitations",
            value: "• Must respect Discord API rate limits\n• Cannot bypass Discord's ToS\n• Requires proper permissions"
        },
        {
            name: "🔗 Important Links",
            value: "• [Add Bot to Server]\n• [Dashboard]\n• [Documentation]\n• [Support Server]"
        }
    ],
    footer: {
        text: "S.S. Syntax — The Premier Vessel for Your Source Sauce"
    }
};

// Send help message
message.channel.send({ embeds: [helpEmbed] });

// Additional info for slash commands
if (interaction) {
    interaction.reply({ embeds: [helpEmbed], ephemeral: true });
}
