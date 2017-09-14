const BasePlugin = require('./BasePlugin');

class TangerineBankingPlugin extends BasePlugin {
  constructor(browser, logger, pluginArgs) {
    super(browser, logger, pluginArgs);

    if (!this.pluginArgs.username) {
      throw new Error('You do not appear to have the "username" key set in your config file for the Tangerine Banking plugin.');
    }

    if (!this.pluginArgs.bankingWebsitePin) {
      throw new Error('You do not appear to have the "bankingWebsitePin" key set in your config file for the Tangerine Banking plugin.');
    }

    if (!this.pluginArgs.accountName) {
      throw new Error('You do not appear to have the "accountName" key set in your config file for the Tangerine Banking plugin.');
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
    const page = await this.browser.newPage();
    page.on('console', this.logger.debug);

    this.logger.debug('Initialing transaction download');

    // Bring up the Tangerine Banking login page
    await page.goto('https://secure.tangerine.ca/web/InitialTangerine.html?command=displayLogin&device=web&locale=en_CA');

    // Fill in the username
    await page.click('input[id="ACN"]');
    await page.type(this.pluginArgs.username);
    await page.click('button[id="GoBtn"]');
    await page.waitForNavigation();

    // Fill in any security answers if prompted. Do this until we are logged in
    // (determined by the "orangeKeyString" value). If we haven't succeeded in
    // logging in after trying for 5 times, throw an error and let the user know.
    // let orangeKeyString;
    let isLoggedIn = false;
    for (let i=0; i<5; i++) {
      this.logger.debug(`Attempt #${i+1} at filling in security answers`);
      const orangeKeyStringField = await page.$('#sidebar-left > div:nth-child(2) > div > div > div');
      if (orangeKeyStringField) {
        const orangeKeyString = await orangeKeyStringField.evaluate((el) => el.innerText.trim());
        const resultMatch = orangeKeyString.match(/your orange key is/i);
        if (resultMatch) {
          isLoggedIn = true;
          break;
        }
      }

      // Fill in any security answers, if needed
      await this.fillInSecurityAnswers(page);
    }

    if (!isLoggedIn) {
      await page.pdf({path: 'screenshot.pdf'});
      throw new Error('You do not appear to be logged in. Verify your logged in status by looking at screenshot.pdf. Please file a bug report if this is the result of a program error.');
    }

    // Click on the account name specified by the user
    const tangerineAccounts = await page.$$('td[data-title="Account name"] a');
    if (!tangerineAccounts.length) {
      await page.pdf({path: 'screenshot.pdf'});
      throw new Error('Could not find any account names on the Tangerine page. Verify your logged in status by looking at screenshot.pdf. Please file a bug report if this is the result of a program error.');
    }
    for (let account of tangerineAccounts) {
      const accountName = await account.evaluate((el) => el.innerText.trim());
      if (accountName === this.pluginArgs.accountName) {
        await account.click();
        await page.waitForNavigation();
        break;
      }
    }

    // Get the current balance
    const currentBalanceSelector = 'header.account-details-header div.account-details-amount-section .amount-superBold';
    const currentBalance = await page.$eval(currentBalanceSelector, (el) => el.innerText.trim());
    this.remainingBalance = currentBalance;
    this.logger.debug(`Current balance is: ${this.remainingBalance}`);

    // Select all transactions within the last 12 months
    await page.$eval('form[name="myForm"] #transaction-TypeList select[id="TypeList"]', (el) => {
      el.value = 'ALL';
    });
    await page.$eval('form[name="myForm"] #transaction-DateRangeList select[id="DateRangeList"]', (el) => {
      el.value = 'L12M';
    });
    await page.click('form[name="myForm"] button[type="submit"][name="Go"]');
    await page.waitForNavigation();

    let transactions = [];
    while (true) { // eslint-disable-line no-constant-condition
      const currentPage = await page.$eval('#transactionTable > ul > li.active a', (el) => el.innerText.trim());
      this.logger.debug(`Processing page ${currentPage}`);

      // Parse the individual transaction entries in the displayed table
      const tRows = await this.parseTransactionRows(page, currentPage);
      transactions = [...transactions, ...tRows];

      const nextPageIndicator = await page.$('#transactionTable > ul > li.active + li');
      if (!nextPageIndicator) {
        this.logger.debug(`Last page (page ${currentPage})`);
        break;
      }

      // Proceed to the next page
      await page.click('#transactionTable > ul > li.active + li > a');
      await page.waitForFunction((sel, currentPage) => {
        // Wait until the selected active page is not the page that we were
        // previously on
        const currentlyActivePage = document.querySelector(sel);
        return !!currentlyActivePage && currentlyActivePage.innerText.trim() !== currentPage;
      }, {}, '#transactionTable > ul > li.active > a', currentPage);
    }

    return transactions;
  }

  // istanbul ignore next
  async parseTransactionRows(page, currentPageNumber) {
    // Parse the individual transaction entries in the displayed table
    const {transactionList, mostRecentDateWeveSeen} = await page.evaluate((sel, configuredMostRecentTransactionDate, updatedMostRecentTransactionDate) => {
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
    }, `table[data-target="#transactionTable"] > tbody > tr[data-page="${currentPageNumber}"]`, this.configuredMostRecentTransactionDate, this.updatedMostRecentTransactionDate);

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
  async fillInSecurityAnswers(page) {
    // Fill in the PIN, if asked
    const pinEntryField = await page.$('input[id="PIN"]');
    if (pinEntryField) {
      await pinEntryField.click();
      await page.type(this.pluginArgs.bankingWebsitePin);
      await page.click('button[type="submit"][name="Go"]');
      await page.waitForNavigation();
    }

    // Fill in the answer to one of the security questions, if asked
    const securityQuestionField = await page.$('#ChallengeQuestion > div.content-main-wrapper > p');
    if (securityQuestionField) {
      const securityQuestion = await securityQuestionField.evaluate((el) => el.innerText.trim());

      // Search the 'securityQuestions' key for the question presented on screen
      const question = this.pluginArgs.securityQuestions.find((element) => {
        const re = new RegExp(securityQuestion, 'i');
        const resultMatch = element.question.match(re);
        return !!resultMatch;
      });

      if (question) {
        await page.click('input[id="Answer"]');
        await page.type(question.answer);
        await page.click('button[id="Next"]');
        await page.waitForNavigation();
      }
    }
  }
}

module.exports = TangerineBankingPlugin;
