const BasePlugin = require('./BasePlugin');
const PCMastercard = require('./PCMastercard');

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
    this.page.on('console', (msg) => this.logger.debug(msg.text()));

    const pcmc = new PCMastercard(this.logger, this.sleep);
    await pcmc.initializeClient();


    throw new Error('done for now!');


    this.logger.debug('Initialing transaction download');

    // Bring up the PC Mastercard login page
    await this.page.goto('https://secure.pcfinancial.ca/login', {waitUntil: 'networkidle0'});

    // Fill in the username
    await this.page.type('input[name="username"]', this.pluginArgs.username, {delay: 100});

    // Fill in the password
    await this.page.type('input[name="password"]', this.pluginArgs.password, {delay: 100});

    // Click Login
    await this.pageClick('form[name="login_form"] button', false);
    console.log("LOGIN CLICKED");

    // Use the 2FA channel chosen by the user
    await this.select2FAChannel('Email', null);

    // Click Send Code
    await this.pageClick('form button[type="submit"][value="submit"]', false);
    console.log("SEND CODE CLICKED");

    try {

    // Read the user 2FA value
    const twoFactorAuthValue = await this.read2FAInput('PC Mastercard security code');
    this.logger.debug(`User provided 2FA value: "${twoFactorAuthValue}"`);

    // Enter in the 2FA value
    await this.page.waitForSelector('app-otp-passcode form > app-multi-input', {visible: true});
    await this.page.keyboard.type(twoFactorAuthValue, {delay: 100});
    await this.page.keyboard.press('Enter');
    this.logger.debug('Entered in provided 2FA code');

    // Click the "don't add this device" link when presented with the option to add as a trusted device
    await this.pageClick('#main-entry-container > md-sidenav-container > md-sidenav > app-dynamic-components > app-add-trusted-device > div > div:nth-child(2) > div > button.link-btn.link-btn-margin.link-btn-flex-mobile.mat-button', false);

    this.logger.debug('Successfully logged in');

    // Get the current balance
    const currentBalanceSelector = '#pie-chart > g > text:nth-child(10)';
    await this.page.waitForSelector(currentBalanceSelector);
    const currentBalance = await this.page.$eval(currentBalanceSelector, (el) => el.innerHTML);
    this.remainingBalance = currentBalance;
    this.logger.debug(`Current balance is: ${this.remainingBalance}`);


    throw new Error('done for now!');


    } catch (error) {
      console.log("ERROR: " + error);
      await this.generateDebugScreenshot();
      process.exit(1);
    }




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
      await this.pageClick('form[name="transHistoryForm"] a.selectBox', false);
      await this.pageClick(`body > ul.selectBox-dropdown-menu > li > a[rel="${stmt}"]`);

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

  async select2FAChannel(channel, channelValue) {
    // Click the 2FA dropdown
    await this.pageClick('form md-select[formcontrolname="channel"] div.mat-select-trigger', false);

    // Search for the selector ID corresponding to the chosen 2FA channel
    const channelOptions = await this.page.$$eval('md-option', opts => {
      return opts.map(opt => {
        return {
          label: opt.innerText.trim(),
          id: opt.id,
        };
      }).reduce((acc, opt) => {
        acc[opt.label] = opt.id;
        return acc;
      }, {});
    });

    const twoFactorChannel = channelOptions[channel];
    if (!twoFactorChannel) {
      throw new Error(`2FA channel "${channel}" does not appear to be a valid option`);
    }

    // Select the chosen 2FA option
    await this.pageClick(`md-option#${twoFactorChannel}`, false);

    if (!channelValue) {
      // Nothing more needs done here since the user chose an option without a value, e.g Email
      return;
    }

    // Click the 2FA values dropdown
    await this.pageClick('form md-select[formcontrolname="channelValue"] div.mat-select-trigger', false);

    // Search for the selector ID corresponding to the chosen 2FA channel value
    const channelValueOptions = await this.page.$$eval('md-option', opts => {
      return opts.map(opt => {
        return {
          label: opt.innerText.trim(),
          id: opt.id,
        };
      }).reduce((acc, opt) => {
        acc[opt.label] = opt.id;
        return acc;
      }, {});
    });

    const twoFactorChannelValue = channelValueOptions[channelValue];
    if (!twoFactorChannelValue) {
      throw new Error(`2FA channel Value "${channelValue}" does not appear to be a valid option`);
    }

    // Select the chosen 2FA option
    await this.pageClick(`md-option#${twoFactorChannelValue}`, false);
  }
}

module.exports = PCMastercardPlugin;
