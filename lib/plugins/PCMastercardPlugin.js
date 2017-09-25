const BasePlugin = require('./BasePlugin');

class PCMastercardPlugin extends BasePlugin {
  constructor(browser, logger, pluginArgs) {
    super(browser, logger, pluginArgs);

    if (!this.pluginArgs.username) {
      throw new Error('You do not appear to have either the "username" key set in your config file for the PC Mastercard plugin.');
    }

    if (!this.pluginArgs.password) {
      throw new Error('You do not appear to have either the "password" key set in your config file for the PC Mastercard plugin.');
    }

    if (!this.pluginArgs.securityAnswer) {
      throw new Error('You do not appear to have either the "securityAnswer" key set in your config file for the PC Mastercard plugin.');
    }

    this.parseTransactionRows = this.parseTransactionRows.bind(this);
    this.getMostRecentTransactionDate = this.getMostRecentTransactionDate.bind(this);

    this.configuredMostRecentTransactionDate = 0;
    this.updatedMostRecentTransactionDate = 0;
    if (this.pluginArgs.mostRecentTransactionDate) {
      this.configuredMostRecentTransactionDate = this.pluginArgs.mostRecentTransactionDate;
      this.updatedMostRecentTransactionDate = this.pluginArgs.mostRecentTransactionDate;
    }

    this.remainingBalance = 'undefined';
  }

  // istanbul ignore next
  async scrapeTransactions() {
    this.page = await this.browser.newPage();
    this.page.on('console', this.logger.debug);

    this.logger.debug('Initialing transaction download');

    // Bring up the PC Mastercard login page
    await this.page.goto('https://online.pcmastercard.ca/PCB_Consumer/Login.do');

    // Fill in the username
    await this.page.click('input[name="username"]');
    await this.page.type(this.pluginArgs.username);

    // Fill in the password
    await this.page.click('input[name="password"]');
    await this.page.type(this.pluginArgs.password);

    // Click "Sign On"
    await this.page.click('#content > div.module-login.module.clearfix > div.module-content > form > div.actions.group.clearfix > div:nth-child(2) > input[type="submit"]');
    await this.page.waitForNavigation();

    // Fill in the answer to one of the security questions, if presented
    const securityAnswerField = await this.page.$('form[name="secondaryUserAuthForm"] input[name="hintanswer"]');
    if (securityAnswerField) {
      await securityAnswerField.click();
      await this.page.type(this.pluginArgs.securityAnswer);
      await this.page.click('input[type="submit"][name="submitNext"]');
      await this.page.waitForNavigation();
    }

    this.logger.debug('Successfully logged in');

    // Get the current balance
    const currentBalanceSelector = '#main > div > div.sidebar.column > div.module-make-payment.module.hide-on-mobile.clearfix > div > div.value > span';
    const currentBalance = await this.page.$eval(currentBalanceSelector, (el) => el.innerHTML);
    this.remainingBalance = currentBalance;
    this.logger.debug(`Current balance is: ${this.remainingBalance}`);

    const availableStatements = await this.page.evaluate((sel) => {
      const rows = [...document.querySelectorAll(sel)];
      return rows.map((row) => {
        return row.getAttribute('value');
      });
    }, 'form[name="transHistoryForm"] select[name="cycleDate"] option');

    let transactions = [];

    for (let stmt of availableStatements) {
      if (!stmt) {
        this.logger.debug(`Nothing to process with "${stmt}", moving along`);
        continue;
      }

      this.logger.debug(`Now processing statement: ${stmt}`);

      // Select the current statement from the statement cycle list
      await this.page.click('form[name="transHistoryForm"] a.selectBox');
      await this.page.click(`body > ul.selectBox-dropdown-menu > li > a[rel="${stmt}"]`);
      await this.page.waitForNavigation();

      const tRows = await this.parseTransactionRows();
      transactions = [...transactions, ...tRows];
    }

    return transactions;
  }

  // istanbul ignore next
  async parseTransactionRows() {
    // Parse the individual transaction entries in the displayed table
    const {transactionList, mostRecentDateWeveSeen} = await this.page.evaluate((sel, configuredMostRecentTransactionDate, updatedMostRecentTransactionDate) => {
      let transactionList = [];
      let mostRecentDateWeveSeen = updatedMostRecentTransactionDate;

      const rows = [...document.querySelectorAll(sel)];
      rows.forEach((row) => {
        const eles = [...row.querySelectorAll('td')];

        const rawDate = eles[1].innerHTML.replace(/&nbsp;/g, '').replace(/,/g, '');
        const epochDate = Date.parse(rawDate);
        // ignore any dates that can't be parsed - i.e. header rows
        if (isNaN(epochDate)) {
          return;
        }

        // Discard this transaction if it is older than we care for
        if (epochDate <= configuredMostRecentTransactionDate) {
          console.log(`Discarding transaction from ${epochDate} as it is too old to process`);
          return;
        }
        console.log(`Processing transaction from ${epochDate}`);

        // Make note of the most recent transaction date
        if (epochDate >= mostRecentDateWeveSeen) {
          mostRecentDateWeveSeen = epochDate;
        }

        const merchant = eles[2].innerText.trim();

        let creditAmt;
        const debitAmt = eles[3].innerText.trim();
        if (debitAmt.startsWith('-')) {
          creditAmt = debitAmt.substring(1);
        }

        transactionList.push({
          date: epochDate,
          amount: creditAmt ? `(${creditAmt})` : debitAmt,
          merchant: `"${merchant}"`,
        });
      });

      return {
        transactionList,
        mostRecentDateWeveSeen,
      };
    }, 'table[id="sortTable"] > tbody > tr', this.configuredMostRecentTransactionDate, this.updatedMostRecentTransactionDate);

    // Set the mostRecentTransactionDate instance value
    this.updatedMostRecentTransactionDate = mostRecentDateWeveSeen;

    return transactionList;
  }

  getMostRecentTransactionDate() {
    return this.updatedMostRecentTransactionDate;
  }

  getRemainingBalance() {
    return this.remainingBalance;
  }
}

module.exports = PCMastercardPlugin;
