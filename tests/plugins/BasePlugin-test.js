const BasePlugin = require('../../lib/plugins/BasePlugin');

describe('BasePlugin base class', () => {
  let basePlugin;
  let logger = jest.fn();
  let browser = jest.fn();
  let pluginArgs = {};

  beforeEach(() => {
    basePlugin = new BasePlugin(browser, logger, pluginArgs);
  });

  it('clarifies that the scrapeTransactions function should be implemented in the extending class', async () => {
    await expect(basePlugin.scrapeTransactions()).rejects.toEqual(Error('This should be implemented in the extended class'));
  });

  it('clarifies that the getMostRecentTransactionDate function should be implemented in the extending class', () => {
    expect.assertions(1);
    try {
      basePlugin.getMostRecentTransactionDate();
    } catch (error) {
      expect(error).toEqual(Error('This should be implemented in the extended class'));
    }
  });

  it('clarifies that the getRemainingBalance function should be implemented in the extending class', () => {
    expect.assertions(1);
    try {
      basePlugin.getRemainingBalance();
    } catch (error) {
      expect(error).toEqual(Error('This should be implemented in the extended class'));
    }
  });
});
