/* global Event */

const BasePlugin = require('./BasePlugin');
const promiseRetry = require('promise-retry');

class TangerineBankingPlugin extends BasePlugin {
  constructor(browser, logger, pluginArgs) {
    super(browser, logger, pluginArgs);

    if (!this.pluginArgs.username) {
      throw new Error('You do not appear to have the "username" key set in your config file for the Tangerine Banking plugin.');
    }

    if (!this.pluginArgs.bankingWebsitePin) {
      throw new Error('You do not appear to have the "bankingWebsitePin" key set in your config file for the Tangerine Banking plugin.');
    }

    if (!this.pluginArgs.accountNumber) {
      throw new Error('You do not appear to have the "accountNumber" key set in your config file for the Tangerine Banking plugin.');
    }

    if (!this.pluginArgs.securityQuestions || !this.pluginArgs.securityQuestions.length) {
      throw new Error('You do not appear to have the "securityQuestions" key set in your config file for the Tangerine Banking plugin.');
    }

    this.parseTransactionRows = this.parseTransactionRows.bind(this);
    this.getMostRecentTransactionDate = this.getMostRecentTransactionDate.bind(this);
    this.fillInSecurityAnswers = this.fillInSecurityAnswers.bind(this);

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

    this.logger.debug('Initializng Tangerine Login');

    // Bring up the Tangerine Banking login page
    await this.page.goto('https://www.tangerine.ca/app', {waitUntil: 'networkidle'});
    await this.page.waitForFunction(() => {
      // Wait until both the client ID field & Log Me In button is available
      const inputField = document.querySelector('input[id="login_clientId"]');
      const loginBtn = document.querySelector('button[id="login_logMeIn"]');
      return !!inputField && !!loginBtn;
    });

    // Fill in the username
    await this.page.click('input[id="login_clientId"]');
    await this.page.type(this.pluginArgs.username, {delay: 30});
    await this.page.click('button[id="login_logMeIn"]');
    await this.page.waitForNavigation({waitUntil: 'networkidle'});

    // Fill in any security answers if prompted. Do this until we are logged in
    // (determined by the "orangeKeyString" value). If we haven't succeeded in
    // logging in after trying for 5 times, throw an error and let the user know.
    try {
      await promiseRetry(async (retry, number) => {
        this.logger.debug(`Attempt #${number} at filling in security answers`);

        try {
          // Fill in any security answers, if needed
          await this.fillInSecurityAnswers();

          await this.page.waitForFunction(() => {
            // Wait until the submit button is available
            const orangeKeyField = document.querySelector('.c-quick-access p.orange-key');
            return !!orangeKeyField && orangeKeyField.innerText.trim() === 'Orange Key';
          }, {timeout: 1000});
        } catch (error) {
          retry();
        }
      }, {retries: 5});
    } catch (error) {
      await this.page.pdf({path: 'screenshot.pdf'});
      this.logger.debug(`Encountered error: ${error}`);
      throw new Error('You do not appear to be logged in. Verify your logged in status by looking at screenshot.pdf. Please file a bug report if this is the result of a program error.');
    }

    // Click on the account name specified by the user
    const accountNameSelector = `account-card[id="accountSection_account_${this.pluginArgs.accountNumber}"] a[id="account-card-link"]`;
    await this.page.waitForFunction((accountNameSelector) => {
      // Wait until the account name is available
      return !!document.querySelector(accountNameSelector);
    }, {}, accountNameSelector);
    await this.page.click(accountNameSelector);
    await this.page.waitForNavigation({waitUntil: 'networkidle'});

    // Get the current balance
    const currentBalance = await this.page.$eval('.c-account-details__container .c-account-details__balance', (el) => el.innerText.trim());
    this.remainingBalance = currentBalance;
    this.logger.debug(`Current balance is: ${this.remainingBalance}`);

    // Select all transactions within the last 12 months
    await this.page.evaluate(() => {
      document.querySelector('select[id="transactionFilters_typeSelect"] > option[value="allTransactions"]').selected = true;
      const ele = document.querySelector('select[id="transactionFilters_typeSelect"]');
      let evt = new Event('change', {bubbles: true});
      evt.simulated = true;
      ele.dispatchEvent(evt);
    });
    await this.page.evaluate(() => {
      document.querySelector('select[id="transactionFilters_dateSelect"] > option[value="last12months"]').selected = true;
      const ele = document.querySelector('select[id="transactionFilters_dateSelect"]');
      let evt = new Event('change', {bubbles: true});
      evt.simulated = true;
      ele.dispatchEvent(evt);
    });
    await this.page.waitForNavigation({waitUntil: 'networkidle'});

    // Parse the individual transaction entries in the displayed table
    const transactions = await this.parseTransactionRows();
    return transactions;
  }

  // istanbul ignore next
  async parseTransactionRows() {
    // Parse the individual transaction entries in the displayed table
    const {transactionList, mostRecentDateWeveSeen} = await this.page.evaluate((configuredMostRecentTransactionDate, updatedMostRecentTransactionDate) => {
      let transactionList = [];
      let mostRecentDateWeveSeen = updatedMostRecentTransactionDate;

      const rows = [...document.querySelectorAll('.c-transactions-list__list .c-transactions-list__tile')];
      rows.forEach((row) => {
        const rawDate = row.querySelector('tng-transaction-date-column .print-only-block > span').innerText.trim();
        const epochDate = Date.parse(rawDate);

        // ignore any dates that can't be parsed - i.e. header rows
        if (isNaN(epochDate)) {
          return;
        }

        // Discard this transaction if it is older than we care for
        if (epochDate <= configuredMostRecentTransactionDate) {
          console.debug(`Discarding transaction from ${epochDate} as it is too old to process`);
          return;
        }
        console.debug(`Processing transaction from ${epochDate}`);

        // Make note of the most recent transaction date
        if (epochDate >= mostRecentDateWeveSeen) {
          mostRecentDateWeveSeen = epochDate;
        }

        const merchant = row.querySelector('.c-transactions-list__transaction .c-transactions-list__title').innerText.trim();
        const amount = row.querySelector('tng-transaction-amount-column .c-transactions-list__amount-column > span > span').innerText.trim();

        // Inverse the amount in order to accomodate the Ledger reports (i.e.
        // use the negative of the stated amount)
        let creditAmt;
        const debitAmt = amount;
        if (row.querySelector('.c-transactions-list__amount-column--positive')) {
          creditAmt = amount;
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
    }, this.configuredMostRecentTransactionDate, this.updatedMostRecentTransactionDate);

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

  // istanbul ignore next
  async fillInSecurityAnswers() {
    // Fill in the PIN, if asked
    const pinEntryField = await this.page.$('input[id="login_pin"]');
    if (pinEntryField) {
      await pinEntryField.click();
      await this.page.type(this.pluginArgs.bankingWebsitePin, {delay: 30});
      await this.page.waitForFunction(() => {
        // Wait until the submit button is available
        const btn = document.querySelector('button[type="submit"][id="login_signIn"]');
        return !!btn;
      });
      await this.page.click('button[type="submit"][id="login_signIn"]');
      await this.page.waitForNavigation({waitUntil: 'networkidle'});
    }

    // Fill in the answer to one of the security questions, if asked
    const securityQuestionField = await this.page.$('#login_secretQuestion_label');
    if (securityQuestionField) {
      const securityQuestion = await securityQuestionField.evaluate((el) => el.innerText.trim());

      // Search the 'securityQuestions' key for the question presented on screen
      const question = this.pluginArgs.securityQuestions.find((element) => {
        const re = new RegExp(securityQuestion, 'i');
        const resultMatch = element.question.match(re);
        return !!resultMatch;
      });

      if (question) {
        await this.page.click('input[id="login_secretQuestion"]');
        await this.page.type(question.answer, {delay: 30});
        await this.page.waitForFunction(() => {
          // Wait until the submit button is available
          const btn = document.querySelector('button[id="login_Next"]');
          return !!btn;
        });
        await this.page.click('button[id="login_Next"]');
        await this.page.waitForNavigation({waitUntil: 'networkidle'});
      }
    }
  }
}

module.exports = TangerineBankingPlugin;
