#!/usr/bin/env node

const util = require('util');
const program = require('commander');
const Logger = require('./lib/Logger');
const puppeteer = require('puppeteer');
const toCSV = require('./lib/toCSV');
const toLedger = require('./lib/toLedger');
const temp = require('temp').track();
const fs = require('fs-extra');
const writeYaml = util.promisify(require('write-yaml'));
const collateLedgerData = require('./lib/collateLedgerData');
const ledgerBalanceReport = require('./lib/ledgerBalanceReport');
const jsYaml = require('js-yaml');
const parseConfiguration = require('./lib/parseConfiguration');

program
  .version('0.3.0')
  .option('-c, --config <config file>', 'Ledger Reconciler config file')
  .option('--silent', 'Suppress all output except warnings & errors')
  .option('--debug', 'Print out debug output')
  .option('--dry-run', 'Perform a dry run - scrape transactions for all plugins but do not update anything')
  .parse(process.argv);

process.on('unhandledRejection', (err) => {
  logger.error(err);
  logger.error(err.stack);
  process.exit(1);
});

// Initiate the logger instance
const logger = new Logger(program.silent, program.debug);

let configFileName = program.config;
if (!configFileName) {
  configFileName = '.ledger-reconciler.yaml';
}

const main = async () => {
  const rawConfiguration = await parseConfiguration(configFileName);
  let encrConfig = rawConfiguration.encrypted;
  let decrConfig = rawConfiguration.decrypted;

  if (!decrConfig.plugins || !decrConfig.plugins.length) {
    logger.warn(`You do not appear to have any plugins listed in your ${configFileName} config file`);
    process.exit(0);
  }

  const browser = await puppeteer.launch({
    args: decrConfig.chromiumHeadlessArgs,
    dumpio: false, // useful for debugging
  });

  // Write out the reckon token data to a temp file
  const tempYamlFile = temp.openSync();
  await writeYaml(tempYamlFile.path, decrConfig.reckonTokens);

  // Write out the original ledger data to a temp file
  const tempLedgerFile = temp.openSync();
  await fs.copy(decrConfig.ledgerDataFile, tempLedgerFile.path);

  for (let i = 0; i < decrConfig.plugins.length; i++) {
    const plugin = decrConfig.plugins[i];

    logger.info(`Now processing plugin: ${plugin.name}`);
    const ReconcilerPlugin = require(plugin.location);
    const inst = new ReconcilerPlugin(browser, logger, {...plugin});
    const pluginTransactions = await inst.scrapeTransactions();

    // Write out the CSV output from the plugin into a temp file
    logger.debug(`Raw transaction list: ${JSON.stringify(pluginTransactions)}`);
    const csvOutput = toCSV(pluginTransactions);
    const tempFile = temp.openSync();
    await fs.write(tempFile.fd, csvOutput);

    // Collate the ledger output for later
    let ledgerOutput = '';
    if (pluginTransactions.length) {
      ledgerOutput = await toLedger({
        ledgerAccountName: plugin.ledgerAccountName,
        ledgerCurrency: plugin.ledgerCurrency,
        reckonCli: decrConfig.reckonCli,
        csvInputFileName: tempFile.path,
        reckonTokensTempFileName: tempYamlFile.path,
        logger,
        inverseTransactions: plugin.inverseTransactions,
      });
    }

    // Append the ledger output from this plugin onto the temporary ledger file
    await fs.appendFile(tempLedgerFile.path, ledgerOutput);

    // Update the most recent transaction date for this plugin
    encrConfig.plugins[i].mostRecentTransactionDate = inst.getMostRecentTransactionDate();

    // Print out the remaining balance as determined by this plugin
    logger.info(`Remaining balance for plugin ${plugin.name}: ${inst.getRemainingBalance()}`);

    // Clear out the user session
    await inst.clearUserSession();
  }

  // Close the chromium browser instance as we no longer require it
  await browser.close();

  const collatedLedgerOutput = await collateLedgerData({
    tempLedgerFileName: tempLedgerFile.path,
    ledgerCli: decrConfig.ledgerCli,
    logger,
  });

  if (program.dryRun) {
    logger.info(`Will replace ledger file "${decrConfig.ledgerDataFile}" with:\r\n${collatedLedgerOutput}`);
    logger.info(`Will replace config file "${configFileName}" with:\r\n${jsYaml.safeDump(encrConfig)}`);
    return Promise.resolve();
  }

  // Write out the update config & ledger data files
  await writeYaml(configFileName, encrConfig);
  await fs.outputFile(decrConfig.ledgerDataFile, collatedLedgerOutput);

  const ledgerBalanceReportOutput = await ledgerBalanceReport({
    ledgerFileName: decrConfig.ledgerDataFile,
    ledgerCli: decrConfig.ledgerCli,
    logger,
  });
  logger.info(`Ledger Balance Report:\r\n${ledgerBalanceReportOutput}`);
};

main();
