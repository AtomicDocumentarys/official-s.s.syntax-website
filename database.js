const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

module.exports = {
  redis,

  async getCommands(guildId) {
    return await redis.hgetall(`commands:${guildId}`);
  },

  async saveCommand(guildId, command) {
    await redis.hset(`commands:${guildId}`, command.id, JSON.stringify(command));
  },

  async deleteCommand(guildId, commandId) {
    await redis.hdel(`commands:${guildId}`, commandId);
  },

  async getCommandCount(guildId) {
    return await redis.hlen(`commands:${guildId}`);
  }
};
