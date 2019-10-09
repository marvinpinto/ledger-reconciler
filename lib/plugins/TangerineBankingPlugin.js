const BasePlugin = require('./BasePlugin');
const _ = require('lodash');
const querystring = require('querystring');

class TangerineBankingPlugin extends BasePlugin {
  constructor(browser, logger, pluginArgs) {
    super(browser, logger, pluginArgs);

    if (!this.pluginArgs.username) {
      throw new Error(
        'You do not appear to have the "username" key set in your config file for the Tangerine Banking plugin.',
      );
    }

    if (!this.pluginArgs.bankingWebsitePin) {
      throw new Error(
        'You do not appear to have the "bankingWebsitePin" key set in your config file for the Tangerine Banking plugin.',
      );
    }

    if (!this.pluginArgs.accountNumber) {
      throw new Error(
        'You do not appear to have the "accountNumber" key set in your config file for the Tangerine Banking plugin.',
      );
    }

    if (!this.pluginArgs.securityQuestions || !this.pluginArgs.securityQuestions.length) {
      throw new Error(
        'You do not appear to have the "securityQuestions" key set in your config file for the Tangerine Banking plugin.',
      );
    }

    this.parseTransactionRows = this.parseTransactionRows.bind(this);
    this.getMostRecentTransactionDate = this.getMostRecentTransactionDate.bind(this);
    this.scraper = this.scraper.bind(this);

    this.configuredMostRecentTransactionDate = 0;
    this.updatedMostRecentTransactionDate = 0;
    if (this.pluginArgs.mostRecentTransactionDate) {
      this.configuredMostRecentTransactionDate = this.pluginArgs.mostRecentTransactionDate;
      this.updatedMostRecentTransactionDate = this.pluginArgs.mostRecentTransactionDate;
    }

    this.remainingBalance = 'undefined';
    this.getTangerineDateFormat = this.getTangerineDateFormat.bind(this);
  }

  // istanbul ignore next
  getTangerineDateFormat(date) {
    // Should output something like: 2018-04-15T00:00:00.000
    let dateStr = '';
    dateStr += date.getFullYear().toString();

    const month = date.getMonth() + 1;
    dateStr += '-' + month.toString().padStart(2, '0');

    dateStr +=
      '-' +
      date
        .getDate()
        .toString()
        .padStart(2, '0');
    dateStr +=
      'T' +
      date
        .getHours()
        .toString()
        .padStart(2, '0');
    dateStr +=
      ':' +
      date
        .getMinutes()
        .toString()
        .padStart(2, '0');
    dateStr +=
      ':' +
      date
        .getSeconds()
        .toString()
        .padStart(2, '0');
    dateStr += '.000';

    return dateStr;
  }

  // istanbul ignore next
  async scrapeTransactions() {
    try {
      const transactions = await this.scraper();
      return transactions;
    } catch (error) {
      await this.generateDebugScreenshot();
      throw error;
    }
  }

  // istanbul ignore next
  async scraper() {
    let tResult;
    let input;
    this.logger.debug('Initializing headless chrome');
    await this.initializeHeadlessChrome();

    this.logger.debug('Initiating Tangering login');
    await this.page.goto('https://www.tangerine.ca/app/#/?locale=en_CA', {waitUntil: 'networkidle0'});

    // Fill in the username
    this.logger.debug('Filling in username');
    input = await this.page.$('input[id="login_clientId"]');
    await input.type(this.pluginArgs.username, {delay: 100});
    await input.press('Enter');

    this.logger.debug('Awaiting security question');
    const securityQuestion = await this.getSelectorValue('label[id="login_secretQuestion_label"]');
    // Search the 'securityQuestions' key for the question presented
    const questionObj = this.pluginArgs.securityQuestions.find(element => {
      const re = new RegExp(securityQuestion, 'i');
      const resultMatch = element.question.match(re);
      return Boolean(resultMatch);
    });
    if (!questionObj) {
      throw new Error(`Could not find an answer to security question: ${securityQuestion}`);
    }
    // Tangerine seemingly disregards everything after the first 40 chars
    const answer = questionObj.answer.substring(0, 40);
    this.logger.debug(`Answering security question: ${securityQuestion}`);
    input = await this.page.$('input[id="login_secretQuestion"]');
    await input.type(answer, {delay: 100});
    await input.press('Enter');

    const pinPhrase = await this.getSelectorValue('#login_pin_phrase');
    this.logger.debug(`Entering in PIN for phrase: ${pinPhrase}`);
    input = await this.page.$('input[id="login_pin"]');
    await input.type(this.pluginArgs.bankingWebsitePin, {delay: 100});
    await input.press('Enter');
    const orangeKeySelector = await this.getSelectorValue('.orange-key');
    if (orangeKeySelector !== 'Orange Key') {
      throw new Error('Tangerine login did not appear to work successfully ("Orange Key" selector could not be found)');
    }

    this.logger.debug('Retrieving a list of accounts');
    tResult = await this.page.goto('https://secure.tangerine.ca/web/rest/pfm/v1/accounts', {waitUntil: 'networkidle0'});
    tResult = await tResult.json();
    const accountObj = tResult.accounts.find(ele => {
      return ele.display_name === this.pluginArgs.accountNumber;
    });
    if (!accountObj) {
      throw new Error(`Could not find account ${this.pluginArgs.accountNumber} in the account list`);
    }
    this.remainingBalance = accountObj.account_balance;
    this.logger.debug(`Current balance for account "${accountObj.display_name}" is: ${this.remainingBalance}`);

    // Retrieve a list of all the authorized users under this account
    let accountIdentifiers = accountObj.number;
    tResult = await this.page.goto(`https://secure.tangerine.ca/web/rest/v1/accounts/${accountObj.number}`);
    tResult = await tResult.json();
    const authorizedUsers = _.get(tResult, 'account_summary.credit_card.cc_account_details.authorized_users', []);
    authorizedUsers.forEach(user => {
      this.logger.debug(`Found additional authorized card ${user.card_number_display_name}`);
      accountIdentifiers += `,${user.card_number}`;
    });

    const now = new Date();
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(now.getMonth() - 12);
    this.logger.debug(`Retrieving transactions going back to ${twelveMonthsAgo.toISOString()}`);
    const qs = {
      accountIdentifiers: accountIdentifiers,
      hideAuthorizedStatus: true,
      periodFrom: this.getTangerineDateFormat(twelveMonthsAgo),
      periodTo: this.getTangerineDateFormat(now),
      skip: 0,
    };
    tResult = await this.page.goto(
      `https://secure.tangerine.ca/web/rest/pfm/v1/transactions?${querystring.stringify(qs)}`,
    );
    tResult = await tResult.json();

    let transactions = [];
    let nextHref = _.get(tResult, 'links[0].href', null);

    // Handle paginated response
    while (nextHref != null) {
      transactions.push(...tResult.transactions);
      const nextURI = 'https://secure.tangerine.ca/web/rest' + nextHref;
      this.logger.debug(`Retrieving next page from ${nextURI}`);

      tResult = await this.page.goto(nextURI);
      tResult = await tResult.json();
      nextHref = _.get(tResult, 'links[0].href', null);
    }

    // Parse the individual transaction entries in the result
    return this.parseTransactionRows(transactions);
  }

  // istanbul ignore next
  parseTransactionRows(transactions) {
    let transactionList = [];

    transactions.forEach(transaction => {
      const epochDate = Date.parse(transaction.transaction_date);

      // Discard this transaction if it is older than we care for
      if (epochDate <= this.configuredMostRecentTransactionDate) {
        this.logger.debug(`Discarding transaction from ${epochDate} as it is too old to process`);
        return;
      }
      this.logger.debug(`Processing transaction from ${epochDate}`);

      // Make note of the most recent transaction date
      if (epochDate >= this.updatedMostRecentTransactionDate) {
        this.updatedMostRecentTransactionDate = epochDate;
      }

      // Format the amount to accomodate the Ledger reports
      let amount = '(' + transaction.amount.toString() + ')';
      if (transaction.amount < 0) {
        transaction.amount = transaction.amount * -1;
        amount = transaction.amount.toString();
      }

      transactionList.push({
        date: epochDate,
        amount,
        merchant: transaction.description,
      });
    });

    return transactionList;
  }

  getMostRecentTransactionDate() {
    return this.updatedMostRecentTransactionDate;
  }

  getRemainingBalance() {
    return this.remainingBalance;
  }
}

module.exports = TangerineBankingPlugin;
