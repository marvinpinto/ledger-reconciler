const BasePlugin = require('./BasePlugin');
const rp = require('request-promise-native');

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

    this.configuredMostRecentTransactionDate = 0;
    this.updatedMostRecentTransactionDate = 0;
    if (this.pluginArgs.mostRecentTransactionDate) {
      this.configuredMostRecentTransactionDate = this.pluginArgs.mostRecentTransactionDate;
      this.updatedMostRecentTransactionDate = this.pluginArgs.mostRecentTransactionDate;
    }

    this.remainingBalance = 'undefined';

    this.tangerineGetRequest = this.tangerineGetRequest.bind(this);
    this.tangerinePostRequest = this.tangerinePostRequest.bind(this);
    this.cookieJar = rp.jar();
    this.getTangerineDateFormat = this.getTangerineDateFormat.bind(this);
  }

  // istanbul ignore next
  getTangerineDateFormat(date) {
    // Should output something like: 2018-04-15T00:00:00.000
    let dateStr = '';
    dateStr += date.getFullYear().toString();

    const month = date.getMonth() + 1;
    dateStr += '-' + month.toString().padStart(2, '0');

    dateStr += '-' + date.getDate().toString().padStart(2, '0');
    dateStr += 'T' + date.getHours().toString().padStart(2, '0');
    dateStr += ':' + date.getMinutes().toString().padStart(2, '0');
    dateStr += ':' + date.getSeconds().toString().padStart(2, '0');
    dateStr += '.000';

    return dateStr;
  }

  // istanbul ignore next
  async tangerineGetRequest(args) {
    await this.sleep(100);
    const defaultArgs = {
      method: 'GET',
      uri: args.uri,
      qs: {
        device: 'web',
        locale: 'en_CA',
        ...args.qs,
      },
      headers: {
        'x-web-flavour': 'fbe',
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36',
      },
      json: true,
      jar: this.cookieJar,
      resolveWithFullResponse: true,
    };
    const result = await rp(defaultArgs);
    return result.body;
  }

  // istanbul ignore next
  async tangerinePostRequest(args) {
    await this.sleep(100);
    const defaultArgs = {
      method: 'POST',
      uri: args.uri,
      form: {
        ...args.form,
      },
      headers: {
        'x-web-flavour': 'fbe',
        Accept: 'application/json, text/plain, */*',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36',
      },
      jar: this.cookieJar,
      resolveWithFullResponse: true,
    };
    const result = await rp(defaultArgs);
    return result.body;
  }

  // istanbul ignore next
  async scrapeTransactions() {
    let tResult;
    this.logger.debug('Initiating Tangering login');
    await this.tangerineGetRequest({
      uri: 'https://secure.tangerine.ca/web/InitialTangerine.html',
      qs: {
        command: 'displayLogout',
      },
    });
    await this.tangerineGetRequest({
      uri: 'https://secure.tangerine.ca/web/InitialTangerine.html',
      qs: {
        command: 'displayLoginRegular',
      },
    });

    await this.tangerinePostRequest({
      uri: 'https://secure.tangerine.ca/web/Tangerine.html',
      form: {
        command: 'PersonalCIF',
        ACN: this.pluginArgs.username,
        device: 'web',
        locale: 'en_CA',
      },
    });

    tResult = await this.tangerineGetRequest({
      uri: 'https://secure.tangerine.ca/web/Tangerine.html',
      qs: {
        command: 'displayChallengeQuestion',
      },
    });
    const securityQuestion = tResult.MessageBody.Question;

    // Search the 'securityQuestions' key for the question presented
    const questionObj = this.pluginArgs.securityQuestions.find((element) => {
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

    tResult = await this.tangerinePostRequest({
      uri: 'https://secure.tangerine.ca/web/Tangerine.html',
      form: {
        command: 'verifyChallengeQuestion',
        BUTTON: 'Next',
        Answer: answer,
        Next: 'Next',
      },
    });

    tResult = await this.tangerineGetRequest({
      uri: 'https://secure.tangerine.ca/web/Tangerine.html',
      qs: {
        command: 'displayPIN',
      },
    });
    const pinPhrase = tResult.MessageBody.Phrase;
    this.logger.debug(`Entering in PIN for phrase: ${pinPhrase}`);

    await this.tangerinePostRequest({
      uri: 'https://secure.tangerine.ca/web/Tangerine.html',
      form: {
        locale: 'en_CA',
        command: 'validatePINCommand',
        BUTTON: 'Go',
        PIN: this.pluginArgs.bankingWebsitePin,
        Go: 'Next',
        callSource: '4',
      },
    });

    await this.tangerineGetRequest({
      uri: 'https://secure.tangerine.ca/web/Tangerine.html',
      qs: {
        command: 'PINPADPersonal',
      },
    });

    tResult = await this.tangerineGetRequest({
      uri: 'https://secure.tangerine.ca/web/Tangerine.html',
      qs: {
        command: 'displayAccountSummary',
        fill: 1,
      },
    });

    this.logger.debug('Successfully logged in');

    // Get the current balance for the specified account
    tResult = await this.tangerineGetRequest({
      uri: 'https://secure.tangerine.ca/web/rest/pfm/v1/accounts',
      qs: {},
    });

    const accountObj = tResult.accounts.find((ele) => {
      return ele.display_name === this.pluginArgs.accountNumber;
    });
    if (!accountObj) {
      throw new Error(`Could not find account ${this.pluginArgs.accountNumber} in the account list`);
    }
    this.remainingBalance = accountObj.account_balance;
    this.logger.debug(`Current balance for account "${accountObj.nickname}" is: ${this.remainingBalance}`);

    const now = new Date();
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(now.getMonth() - 12);
    this.logger.debug(`Retrieving transactions going back to ${twelveMonthsAgo.toISOString()}`);

    tResult = await this.tangerineGetRequest({
      uri: 'https://secure.tangerine.ca/web/rest/pfm/v1/transactions',
      qs: {
        accountIdentifiers: accountObj.number,
        hideAuthorizedStatus: true,
        periodFrom: this.getTangerineDateFormat(twelveMonthsAgo),
        periodTo: this.getTangerineDateFormat(now),
        skip: 0,
      },
    });

    let transactions = [];

    // Handle paginated response
    while (tResult.transactions.length > 0) {
      transactions.push(...tResult.transactions);
      const nextURI = 'https://secure.tangerine.ca/web/rest' + tResult.links[0].href;

      this.logger.debug(`Retrieving next page from ${nextURI}`);

      tResult = await this.tangerineGetRequest({
        uri: nextURI,
      });
    }

    // Parse the individual transaction entries in the result
    return this.parseTransactionRows(transactions);
  }

  // istanbul ignore next
  parseTransactionRows(transactions) {
    let transactionList = [];

    transactions.forEach((transaction) => {
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
