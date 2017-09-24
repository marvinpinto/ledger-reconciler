const TangerineBankingPlugin = require('../../lib/plugins/TangerineBankingPlugin');

describe('TangerineBankingPlugin', () => {
  let tangerineBankingPlugin;
  let logger = jest.fn();
  let browser = jest.fn();
  let pluginArgs = {};

  beforeEach(() => {
    pluginArgs = {
      username: 'fake-username',
      bankingWebsitePin: '12356',
      accountNumber: '123456789',
      securityQuestions: [
        {
          question: 'What is your favourite number',
          answer: 'blue',
        },
        {
          question: 'Who won the super bowl last year',
          answer: 'Raptors',
        },
      ],
      mostRecentTransactionDate: 'yesterday',
    };
  });

  it('throws an error if a username is not set via the config file', () => {
    expect.assertions(1);
    delete pluginArgs.username;

    try {
      tangerineBankingPlugin = new TangerineBankingPlugin(browser, logger, pluginArgs);
    } catch (error) {
      expect(error).toEqual(Error('You do not appear to have the "username" key set in your config file for the Tangerine Banking plugin.'));
    }
  });

  it('throws an error if the banking website pin is not set via the config file', () => {
    expect.assertions(1);
    delete pluginArgs.bankingWebsitePin;

    try {
      tangerineBankingPlugin = new TangerineBankingPlugin(browser, logger, pluginArgs);
    } catch (error) {
      expect(error).toEqual(Error('You do not appear to have the "bankingWebsitePin" key set in your config file for the Tangerine Banking plugin.'));
    }
  });

  it('throws an error if the account number is not set via the config file', () => {
    expect.assertions(1);
    delete pluginArgs.accountNumber;

    try {
      tangerineBankingPlugin = new TangerineBankingPlugin(browser, logger, pluginArgs);
    } catch (error) {
      expect(error).toEqual(Error('You do not appear to have the "accountNumber" key set in your config file for the Tangerine Banking plugin.'));
    }
  });

  it('throws an error if the security questions are not set via the config file', () => {
    expect.assertions(1);
    delete pluginArgs.securityQuestions;

    try {
      tangerineBankingPlugin = new TangerineBankingPlugin(browser, logger, pluginArgs);
    } catch (error) {
      expect(error).toEqual(Error('You do not appear to have the "securityQuestions" key set in your config file for the Tangerine Banking plugin.'));
    }
  });

  it('uses the most recent transaction date, if supplied via the config file', () => {
    expect.assertions(2);
    tangerineBankingPlugin = new TangerineBankingPlugin(browser, logger, pluginArgs);
    expect(tangerineBankingPlugin.configuredMostRecentTransactionDate).toEqual('yesterday');
    expect(tangerineBankingPlugin.updatedMostRecentTransactionDate).toEqual('yesterday');
  });

  it('defaults the recent transaction date to epoch 0, if none is supplied via the config file', () => {
    expect.assertions(2);
    delete pluginArgs.mostRecentTransactionDate;
    tangerineBankingPlugin = new TangerineBankingPlugin(browser, logger, pluginArgs);
    expect(tangerineBankingPlugin.configuredMostRecentTransactionDate).toEqual(0);
    expect(tangerineBankingPlugin.updatedMostRecentTransactionDate).toEqual(0);
  });

  it('returns the most recent transaction date', () => {
    expect.assertions(1);
    tangerineBankingPlugin = new TangerineBankingPlugin(browser, logger, pluginArgs);
    expect(tangerineBankingPlugin.getMostRecentTransactionDate()).toEqual('yesterday');
  });

  it('returns the default remaining balance', () => {
    expect.assertions(1);
    tangerineBankingPlugin = new TangerineBankingPlugin(browser, logger, pluginArgs);
    expect(tangerineBankingPlugin.getRemainingBalance()).toEqual('undefined');
  });
});
