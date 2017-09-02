const logger = require('../logger');

class BasePlugin {
  constructor(browser) {
    this.logger = logger;
    this.browser = browser;
    this.scrapeTransactions = this.scrapeTransactions.bind(this);
  }

  async scrapeTransactions(args) {
    throw new Error('This should be implemented in the extended class');
  }
}

module.exports = BasePlugin;
