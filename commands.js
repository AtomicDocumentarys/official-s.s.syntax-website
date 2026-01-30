const { getCommands, getCommandCount, saveCommand } = require('./database');
const { validateCode, isOnCooldown, setCooldown } = require('./safety');
const { MAX_COMMANDS_PER_SERVER } = require('./config');
const { runSandboxed } = require('./sandbox');

async function addCommand(guildId, command) {
  const count = await getCommandCount(guildId);
  if (count >= MAX_COMMANDS_PER_SERVER) {
    throw new Error("Server command limit reached");
  }

  validateCode(command.code);
  await saveCommand(guildId, command);
}

async function executeCommand(cmd, message) {
  if (await isOnCooldown(cmd.id, message.author.id)) {
    return message.reply("⏳ Command on cooldown");
  }

  await setCooldown(cmd.id, message.author.id, 5);

  const result = await runSandboxed(cmd.code, {
    message,
    author: message.author,
    guild: message.guild
  });

  if (result) message.reply(String(result));
}

async function handleMessage(message) {
  const commands = await getCommands(message.guild.id);
  const content = message.content.trim();

  for (const cmdId in commands) {
    const cmd = JSON.parse(commands[cmdId]);
    if (content.startsWith(cmd.trigger)) {
      return executeCommand(cmd, message);
    }
  }
}

module.exports = { addCommand, handleMessage };
