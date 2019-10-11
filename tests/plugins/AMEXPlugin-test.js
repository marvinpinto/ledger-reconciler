const AMEXPlugin = require('../../lib/plugins/AMEXPlugin');

describe('AMEXPlugin', () => {
  let amexPlugin;
  let logger = jest.fn();
  let browser = jest.fn();
  let pluginArgs = {};

  it('throws an error if a username is not set via the config file', () => {
    expect.assertions(1);
    pluginArgs = {
      mostRecentTransactionDate: 'yesterday',
      password: 'fake-password',
    };
    try {
      amexPlugin = new AMEXPlugin(browser, logger, pluginArgs);
    } catch (error) {
      expect(error).toEqual(
        Error(
          'You do not appear to have either the "username" key set in your config file for the American Express plugin.',
        ),
      );
    }
  });

  it('throws an error if a password is not set via the config file', () => {
    expect.assertions(1);
    pluginArgs = {
      mostRecentTransactionDate: 'yesterday',
      username: 'fake-username',
    };
    try {
      amexPlugin = new AMEXPlugin(browser, logger, pluginArgs);
    } catch (error) {
      expect(error).toEqual(
        Error(
          'You do not appear to have either the "password" key set in your config file for the American Express plugin.',
        ),
      );
    }
  });

  it('uses the most recent transaction date, if supplied via the config file', () => {
    expect.assertions(2);
    pluginArgs = {
      mostRecentTransactionDate: 'yesterday',
      username: 'fake-username',
      password: 'fake-password',
    };
    amexPlugin = new AMEXPlugin(browser, logger, pluginArgs);
    expect(amexPlugin.configuredMostRecentTransactionDate).toEqual('yesterday');
    expect(amexPlugin.updatedMostRecentTransactionDate).toEqual('yesterday');
  });

  it('defaults the recent transaction date to epoch 0, if none is supplied via the config file', () => {
    expect.assertions(2);
    pluginArgs = {
      username: 'fake-username',
      password: 'fake-password',
    };
    amexPlugin = new AMEXPlugin(browser, logger, pluginArgs);
    expect(amexPlugin.configuredMostRecentTransactionDate).toEqual(0);
    expect(amexPlugin.updatedMostRecentTransactionDate).toEqual(0);
  });

  it('returns the most recent transaction date', () => {
    expect.assertions(1);
    pluginArgs = {
      mostRecentTransactionDate: 'yesterday',
      username: 'fake-username',
      password: 'fake-password',
    };
    amexPlugin = new AMEXPlugin(browser, logger, pluginArgs);
    expect(amexPlugin.getMostRecentTransactionDate()).toEqual('yesterday');
  });

  it('returns the default remaining balance', () => {
    expect.assertions(1);
    pluginArgs = {
      mostRecentTransactionDate: 'yesterday',
      username: 'fake-username',
      password: 'fake-password',
    };
    amexPlugin = new AMEXPlugin(browser, logger, pluginArgs);
    expect(amexPlugin.getRemainingBalance()).toEqual('undefined');
  });
});
