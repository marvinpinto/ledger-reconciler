const ChaseCanadaPlugin = require('../../lib/plugins/ChaseCanadaPlugin');

describe('ChaseCanadaPlugin', () => {
  let chaseCanadaPlugin;
  let logger = jest.fn();
  let browser = jest.fn();
  let pluginArgs = {};

  afterEach(() => {
    delete process.env.CHASECANADA_PLUGIN_USERNAME;
    delete process.env.CHASECANADA_PLUGIN_PASSWORD;
    delete process.env.CHASECANADA_PLUGIN_SECURITYANSWER;
  });

  it('throws an error if a username is not set via either the config file or env variable', () => {
    expect.assertions(1);
    pluginArgs = {
      mostRecentTransactionDate: 'yesterday',
      password: 'fake-password',
      securityAnswer: 'fake-security-answer',
    };
    try {
      chaseCanadaPlugin = new ChaseCanadaPlugin(browser, logger, pluginArgs);
    } catch (error) {
      expect(error).toEqual(Error('You do not appear to have either the "username" key set in your config file for the Chase Canada plugin.'));
    }
  });

  it('falls back to the username set via the environment variable, if not specified in the config file', () => {
    expect.assertions(1);
    process.env.CHASECANADA_PLUGIN_USERNAME = 'fake-username';
    pluginArgs = {
      mostRecentTransactionDate: 'yesterday',
      password: 'fake-password',
      securityAnswer: 'fake-security-answer',
    };
    chaseCanadaPlugin = new ChaseCanadaPlugin(browser, logger, pluginArgs);
    expect(chaseCanadaPlugin.pluginArgs.username).toEqual('fake-username');
  });

  it('throws an error if a password is not set via either the config file or env variable', () => {
    expect.assertions(1);
    pluginArgs = {
      mostRecentTransactionDate: 'yesterday',
      username: 'fake-username',
      securityAnswer: 'fake-security-answer',
    };
    try {
      chaseCanadaPlugin = new ChaseCanadaPlugin(browser, logger, pluginArgs);
    } catch (error) {
      expect(error).toEqual(Error('You do not appear to have either the "password" key set in your config file for the Chase Canada plugin.'));
    }
  });

  it('falls back to the password set via the environment variable, if not specified in the config file', () => {
    expect.assertions(1);
    process.env.CHASECANADA_PLUGIN_PASSWORD = 'fake-password';
    pluginArgs = {
      mostRecentTransactionDate: 'yesterday',
      username: 'fake-username',
      securityAnswer: 'fake-security-answer',
    };
    chaseCanadaPlugin = new ChaseCanadaPlugin(browser, logger, pluginArgs);
    expect(chaseCanadaPlugin.pluginArgs.password).toEqual('fake-password');
  });

  it('throws an error if a security answer is not set via either the config file or env variable', () => {
    expect.assertions(1);
    pluginArgs = {
      mostRecentTransactionDate: 'yesterday',
      username: 'fake-username',
      password: 'fake-password',
    };
    try {
      chaseCanadaPlugin = new ChaseCanadaPlugin(browser, logger, pluginArgs);
    } catch (error) {
      expect(error).toEqual(Error('You do not appear to have either the "securityAnswer" key set in your config file for the Chase Canada plugin.'));
    }
  });

  it('falls back to the securityAnswer set via the environment variable, if not specified in the config file', () => {
    expect.assertions(1);
    process.env.CHASECANADA_PLUGIN_SECURITYANSWER = 'fake-security-answer';
    pluginArgs = {
      mostRecentTransactionDate: 'yesterday',
      username: 'fake-username',
      password: 'fake-password',
    };
    chaseCanadaPlugin = new ChaseCanadaPlugin(browser, logger, pluginArgs);
    expect(chaseCanadaPlugin.pluginArgs.securityAnswer).toEqual('fake-security-answer');
  });

  it('uses the most recent transaction date, if supplied via the config file', () => {
    expect.assertions(2);
    pluginArgs = {
      mostRecentTransactionDate: 'yesterday',
      username: 'fake-username',
      password: 'fake-password',
      securityAnswer: 'fake-security-answer',
    };
    chaseCanadaPlugin = new ChaseCanadaPlugin(browser, logger, pluginArgs);
    expect(chaseCanadaPlugin.configuredMostRecentTransactionDate).toEqual('yesterday');
    expect(chaseCanadaPlugin.updatedMostRecentTransactionDate).toEqual('yesterday');
  });

  it('defaults the recent transaction date to epoch 0, if none is supplied via the config file', () => {
    expect.assertions(2);
    pluginArgs = {
      username: 'fake-username',
      password: 'fake-password',
      securityAnswer: 'fake-security-answer',
    };
    chaseCanadaPlugin = new ChaseCanadaPlugin(browser, logger, pluginArgs);
    expect(chaseCanadaPlugin.configuredMostRecentTransactionDate).toEqual(0);
    expect(chaseCanadaPlugin.updatedMostRecentTransactionDate).toEqual(0);
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
