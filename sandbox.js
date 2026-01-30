const { NodeVM } = require('vm2');

const vm = new NodeVM({
  console: 'redirect',
  sandbox: {},
  timeout: 3000,
  eval: false,
  wasm: false,
  require: {
    external: ['axios', 'moment'],
    builtin: [],
    root: "./"
  }
});

module.exports.runSandboxed = async (code, context) => {
  try {
    const script = `
      module.exports = async (context) => {
        ${code}
      }
    `;
    const fn = vm.run(script);
    return await fn(context);
  } catch (err) {
    return "⚠️ Sandbox execution blocked";
  }
};
