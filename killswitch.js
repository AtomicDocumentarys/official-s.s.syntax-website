const { redis } = require('./database');

let globalEnabled = true;

async function loadGlobalState() {
  const state = await redis.get('global:enabled');
  globalEnabled = state !== 'false';
}

async function disableGlobally() {
  globalEnabled = false;
  await redis.set('global:enabled', 'false');
}

function isEnabled() {
  return globalEnabled;
}

module.exports = {
  loadGlobalState,
  disableGlobally,
  isEnabled
};
