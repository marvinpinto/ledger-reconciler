#!/usr/bin/env node

const util = require('util');
const program = require('commander');
const logger = require('./lib/logger');
const readYaml = util.promisify(require('read-yaml'));
const puppeteer = require('puppeteer');

program
  .version('0.0.1')
  .option('-c, --config <config file>', 'Ledger Reconciler config file')
  .parse(process.argv);

process.on('unhandledRejection', (err) => {
  if (process.env.NODE_ENV === 'development') {
    logger.error(err.stack);
    process.exit(1)
  }

  logger.error(err);
  process.exit(1)
})

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
    args: parsedConfig['chromium_headless_args'],
    dumpio: false,  // useful for debugging
  });

  let transactions = [];
  for (let plugin of parsedConfig.plugins) {
    logger.info(`Now processing plugin: ${plugin.name}`);
    const pluginArgs = {
      ...plugin,
      browser,
    };
    const reconcilerPlugin = require(plugin.location);
    const tRows = await reconcilerPlugin.downloadTransactions(pluginArgs);
    transactions = [...transactions, ...tRows];
  }

  await browser.close();
};

main();
