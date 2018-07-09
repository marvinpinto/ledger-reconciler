const BasePlugin = require('./BasePlugin');
const rp = require('request-promise-native');
const _ = require('lodash');

class PrestocardPlugin extends BasePlugin {
  constructor(browser, logger, pluginArgs) {
    super(browser, logger, pluginArgs);

    if (!this.pluginArgs.username) {
      throw new Error('You do not appear to have the "username" key set in your config file for the Prestocard plugin.');
    }

    if (!this.pluginArgs.password) {
      throw new Error('You do not appear to have the "password" key set in your config file for the Prestocard plugin.');
    }

    this.parseTransactionRows = this.parseTransactionRows.bind(this);
    this.getMostRecentTransactionDate = this.getMostRecentTransactionDate.bind(this);

    this.configuredMostRecentTransactionDate = 0;
    this.updatedMostRecentTransactionDate = 0;
    if (this.pluginArgs.mostRecentTransactionDate) {
      this.configuredMostRecentTransactionDate = this.pluginArgs.mostRecentTransactionDate;
      this.updatedMostRecentTransactionDate = this.pluginArgs.mostRecentTransactionDate;
    }

    this.configuredTransitUsageReportYear = new Date().getFullYear();
    if (this.pluginArgs.transitUsageReportYear) {
      this.configuredTransitUsageReportYear = this.pluginArgs.transitUsageReportYear;
    }

    this.remainingBalance = 'undefined';

    this.retrievePrestoCSRFToken = this.retrievePrestoCSRFToken.bind(this);
    this.prestocardGetRequest = this.prestocardGetRequest.bind(this);
    this.prestocardPostRequest = this.prestocardPostRequest.bind(this);
    this.cookieJar = rp.jar();
  }

  // istanbul ignore next
  async prestocardGetRequest(args) {
    await this.sleep(100);
    const defaultArgs = {
      method: 'GET',
      uri: args.uri,
      jar: this.cookieJar,
      resolveWithFullResponse: true,
    };
    const result = await rp(defaultArgs);
    return result.body;
  }

  // istanbul ignore next
  async prestocardPostRequest(args) {
    await this.sleep(100);
    const defaultArgs = {
      method: 'POST',
      uri: args.uri,
      body: {
        ...args.body,
      },
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36',
        ...args.headers,
      },
      jar: this.cookieJar,
      resolveWithFullResponse: true,
      json: true,
    };
    const result = await rp(defaultArgs);
    return result.body;
  }

  // istanbul ignore next
  async retrievePrestoCSRFToken(args) {
    this.logger.debug('Retrieving Prestocard CSRF token');
    const tResult = await this.prestocardGetRequest({
      uri: args.pageUrl,
    });
    await this.page.goto(`data:text/html,${tResult}`, {waitUntil: 'networkidle0'});
    const csrfToken = await this.page.$eval(args.selector, (el) => el.value);
    this.logger.debug(`Retrieved CSRF Token: ${csrfToken}`);
    return csrfToken;
  }

  // istanbul ignore next
  async scrapeTransactions() {
    this.page = await this.browser.newPage();
    this.page.on('console', (msg) => this.logger.debug(msg.text()));

    let tResult;
    let csrfToken;
    let transactionList = [];

    this.logger.debug('Initiating Prestocard login');
    csrfToken = await this.retrievePrestoCSRFToken({
      pageUrl: 'https://www.prestocard.ca/home',
      selector: '#signwithaccount input[name="__RequestVerificationToken"]',
    });
    const loginResult = await this.prestocardPostRequest({
      uri: 'https://www.prestocard.ca/api/sitecore/AFMSAuthentication/SignInWithAccount',
      headers: {
        __RequestVerificationToken: csrfToken,
      },
      body: {
        anonymousOrderACard: false,
        custSecurity: {
          Login: this.pluginArgs.username,
          Password: this.pluginArgs.password,
        },
      },
    });
    tResult = _.get(loginResult, 'Result', null);
    if (tResult !== 'success') {
      throw new Error(`There appears to be an error logging in to your Prestocard account. Login result: ${JSON.stringify(loginResult)}`);
    }

    this.logger.debug('Successfully logged in');

    this.logger.debug('Retrieving current Prestocard balance');
    tResult = await this.prestocardGetRequest({
      uri: 'https://www.prestocard.ca/en/dashboard',
    });
    await this.page.goto(`data:text/html,${tResult}`, {waitUntil: 'networkidle0'});
    this.remainingBalance = await this.page.$eval('p.dashboard__quantity', (el) => el.innerHTML);
    this.logger.debug(`Current balance is: ${this.remainingBalance}`);

    this.logger.debug('Retrieving number of paginated pages');
    csrfToken = await this.retrievePrestoCSRFToken({
      pageUrl: 'https://www.prestocard.ca/en/dashboard/transit-usage-report',
      selector: '#TransitUsageReport input[name="__RequestVerificationToken"]',
    });
    tResult = await this.prestocardPostRequest({
      uri: 'https://www.prestocard.ca/api/sitecore/Paginator/TransitUsageReportFilteredIndex',
      headers: {
        __RequestVerificationToken: csrfToken,
      },
      body: {
        Year: this.configuredTransitUsageReportYear,
        TransactionCateogryID: 0,
        currentModel: '',
        PageSize: 10,
      },
    });
    await this.page.goto(`data:text/html,${tResult}`, {waitUntil: 'networkidle0'});
    tResult = await this.page.$$eval('a.pagination__item', (els) => els.length);
    const paginationPageSize = tResult - 2; // Do not count the 'back' & 'next' pagination items
    this.logger.debug(`Total number of paginated pages is: ${paginationPageSize}`);

    this.logger.debug(`Retrieving Presto transit usage report for ${this.configuredTransitUsageReportYear}`);
    for (let iter=1; iter<=paginationPageSize; iter++) {
      tResult = await this.prestocardPostRequest({
        uri: 'https://www.prestocard.ca/api/sitecore/Paginator/TransitUsagePager',
        headers: {},
        body: {
          paginator: {
            NumberOfPages: paginationPageSize,
            CurrentPage: 0,
            PageSize: 10,
            Items: [],
            Component: null,
          },
          pageNumber: iter,
        },
      });
      const updatedResults = await this.parseTransactionRows(tResult);
      transactionList = [...transactionList, ...updatedResults];
    }
    return transactionList;
  }

  // istanbul ignore next
  async parseTransactionRows(rawResult) {
    let transactionList = [];

    await this.page.goto(`data:text/html,${rawResult}`, {waitUntil: 'networkidle0'});
    const tRows = await this.page.$$('#tblTUR tbody tr');
    for (let row of tRows) {
      const rawDate = await row.$eval('td:nth-child(1)', (node) => node.innerText);
      const transitAgency = await row.$eval('td:nth-child(2)', (node) => node.innerText);
      // const stopLocation = await row.$eval('td:nth-child(3)', (node) => node.innerText);
      // const fareType = await row.$eval('td:nth-child(4)', (node) => node.innerText);
      const fareAmount = await row.$eval('td:nth-child(5)', (node) => node.innerText);

      // Discard this transaction if it is older than we care for
      const epochDate = Date.parse(rawDate);
      if (epochDate <= this.configuredMostRecentTransactionDate) {
        this.logger.debug(`Discarding transaction from ${epochDate} as it is too old to process`);
        continue;
      }
      this.logger.debug(`Processing transaction from ${epochDate}`);

      // Make note of the most recent transaction date
      if (epochDate >= this.updatedMostRecentTransactionDate) {
        this.updatedMostRecentTransactionDate = epochDate;
      }

      transactionList.push({
        date: epochDate,
        amount: fareAmount,
        merchant: `"Prestocard transaction (${transitAgency})"`,
      });
    }

    return transactionList;
  }

  getMostRecentTransactionDate() {
    return this.updatedMostRecentTransactionDate;
  }

  getRemainingBalance() {
    return this.remainingBalance;
  }
}

module.exports = PrestocardPlugin;
