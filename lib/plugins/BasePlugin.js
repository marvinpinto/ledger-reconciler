class BasePlugin {
  constructor(browser, logger, pluginArgs) {
    this.logger = logger;
    this.browser = browser;
    this.pluginArgs = pluginArgs;
    this.scrapeTransactions = this.scrapeTransactions.bind(this);
    this.getMostRecentTransactionDate = this.getMostRecentTransactionDate.bind(this);
    this.getRemainingBalance = this.getRemainingBalance.bind(this);
    this.clearUserSession = this.clearUserSession.bind(this);
    this.page = null; // should be implemented in extended class
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

  // istanbul ignore next
  async clearUserSession() {
    this.logger.debug('Clearing out local & session storage');
    await this.page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });

    this.logger.debug('Clearing out cookies');
    const cookies = await this.page.cookies();
    await this.page.deleteCookie(...cookies);
  }
}

module.exports = BasePlugin;
