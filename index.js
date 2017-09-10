#!/usr/bin/env node

const util = require('util');
const program = require('commander');
const Logger = require('./lib/Logger');
const readYaml = util.promisify(require('read-yaml'));
const puppeteer = require('puppeteer');
const toCSV = require('./lib/toCSV');
const toLedger = require('./lib/toLedger');
const temp = require('temp').track();
const fs = require('fs-extra');
const writeYaml = util.promisify(require('write-yaml'));
const collateLedgerData = require('./lib/collateLedgerData');
const ledgerBalanceReport = require('./lib/ledgerBalanceReport');
const jsYaml = require('js-yaml');

program
  .version('0.0.2')
  .option('-c, --config <config file>', 'Ledger Reconciler config file')
  .option('--silent', 'Suppress all output except warnings & errors')
  .option('--debug', 'Print out debug output')
  .option('--dry-run', 'Perform a dry run - scrape transactions for all plugins but do not update anything')
  .parse(process.argv);

process.on('unhandledRejection', (err) => {
  if (program.debug) {
    logger.error(err.stack);
    process.exit(1);
  }

  logger.error(err);
  process.exit(1);
});

// Initiate the logger instance
const logger = new Logger(program.silent, program.debug);

let configFileName = program.config;
if (!configFileName) {
  configFileName = '.ledger-reconciler.yaml';
}

const main = async () => {
  let parsedConfig = await readYaml(configFileName);

  if (!parsedConfig.plugins || !parsedConfig.plugins.length) {
    logger.warn(`You do not appear to have any plugins listed in your ${configFileName} config file`);
    process.exit(0);
  }

  const browser = await puppeteer.launch({
    args: parsedConfig.chromiumHeadlessArgs,
    dumpio: false, // useful for debugging
  });

  // Write out the reckon token data to a temp file
  const tempYamlFile = temp.openSync();
  await writeYaml(tempYamlFile.path, parsedConfig.reckonTokens);

  // Write out the original ledger data to a temp file
  const tempLedgerFile = temp.openSync();
  await fs.copy(parsedConfig.ledgerDataFile, tempLedgerFile.path);

  for (let i = 0; i < parsedConfig.plugins.length; i++) {
    const plugin = parsedConfig.plugins[i];

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
        reckonCli: parsedConfig.reckonCli,
        csvInputFileName: tempFile.path,
        reckonTokensTempFileName: tempYamlFile.path,
        logger,
      });
    }

    // Append the ledger output from this plugin onto the temporary ledger file
    await fs.appendFile(tempLedgerFile.path, ledgerOutput);

    // Update the most recent transaction date for this plugin
    parsedConfig.plugins[i].mostRecentTransactionDate = inst.getMostRecentTransactionDate();

    // Print out the remaining balance as determined by this plugin
    logger.info(`Remaining balance for plugin ${plugin.name}: ${inst.getRemainingBalance()}`);
  }

  // Close the chromium browser instance as we no longer require it
  await browser.close();

  const collatedLedgerOutput = await collateLedgerData({
    tempLedgerFileName: tempLedgerFile.path,
    ledgerCli: parsedConfig.ledgerCli,
    logger,
  });

  if (program.dryRun) {
    logger.info(`Will replace ledger file "${parsedConfig.ledgerDataFile}" with:\r\n${collatedLedgerOutput}`);
    logger.info(`Will replace config file "${configFileName}" with:\r\n${jsYaml.safeDump(parsedConfig)}`);
    return Promise.resolve();
  }

  // Write out the update config & ledger data files
  await writeYaml(configFileName, parsedConfig);
  await fs.outputFile(parsedConfig.ledgerDataFile, collatedLedgerOutput);

  const ledgerBalanceReportOutput = await ledgerBalanceReport({
    ledgerFileName: parsedConfig.ledgerDataFile,
    ledgerCli: parsedConfig.ledgerCli,
    logger,
  });
  logger.info(`Ledger Balance Report:\r\n${ledgerBalanceReportOutput}`);
};

main();
