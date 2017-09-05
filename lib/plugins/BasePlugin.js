class BasePlugin {
  constructor(browser, logger, pluginArgs) {
    this.logger = logger;
    this.browser = browser;
    this.pluginArgs = pluginArgs;
    this.scrapeTransactions = this.scrapeTransactions.bind(this);
    this.getMostRecentTransactionDate = this.getMostRecentTransactionDate.bind(this);
    this.getRemainingBalance = this.getRemainingBalance.bind(this);
  }

  async scrapeTransactions() {
    throw new Error('This should be implemented in the extended class');
  }

  getMostRecentTransactionDate() {
    throw new Error('This should be implemented in the extended class');
  }

  getRemainingBalance() {
    throw new Error('This should be implemented in the extended class');
  }
}

module.exports = BasePlugin;
