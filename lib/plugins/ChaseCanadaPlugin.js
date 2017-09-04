const BasePlugin = require('./BasePlugin');

class ChaseCanadaPlugin extends BasePlugin {
  constructor(browser, logger, pluginArgs) {
    super(browser, logger, pluginArgs);

    if (!this.pluginArgs.username ||
        !this.pluginArgs.password ||
        !this.pluginArgs.securityAnswer) {
      throw new Error('You do not appear to have either the "username", "password", or "securityAnswer" keys set in your config file for the Chase Canada plugin.');
    }

    this.parseTransactionRows = this.parseTransactionRows.bind(this);
    this.getMostRecentTransactionDate = this.getMostRecentTransactionDate.bind(this);

    this.configuredMostRecentTransactionDate = (new Date('Jan 1 1970')).toDateString();
    this.updatedMostRecentTransactionDate = (new Date('Jan 1 1970')).toDateString();
    if (this.pluginArgs.mostRecentTransactionDate) {
      this.configuredMostRecentTransactionDate = (new Date(this.pluginArgs.mostRecentTransactionDate)).toDateString();
      this.updatedMostRecentTransactionDate = (new Date(this.pluginArgs.mostRecentTransactionDate)).toDateString();
    }
  }

  async scrapeTransactions() {
    const page = await this.browser.newPage();
    page.on('console', this.logger.debug);

    this.logger.debug('Initialing transaction download');

    // Bring up the Chase login page
    await page.goto('https://online.chasecanada.ca/ChaseCanada_Consumer/Login.do');

    // Fill in the username
    await page.click('input[name="username"]');
    await page.type(this.pluginArgs.username);

    // Fill in the password
    await page.click('input[name="password"]');
    await page.type(this.pluginArgs.password);

    // Click "Sign On"
    await page.click('body > table > tbody > tr > td > table:nth-child(1) > tbody > tr > td:nth-child(1) > table > tbody > tr:nth-child(10) > td > table > tbody > tr:nth-child(4) > td > input[type="submit"]');
    await page.waitForNavigation();

    // Fill in the answer to one of the security questions, if presented
    const securityAnswerField = await page.$('form[name="secondaryUserAuthForm"] input[name="hintanswer"]');
    if (securityAnswerField) {
      await securityAnswerField.click();
      await page.type(this.pluginArgs.securityAnswer);
      await page.click('input[type="submit"][name="submitNext"]');
      await page.waitForNavigation();
    }

    // Perform a basic sanity check to verify we're actually logged in
    const isLoggedIn = await page.evaluate((sel) => {
      const disputeText = document.querySelector(sel);
      if (disputeText && disputeText.innerHTML && disputeText.innerHTML.trim()) {
        console.log(`.dispute appears to be set with: ${disputeText.innerHTML.trim()}`);
        return false;
      }
      return true;
    }, 'tbody .dispute');
    if (!isLoggedIn) {
      await page.pdf({path: 'screenshot.pdf'});
      throw new Error('You do not appear to be logged in. Verify your logged in status by looking at screenshot.pdf. Please file a bug report if this is the result of a program error.');
    }
    this.logger.debug('Successfully logged in');

    // Get the current balance
    const currentBalanceRowSelector = 'body > table > tbody > tr:nth-child(2) > td.sideTable > table > tbody > tr:nth-child(14) > td > table > tbody > tr:nth-child(2) td';

    const currentBalance = await page.evaluate((sel) => {
      const tds = [...document.querySelectorAll(sel)];
      const label = tds[0];
      const value = tds[1];

      if (label && value && label.innerHTML === 'Current Balance' && value.innerHTML) {
        return value.innerHTML;
      }
      return null;
    }, currentBalanceRowSelector);
    this.logger.debug(`Current balance is: ${currentBalance}`);

    // Collate a list of all the statements available for download
    const availableStatements = await page.evaluate((sel) => {
      const rows = [...document.querySelectorAll(sel)];
      return rows.map((row) => {
        return row.getAttribute('value');
      });
    }, 'form[name="transHistoryForm"] select[name="cycleDate"] option');

    let transactions = [];

    for (let stmt of availableStatements) {
      this.logger.debug(`Now processing statement: ${stmt}`);

      // Select the current statement from the statement cycle list
      await page.evaluate((sel, stmt) => {
        document.querySelector(sel).value = stmt;
      }, 'form[name="transHistoryForm"] select[name="cycleDate"]', stmt);
      await page.click('form[name="transHistoryForm"] input[type="submit"]');
      await page.waitForNavigation();

      const tRows = await this.parseTransactionRows(page);
      transactions = [...transactions, ...tRows];
    }

    return transactions;
  }

  async parseTransactionRows(page) {
    // Parse the individual transaction entries in the displayed table
    const transactionTableSelector = 'body > table > tbody > tr:nth-child(2) > td:nth-child(2) > table > tbody > tr:nth-child(5) > td:nth-child(2) > table:nth-child(3) > tbody > tr.none > td > table > tbody > tr';

    const {transactionList, mostRecentDateWeveSeen} = await page.evaluate((sel, configuredMostRecentTransactionDate, updatedMostRecentTransactionDate) => {
      let transactionList = [];
      let mostRecentDateWeveSeen = new Date(updatedMostRecentTransactionDate);

      const rows = [...document.querySelectorAll(sel)];
      rows.forEach((row) => {
        const eles = [...row.querySelectorAll('td')];

        const rawDate = eles[0].innerHTML.replace(/&nbsp;/g, '').replace(/,/g, '');
        const epochDate = Date.parse(rawDate);
        // ignore any dates that can't be parsed - i.e. header rows
        if (!epochDate) {
          return;
        }
        const date = new Date(epochDate);

        // Discard this transaction if it is older than we care for
        if (date < new Date(configuredMostRecentTransactionDate)) {
          console.log(`Discarding transaction from ${date} as it is too old to process`);
          return;
        }

        // Make note of the most recent transaction date
        if (date >= mostRecentDateWeveSeen) {
          mostRecentDateWeveSeen = date;
        }

        const rawMerchant = eles[2] ? eles[2].querySelector('a') : null;
        const merchant = rawMerchant ? rawMerchant.innerHTML.replace(/&nbsp;/g, '').replace(/,/g, '') : null;

        const debitAmt = eles[3].innerHTML.replace(/&nbsp;/g, '').replace(/,/g, '');
        const creditAmt = eles[4].innerHTML.replace(/&nbsp;/g, '').replace(/,/g, '');

        transactionList.push({
          date: date.getTime(),
          amount: creditAmt ? `(${creditAmt})` : debitAmt,
          merchant: `"${merchant}"`,
        });
      });

      return {
        transactionList,
        mostRecentDateWeveSeen: mostRecentDateWeveSeen.toDateString(),
      };
    }, transactionTableSelector, this.configuredMostRecentTransactionDate, this.updatedMostRecentTransactionDate);

    // Set the mostRecentTransactionDate instance value
    this.updatedMostRecentTransactionDate = new Date(mostRecentDateWeveSeen);

    return transactionList;
  }

  getMostRecentTransactionDate() {
    return this.updatedMostRecentTransactionDate;
  }
}

module.exports = ChaseCanadaPlugin;
