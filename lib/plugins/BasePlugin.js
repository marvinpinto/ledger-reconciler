class BasePlugin {
  constructor(browser, logger, pluginArgs) {
    this.logger = logger;
    this.browser = browser;
    this.pluginArgs = pluginArgs;
    this.scrapeTransactions = this.scrapeTransactions.bind(this);
  }

  async scrapeTransactions() {
    throw new Error('This should be implemented in the extended class');
  }

  getMostRecentTransactionDate() {
    throw new Error('This should be implemented in the extended class');
  }
}

module.exports = BasePlugin;
