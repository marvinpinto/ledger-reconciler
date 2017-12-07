const BasePlugin = require('./BasePlugin');

class AMEXPlugin extends BasePlugin {
  constructor(browser, logger, pluginArgs) {
    super(browser, logger, pluginArgs);

    if (!this.pluginArgs.username) {
      throw new Error('You do not appear to have either the "username" key set in your config file for the American Express plugin.');
    }

    if (!this.pluginArgs.password) {
      throw new Error('You do not appear to have either the "password" key set in your config file for the American Express plugin.');
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

    // Bring up the American Express login page
    await this.page.goto('https://global.americanexpress.com/myca/logon/canlac/action/LogonHandler?request_type=LogonHandler&Face=en_CA&inav=ca_utility_login');

    // Fill in the username
    await this.page.click('input[id="lilo_userName"]');
    await this.page.type(this.pluginArgs.username);

    // Fill in the password
    await this.page.click('input[id="lilo_password"]');
    await this.page.type(this.pluginArgs.password);

    // Click "Log In"
    await this.page.click('input[id="lilo_formSubmit"]');
    await this.page.waitForNavigation();
    this.logger.debug('Successfully logged in');

    // Simulate clicking "Your Statement" -> "View Statement Activity"
    await this.page.goto('https://global.americanexpress.com/myca/intl/istatement/canlac/statement.do?Face=en_CA&method=displayStatement');
    const currentBalanceSelector = '#balanceSummary > div.block > div.balance-summary-first > div.balance';
    await this.page.waitForFunction((currentBalanceSelector) => {
      // Wait until the balance summary is available
      return !!document.querySelector(currentBalanceSelector);
    }, {}, currentBalanceSelector);

    // Get the current balance
    const currentBalance = await this.page.$eval(currentBalanceSelector, (el) => el.innerText.trim().replace(/ /g, ''));
    this.remainingBalance = currentBalance;
    this.logger.debug(`Current balance is: ${this.remainingBalance}`);

    // Click "Date Range" -> "Year to Date"
    await this.page.click('#daterange');
    await this.page.click('#dateRangeContainer > div.filterMenu div[title="Year to Date"]');
    await this.page.waitForNavigation({waitUntil: 'networkidle'});

    // Parse the individual transaction entries in the displayed table
    const transactions = await this.parseTransactionRows();
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

        const rawDate = eles[0].innerText.trim();
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

        const merchant = eles[1].innerText.trim();

        let creditAmt;
        const debitAmt = eles[2].innerText.trim();
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
    }, 'table[id="transaction-table"] > tbody > tr', this.configuredMostRecentTransactionDate, this.updatedMostRecentTransactionDate);

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

module.exports = AMEXPlugin;
