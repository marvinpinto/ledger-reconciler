const child_process = require('child_process'); // eslint-disable-line camelcase

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

  if (args.inverseTransactions === undefined) {
    // "--inverse" is hereby the default
    args.inverseTransactions = true;
  }

  let reckonCliArgs = [
    '--file', args.csvInputFileName,
    '--currency', args.ledgerCurrency,
    '--account', args.ledgerAccountName,
    '--unattended',
    '--account-tokens', args.reckonTokensTempFileName,
    '--date-format', '%m/%d/%Y',
  ];

  if (args.inverseTransactions) {
    reckonCliArgs.push('--inverse');
  }

  const {stdout, stderr} = child_process.spawnSync(args.reckonCli, reckonCliArgs);
  args.logger.debug(`stderr output from reckon: ${stderr}`);

  return stdout
    .toString()
    .replace(/^I didn't find a high-likelyhood money column, but I'm taking my best guess with column.*/g, '')
    .trim()
    .concat('\r\n');
};

module.exports = toLedger;
