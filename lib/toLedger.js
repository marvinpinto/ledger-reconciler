const util = require('util');
const execFile = util.promisify(require('child_process').execFile);

const toLedger = async (args) => {
  if (!args.ledgerAccountName || !args.ledgerCurrency) {
    throw new Error('The config for one of your plugins is missing either the "ledgerAccountName" or the "ledgerCurrency" keys.');
  }

  if (!args.reckonCli) {
    throw new Error('You do not appear to have the "reckonCli" key set in your config file.');
  }

  if (!args.csvInputFileName || !args.reckonTokensTempFileName || !args.logger) {
    throw new Error('Missing required temporary files - this is very likely a bug');
  }

  const {stdout, stderr} = await execFile(args.reckonCli, [
    '--file', args.csvInputFileName,
    '--currency', args.ledgerCurrency,
    '--inverse',
    '--account', args.ledgerAccountName,
    '--unattended',
    '--account-tokens', args.reckonTokensTempFileName,
  ]);

  args.logger.debug(`stderr output from reckon: ${stderr}`);
  return stdout.replace(/^I didn't find a high-likelyhood money column, but I'm taking my best guess with column.*/g, '').trim();
};

module.exports = toLedger;
