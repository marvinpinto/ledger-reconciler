const logger = require('../logger');

const downloadTransactions = async (args) => {
  if (!args.browser ||
      !args.username ||
      !args.password ||
      !args.securityAnswer) {
    throw new Error('Invalid arguments supplied into "downloadTransactions"');
  }

  const page = await args.browser.newPage();
  page.on('console', logger.debug);

  logger.debug('Initialing transaction download');

  // Bring up the Chase login page
  await page.goto('https://online.chasecanada.ca/ChaseCanada_Consumer/Login.do');

  // Fill in the username
  await page.click('input[name="username"]');
  await page.type(args.username);

  // Fill in the password
  await page.click('input[name="password"]');
  await page.type(args.password);

  // Click "Sign On"
  await page.click('body > table > tbody > tr > td > table:nth-child(1) > tbody > tr > td:nth-child(1) > table > tbody > tr:nth-child(10) > td > table > tbody > tr:nth-child(4) > td > input[type="submit"]');
  await page.waitForNavigation();

  // Fill in the answer to one of the security questions, if presented
  const securityAnswerField = await page.$('form[name="secondaryUserAuthForm"] input[name="hintanswer"]');
  if (securityAnswerField) {
    await securityAnswerField.click();
    await page.type(args.securityAnswer);
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
  logger.debug('Successfully logged in');

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
  logger.debug(`Current balance is: ${currentBalance}`);

  // Collate a list of all the statements available for download
  const availableStatements = await page.evaluate((sel) => {
    const rows = [...document.querySelectorAll(sel)];
    return rows.map((row) => {
      return row.getAttribute('value');
    });
  }, 'form[name="transHistoryForm"] select[name="cycleDate"] option');

  let transactions = [];

  for (let stmt of availableStatements) {
    logger.debug(`Now processing statement: ${stmt}`);

    // const stmt = availableStatements[2];
    // Select the current statement from the statement cycle list
    await page.evaluate((sel, stmt) => {
      document.querySelector(sel).value = stmt;
    }, 'form[name="transHistoryForm"] select[name="cycleDate"]', stmt);
    await page.click('form[name="transHistoryForm"] input[type="submit"]');
    await page.waitForNavigation();

    const tRows = await parseTransactionRows(page);
    transactions = [...transactions, ...tRows];
  }

  return transactions;
};

const parseTransactionRows = async (page) => {
  // Parse the individual transaction entries in the displayed table
  const transactionTableSelector = 'body > table > tbody > tr:nth-child(2) > td:nth-child(2) > table > tbody > tr:nth-child(5) > td:nth-child(2) > table:nth-child(3) > tbody > tr.none > td > table > tbody > tr';
  return await page.evaluate((sel) => {
    let transactionList = [];
    const rows = [...document.querySelectorAll(sel)];
    rows.forEach((row) => {
      const eles = [...row.querySelectorAll('td')];

      const rawDate = eles[0].innerHTML.replace(/&nbsp;/g, '');
      const date = Date.parse(rawDate);

      // ignore any dates that can't be parsed - i.e. header rows
      if (!date) {
        return;
      }

      const rawMerchant = eles[2] ? eles[2].querySelector('a') : null;
      const merchant = rawMerchant ? eles[2].querySelector('a').innerHTML.replace(/&nbsp;/g, '') : null;

      const debitAmt = eles[3].innerHTML.replace(/&nbsp;/g, '');
      const creditAmt = eles[4].innerHTML.replace(/&nbsp;/g, '');

      transactionList.push({
        date,
        amount: creditAmt ? `(${creditAmt})` : debitAmt,
        merchant,
      });
    });

    return transactionList;
  }, transactionTableSelector);
};

module.exports = {
  downloadTransactions,
};
