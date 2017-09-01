const util = require('util');
const execFile = util.promisify(require('child_process').execFile);
const logger = require('./logger');

const collateLedgerData = async (args) => {
  if (!args.tempLedgerFileName ||
      !args.ledgerCli) {
    throw new Error('Invalid arguments passed into "collateLedgerData"');
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
