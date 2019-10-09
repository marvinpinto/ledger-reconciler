const util = require('util');
const execFile = util.promisify(require('child_process').execFile);

const ledgerBalanceReport = async args => {
  if (!args.ledgerFileName || !args.logger) {
    throw new Error('Missing ledger file name - this is very likely a bug');
  }

  if (!args.ledgerCli) {
    throw new Error('You do not appear to have the "ledgerCli" key set in your config file.');
  }

  const {stdout, stderr} = await execFile(args.ledgerCli, [
    '--date-format',
    '%Y-%m-%d',
    '-f',
    args.ledgerFileName,
    'balance',
    'Assets',
    'Liabilities',
  ]);

  args.logger.debug(`stderr output from ledger-cli: ${stderr}`);
  return stdout;
};

module.exports = ledgerBalanceReport;
