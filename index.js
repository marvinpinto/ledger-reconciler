#!/usr/bin/env node

const util = require('util');
const program = require('commander');
const logger = require('./lib/logger');
const readYaml = util.promisify(require('read-yaml'));
const puppeteer = require('puppeteer');
const toCSV = require('./lib/toCSV');
const toLedger = require('./lib/toLedger');
const temp = require('temp').track();
const fs = require('fs-extra');
const writeYaml = util.promisify(require('write-yaml'));

program
  .version('0.0.1')
  .option('-c, --config <config file>', 'Ledger Reconciler config file')
  .parse(process.argv);

process.on('unhandledRejection', (err) => {
  if (process.env.NODE_ENV === 'development') {
    logger.error(err.stack);
    process.exit(1);
  }

  logger.error(err);
  process.exit(1);
});

let configFileName = program.config;
if (!configFileName) {
  configFileName = '.ledger-reconciler.yaml';
}

const main = async () => {
  const parsedConfig = await readYaml(configFileName);

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

  for (let plugin of parsedConfig.plugins) {
    logger.info(`Now processing plugin: ${plugin.name}`);
    const pluginArgs = {
      ...plugin,
      browser,
    };
    const reconcilerPlugin = require(plugin.location);
    const pluginTransactions = await reconcilerPlugin.downloadTransactions(pluginArgs);

    // Write out the CSV output from the plugin into a temp file
    const csvOutput = toCSV(pluginTransactions);
    const tempFile = temp.openSync();
    await fs.write(tempFile.fd, csvOutput);

    // Collate the ledger output for later
    const ledgerOutput = await toLedger({
      ledgerAccountName: plugin.ledgerAccountName,
      ledgerCurrency: plugin.ledgerCurrency,
      reckonCli: parsedConfig.reckonCli,
      csvInputFileName: tempFile.path,
      reckonTokensTempFileName: tempYamlFile.path,
    });

    // Append the ledger output from this plugin onto the temporary ledger file
    await fs.appendFile(tempLedgerFile.path, ledgerOutput);
  }

  await browser.close();
};

main();
