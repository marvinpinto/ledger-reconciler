const ChaseCanadaPlugin = require('../../lib/plugins/ChaseCanadaPlugin');

describe('ChaseCanadaPlugin', () => {
  let chaseCanadaPlugin;
  let logger = jest.fn();
  let browser = jest.fn();
  let pluginArgs = {};

  it('throws an error if the user does not have one of the required settings', () => {
    expect.assertions(1);
    pluginArgs = {
      mostRecentTransactionDate: 'yesterday',
      username: 'fake-username',
      password: 'fake-password',
    };

    try {
      chaseCanadaPlugin = new ChaseCanadaPlugin(browser, logger, pluginArgs);
    } catch (error) {
      expect(error).toEqual(Error('You do not appear to have either the "username", "password", or "securityAnswer" keys set in your config file for the Chase Canada plugin.'));
    }
  });

  it('returns the most recent transaction date', () => {
    expect.assertions(1);
    pluginArgs = {
      mostRecentTransactionDate: 'yesterday',
      username: 'fake-username',
      password: 'fake-password',
      securityAnswer: 'fake-security-answer',
    };
    chaseCanadaPlugin = new ChaseCanadaPlugin(browser, logger, pluginArgs);
    expect(chaseCanadaPlugin.getMostRecentTransactionDate()).toEqual('yesterday');
  });
});
