const ledgerBalanceReport = require('../lib/ledgerBalanceReport');

jest.mock('util', () => ({
  promisify: () => ((filename, args) => {
    expect(filename).toEqual('/usr/local/bin/ledger');
    expect(args.length).toEqual(7);
    expect(args[0]).toEqual('--date-format');
    expect(args[1]).toEqual('%Y-%m-%d');
    expect(args[2]).toEqual('-f');
    expect(args[3]).toEqual('/tmp/fake-ledger.dat');
    expect(args[4]).toEqual('balance');
    expect(args[5]).toEqual('Assets');
    expect(args[6]).toEqual('Liabilities');

    return Promise.resolve({
      stdout: 'fake stdout output',
      stderr: 'fake stderr output',
    });
  }),
}));

describe('ledgerBalanceReport function', () => {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  it('throws an error if the ledger file is not specified', async () => {
    expect.assertions(1);

    const inputArgs = {
      ledgerFileName: null,
      ledgerCli: '/usr/local/bin/ledger',
      logger,
    };

    await expect(ledgerBalanceReport(inputArgs)).rejects.toEqual(Error('Missing ledger file name - this is very likely a bug'));
  });

  it('throws an error if the ledger cli path is not specified', async () => {
    expect.assertions(1);

    const inputArgs = {
      ledgerFileName: '/tmp/fake-ledger.dat',
      ledgerCli: null,
      logger,
    };

    await expect(ledgerBalanceReport(inputArgs)).rejects.toEqual(Error('You do not appear to have the "ledgerCli" key set in your config file.'));
  });

  it('calls ledger with the correct arguments', async () => {
    expect.assertions(10);

    const inputArgs = {
      ledgerFileName: '/tmp/fake-ledger.dat',
      ledgerCli: '/usr/local/bin/ledger',
      logger,
    };

    await expect(ledgerBalanceReport(inputArgs)).resolves.toEqual('fake stdout output');
  });
});
