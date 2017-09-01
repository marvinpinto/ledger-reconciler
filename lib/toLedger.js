const util = require('util');
const execFile = util.promisify(require('child_process').execFile);
const logger = require('./logger');

const toLedger = async (args) => {
  if (!args.ledgerAccountName ||
      !args.ledgerCurrency ||
      !args.reckonCli ||
      !args.csvInputFileName ||
      !args.reckonTokensTempFileName) {
    throw new Error('Invalid arguments passed into "toLedger"');
  }

  logger.debug('Will now convert to ledger output');

  const {stdout, stderr} = await execFile(args.reckonCli, [
    '--file', args.csvInputFileName,
    '--currency', args.ledgerCurrency,
    '--inverse',
    '--account', args.ledgerAccountName,
    '--unattended',
    '--account-tokens', args.reckonTokensTempFileName,
  ]);

  logger.debug(`stderr output from reckon: ${stderr}`);
  return stdout.replace(/^I didn't find a high-likelyhood money column, but I'm taking my best guess with column.*/g, '').trim();
};

module.exports = toLedger;
