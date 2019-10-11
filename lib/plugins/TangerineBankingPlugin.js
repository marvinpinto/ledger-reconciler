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
    this.tangerineHttpRequest = this.tangerineHttpRequest.bind(this);
    this.nextTangerineOperation = this.nextTangerineOperation.bind(this);
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
  nextTangerineOperation(result) {
    let nextOperation = {
      url: null,
      command: null,
    };

    // Ignore anything other than plain old strings
    if (typeof result !== 'string') {
      return nextOperation;
    }

    const resMatch = result.match(/.*location.replace\("(.*)\?(.*)".*/);
    if (!resMatch) {
      return nextOperation;
    }

    const qs = querystring.parse(resMatch[2]);

    nextOperation.url = resMatch[1];
    nextOperation.command = qs.command;
    return nextOperation;
  }

  // istanbul ignore next
  async tangerineHttpRequest(args) {
    await this.randomSleep(500, 3000);
    this.logger.debug(
      `Initiating HTTP request: ${args.url}; Headers: ${JSON.stringify(args.headers)}; Body: ${args.body}; Method: ${
        args.method
      }`,
    );
    const res = await this.page.evaluate(async args => {
      const resp = await fetch(args.url, {
        credentials: 'include',
        headers: {
          Accept: 'application/json, text/plain, */*',
          'x-web-flavour': 'fbe',
          ...args.headers,
        },
        body: args.body ? args.body : undefined,
        method: args.method,
        mode: 'cors',
      });

      if (!resp.ok) {
        throw new Error(`HTTP error, status ${resp.status}`);
      }

      const body = await resp[args.responseType]();

      // Need to serialize the headers object as this is getting passed back
      // out of "page" context
      let headers = {};
      const keyVals = [...resp.headers.entries()];
      keyVals.forEach(([key, val]) => {
        headers[key] = val;
      });

      return {
        body,
        headers,
      };
    }, args);
    this.logger.debug(`HTTP response: ${JSON.stringify(res)}`);
    return res;
  }

  // istanbul ignore next
  async scraper() {
    let tResult;
    let nextOp;
    let loginSuccessful = false;
    const maxLoginAttempts = 10;
    let loginAttempts = 0;
    const tangerineUrlPrefix = 'https://secure.tangerine.ca';

    this.logger.debug('Initializing headless chrome');
    await this.initializeHeadlessChrome();

    this.logger.debug('Initiating Tangering login');
    await this.page.goto('https://www.tangerine.ca/app', {waitUntil: 'networkidle0'});
    await this.randomSleep(1000, 3000);

    // const pm_fp = await this.page.evaluate(() => window.encode_deviceprint());
    // if (!pm_fp) {
    //   throw new Error('Could not correctly determine pm_fp');
    // }
    // this.logger.debug(`pm_fp value: ${pm_fp}`);

    // const io_bb = await this.page.evaluate(() => window.ioGetBlackbox().blackbox);
    // if (!io_bb) {
    //   throw new Error('Could not correctly determine io_bb');
    // }
    // this.logger.debug(`io_bb value: ${io_bb}`);
    //
    // const fp_bb = await this.page.evaluate(() => window.fpGetBlackbox().blackbox);
    // if (!fp_bb) {
    //   throw new Error('Could not correctly determine fp_bb');
    // }
    // this.logger.debug(`fp_bb value: ${fp_bb}`);

    this.logger.debug('Logging in to Tangerine');
    tResult = await this.tangerineHttpRequest({
      url: `${tangerineUrlPrefix}/web/InitialTangerine.html?command=displayLogout&device=web&locale=en_CA`,
      method: 'GET',
      responseType: 'json',
    });

    tResult = await this.tangerineHttpRequest({
      url: `${tangerineUrlPrefix}/web/InitialTangerine.html?command=displayLoginRegular&device=web&locale=en_CA`,
      method: 'GET',
      responseType: 'json',
    });

    const transactionToken = _.get(tResult.headers, 'x-transaction-token', null);
    if (!transactionToken) {
      throw new Error('Expected result to contain the "x-transaction-token" error - cannot continue without it');
    }
    this.logger.debug(`Transaction token: ${transactionToken}`);

    while (loginAttempts < maxLoginAttempts) {
      loginAttempts++;
      nextOp = this.nextTangerineOperation(tResult.body);
      const nextCommandStr = _.get(tResult.body, 'MessageBody.Command', null);
      this.logger.debug(`Next operation: ${nextOp.command}, Next command: ${nextCommandStr}`);

      if (_.get(tResult.body, 'MessageBody.CIF', null)) {
        loginSuccessful = true;
        this.logger.debug('Successfully logged in');
        break;
      }

      if (nextCommandStr === 'PersonalCIF') {
        const data = new URLSearchParams();
        data.append('command', tResult.body.MessageBody.Command);
        data.append('locale', tResult.body.MessageBody.Locale);
        data.append('device', tResult.body.MessageBody.Device);
        // data.append('pm_fp', pm_fp);
        data.append('ACN', this.pluginArgs.username);
        tResult = await this.tangerineHttpRequest({
          url: `${tangerineUrlPrefix}${tResult.body.MessageBody.Action}`,
          method: 'POST',
          body: data.toString(),
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          },
          responseType: 'text',
        });
        continue;
      }

      if (nextCommandStr === 'verifyChallengeQuestion') {
        const securityQuestion = tResult.body.MessageBody.Question;
        this.logger.debug(`Security question: ${securityQuestion}`);
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

        const data = new URLSearchParams();
        data.append('command', tResult.body.MessageBody.Command);
        data.append('BUTTON', 'Next');
        data.append('Answer', answer);
        data.append('Next', 'Next');
        tResult = await this.tangerineHttpRequest({
          url: `${tangerineUrlPrefix}${tResult.body.MessageBody.Action}`,
          method: 'POST',
          body: data.toString(),
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          },
          responseType: 'text',
        });
        continue;
      }

      if (nextCommandStr === 'validatePINCommand') {
        const data = new URLSearchParams();
        data.append('locale', 'en_CA');
        data.append('command', tResult.body.MessageBody.Command);
        data.append('BUTTON', 'Go');
        data.append('PIN', this.pluginArgs.bankingWebsitePin);
        data.append('Go', 'Next');
        // data.append('fp_bb', fp_bb);
        // data.append('io_bb', io_bb);
        data.append('callSource', '4');
        tResult = await this.tangerineHttpRequest({
          url: `${tangerineUrlPrefix}${tResult.body.MessageBody.Action}`,
          method: 'POST',
          body: data.toString(),
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          },
          responseType: 'text',
        });
        continue;
      }

      if (nextOp.command) {
        // Candidates:
        // - displayLogin
        // - displayLoginRegular
        // - displayChallengeQuestion
        // - displayPIN
        // - PINPADPersonal
        // - displayAccountSummary

        if (nextOp.command === 'displayLogin') {
          nextOp.command = 'displayLoginRegular';
        }

        tResult = await this.tangerineHttpRequest({
          url: `${tangerineUrlPrefix}${nextOp.url}?command=${nextOp.command}`,
          method: 'GET',
          responseType: nextOp.command === 'PINPADPersonal' ? 'text' : 'json',
        });
        continue;
      }
    }

    if (!loginSuccessful) {
      throw new Error('Unable to log into your Tangerine account');
    }

    this.logger.debug('Retrieving a list of accounts');
    tResult = await this.tangerineHttpRequest({
      url: 'https://secure.tangerine.ca/web/rest/pfm/v1/accounts',
      method: 'GET',
      responseType: 'json',
      headers: {
        'x-transaction-token': transactionToken,
        'Accept-Language': 'en_CA',
      },
    });
    const accountObj = tResult.body.accounts.find(ele => {
      return ele.display_name === this.pluginArgs.accountNumber;
    });
    if (!accountObj) {
      throw new Error(`Could not find account ${this.pluginArgs.accountNumber} in the account list`);
    }
    this.remainingBalance = accountObj.account_balance;
    this.logger.debug(`Current balance for account "${accountObj.display_name}" is: ${this.remainingBalance}`);

    // Retrieve a list of all the authorized users under this account
    let accountIdentifiers = accountObj.number;
    tResult = await this.tangerineHttpRequest({
      url: `https://secure.tangerine.ca/web/rest/v1/accounts/${accountObj.number}`,
      method: 'GET',
      responseType: 'json',
      headers: {
        'x-transaction-token': transactionToken,
        'Accept-Language': 'en_CA',
      },
    });
    const authorizedUsers = _.get(tResult.body, 'account_summary.credit_card.cc_account_details.authorized_users', []);
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
    tResult = await this.tangerineHttpRequest({
      url: `https://secure.tangerine.ca/web/rest/pfm/v1/transactions?${querystring.stringify(qs)}`,
      method: 'GET',
      responseType: 'json',
      headers: {
        'x-transaction-token': transactionToken,
        'Accept-Language': 'en_CA',
      },
    });

    let transactions = [];
    let nextHref = _.get(tResult.body, 'links[0].href', null);

    // Handle paginated response
    while (nextHref != null) {
      transactions.push(...tResult.body.transactions);
      const nextURI = 'https://secure.tangerine.ca/web/rest' + nextHref;
      this.logger.debug(`Retrieving next page from ${nextURI}`);

      tResult = await this.tangerineHttpRequest({
        url: nextURI,
        method: 'GET',
        responseType: 'json',
        headers: {
          'x-transaction-token': transactionToken,
          'Accept-Language': 'en_CA',
        },
      });
      nextHref = _.get(tResult.body, 'links[0].href', null);
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
