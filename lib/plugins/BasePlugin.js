const fs = require('fs');

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
    this.pageClick = this.pageClick.bind(this);
    this.getSelectorValue = this.getSelectorValue.bind(this);
    this.generateDebugScreenshot = this.generateDebugScreenshot.bind(this);
    this.sleep = this.sleep.bind(this);
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
    if (!this.page) {
      return;
    }

    try {
      this.logger.debug('Clearing out local & session storage');
      await this.page.evaluate(() => {
        window.localStorage.clear();
        window.sessionStorage.clear();
      });
    } catch (error) {
      // Storage is disabled inside 'data:' URLs
      this.logger.debug(`Unable to clear out local/session storage: ${error}`);
    }

    this.logger.debug('Clearing out cookies');
    const cookies = await this.page.cookies();
    await this.page.deleteCookie(...cookies);
  }

  // istanbul ignore next
  async getSelectorValue(selector) {
    await this.page.waitForSelector(selector, {visible: true});
    const selectorValue = await this.page.$eval(selector, el => el.innerText.trim());
    return selectorValue;
  }

  // istanbul ignore next
  async pageClick(selector, waitForNavigation = true) {
    // Wait for the selector to be present before attempting to click it
    await this.page.waitForSelector(selector, {visible: true});
    this.logger.debug(`Selector present, now attempting click: ${selector}`);

    let promises = [];

    if (waitForNavigation) {
      promises.push(this.page.waitForNavigation({waitUntil: 'networkidle0'}));
    }

    promises.push(this.page.click(selector));
    await Promise.all(promises);
  }

  // istanbul ignore next
  async generateDebugScreenshot() {
    await this.page.screenshot({path: 'debug-screenshot.png', fullPage: true});
    const bodyHTML = await this.page.evaluate(() => document.body.innerHTML);
    fs.writeFileSync('debug-screenshot.html', bodyHTML);
  }

  // istanbul ignore next
  sleep(time) {
    return new Promise(resolve => setTimeout(resolve, time));
  }

  // istanbul ignore next
  async initializeHeadlessChrome() {
    this.page = await this.browser.newPage();
    this.page.on('console', msg => this.logger.debug(msg.text()));
    await this.page.setCacheEnabled(false);
  }
}

module.exports = BasePlugin;
