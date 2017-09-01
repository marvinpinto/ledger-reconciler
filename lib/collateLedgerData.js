const util = require('util');
const execFile = util.promisify(require('child_process').execFile);
const logger = require('./logger');

const collateLedgerData = async (args) => {
  if (!args.tempLedgerFileName) {
    throw new Error('Missing temporary ledger file name - this is very likely a bug');
  }

  if (!args.ledgerCli) {
    throw new Error('You do not appear to have the "ledgerCli" key set in your config file.');
  }

  const {stdout, stderr} = await execFile(args.ledgerCli, [
    '-f', args.tempLedgerFileName,
    '--sort', 'd',
    'print',
  ]);

  logger.debug(`stderr output from ledger-cli: ${stderr}`);
  return stdout;
};

module.exports = collateLedgerData;
