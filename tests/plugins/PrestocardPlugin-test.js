const PrestocardPlugin = require('../../lib/plugins/PrestocardPlugin');
const mockdate = require('mockdate');

describe('PrestocardPlugin', () => {
  let prestocardPlugin;
  let logger = jest.fn();
  let browser = jest.fn();
  let pluginArgs = {};

  beforeEach(() => {
    pluginArgs = {
      username: 'fake-username',
      password: 'fake-password',
      transitUsageReportYear: 1999,
      inverseTransactions: false,
      mostRecentTransactionDate: 'yesterday',
    };

    mockdate.set(1436401636000);
  });

  it('throws an error if a username is not set via the config file', () => {
    expect.assertions(1);
    delete pluginArgs.username;

    try {
      prestocardPlugin = new PrestocardPlugin(browser, logger, pluginArgs);
    } catch (error) {
      expect(error).toEqual(
        Error('You do not appear to have the "username" key set in your config file for the Prestocard plugin.'),
      );
    }
  });

  it('throws an error if a password is not set via the config file', () => {
    expect.assertions(1);
    delete pluginArgs.password;

    try {
      prestocardPlugin = new PrestocardPlugin(browser, logger, pluginArgs);
    } catch (error) {
      expect(error).toEqual(
        Error('You do not appear to have the "password" key set in your config file for the Prestocard plugin.'),
      );
    }
  });

  it('uses the most recent transaction date, if supplied via the config file', () => {
    expect.assertions(2);
    prestocardPlugin = new PrestocardPlugin(browser, logger, pluginArgs);
    expect(prestocardPlugin.configuredMostRecentTransactionDate).toEqual('yesterday');
    expect(prestocardPlugin.updatedMostRecentTransactionDate).toEqual('yesterday');
  });

  it('defaults the recent transaction date to epoch 0, if none is supplied via the config file', () => {
    expect.assertions(2);
    delete pluginArgs.mostRecentTransactionDate;
    prestocardPlugin = new PrestocardPlugin(browser, logger, pluginArgs);
    expect(prestocardPlugin.configuredMostRecentTransactionDate).toEqual(0);
    expect(prestocardPlugin.updatedMostRecentTransactionDate).toEqual(0);
  });

  it('returns the most recent transaction date', () => {
    expect.assertions(1);
    prestocardPlugin = new PrestocardPlugin(browser, logger, pluginArgs);
    expect(prestocardPlugin.getMostRecentTransactionDate()).toEqual('yesterday');
  });

  it('returns the default remaining balance', () => {
    expect.assertions(1);
    prestocardPlugin = new PrestocardPlugin(browser, logger, pluginArgs);
    expect(prestocardPlugin.getRemainingBalance()).toEqual('undefined');
  });

  it('uses the user-supplied Transit Usage Report year', () => {
    expect.assertions(1);
    prestocardPlugin = new PrestocardPlugin(browser, logger, pluginArgs);
    expect(prestocardPlugin.configuredTransitUsageReportYear).toEqual(1999);
  });

  it('uses the current year as the default when no Transit Usage Report year is supplied', () => {
    expect.assertions(1);
    delete pluginArgs.transitUsageReportYear;
    prestocardPlugin = new PrestocardPlugin(browser, logger, pluginArgs);
    expect(prestocardPlugin.configuredTransitUsageReportYear).toEqual(2015);
  });
});
