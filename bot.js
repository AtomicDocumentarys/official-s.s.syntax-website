const { Client, GatewayIntentBits } = require('discord.js');
const { exec } = require('child_process');
const { VM } = require('vm2');
const Redis = require('ioredis');
const fs = require('fs');

const client = new Client({ intents: [32767] });
const redis = new Redis();

// --- THE MULTI-LANG EXECUTOR ---
async function executeCode(lang, code, context) {
    const timeout = 3000; // 3 second kill-limit

    switch (lang) {
        case 'js':
            const vm = new VM({ timeout, sandbox: context });
            try { return await vm.run(`(async () => { ${code} })()`); } 
            catch (e) { return `JS Error: ${e.message}`; }

        case 'py':
            return new Promise((resolve) => {
                // Wrap python code to accept context via JSON
                const pyCode = `
import json
context = json.loads('${JSON.stringify(context)}')
${code}
`;
                fs.writeFileSync('temp.py', pyCode);
                exec(`python3 temp.py`, { timeout }, (error, stdout, stderr) => {
                    if (error) resolve(`Python Error: ${stderr}`);
                    resolve(stdout || "Code executed (no output)");
                });
            });

        case 'go':
            return new Promise((resolve) => {
                // Go requires a main package structure
                const goCode = `
package main
import "fmt"
func main() {
    ${code}
}
`;
                fs.writeFileSync('temp.go', goCode);
                exec(`go run temp.go`, { timeout }, (error, stdout, stderr) => {
                    if (error) resolve(`Go Error: ${stderr}`);
                    resolve(stdout || "Code executed (no output)");
                });
            });
    }
}

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const guildCommands = await redis.hgetall(`commands:${message.guild.id}`);
    for (const id in guildCommands) {
        const cmd = JSON.parse(guildCommands[id]);
        
        let triggered = false;
        if (cmd.type === 'prefix' && message.content.startsWith((cmd.prefix || '!') + cmd.name)) triggered = true;
        if (cmd.type === 'message' && message.content.toLowerCase().includes(cmd.trigger.toLowerCase())) triggered = true;

        if (triggered) {
            const context = {
                user: message.author.username,
                content: message.content,
                channel: message.channel.id
            };
            const result = await executeCode(cmd.language, cmd.code, context);
            message.reply(`\`\`\`\n${result}\n\`\`\``);
        }
    }
});

client.login("YOUR_TOKEN_HERE");
                     
