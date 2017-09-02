const collateLedgerData = require('../lib/collateLedgerData');

jest.mock('util', () => ({
  promisify: () => ((filename, args) => {
    expect(filename).toEqual('/usr/local/bin/ledger');
    expect(args.length).toEqual(5);
    expect(args[0]).toEqual('-f');
    expect(args[1]).toEqual('/tmp/fake-ledger.dat');
    expect(args[2]).toEqual('--sort');
    expect(args[3]).toEqual('d');
    expect(args[4]).toEqual('print');

    return Promise.resolve({
      stdout: 'fake stdout output',
      stderr: 'fake stderr output',
    });
  }),
}));

describe('collateLedgerData function', () => {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  it('throws an error if the temp ledger file is not specified', async () => {
    expect.assertions(1);

    const inputArgs = {
      tempLedgerFileName: null,
      ledgerCli: '/usr/local/bin/ledger',
      logger,
    };

    await expect(collateLedgerData(inputArgs)).rejects.toEqual(Error('Missing temporary ledger file name - this is very likely a bug'));
  });

  it('throws an error if the ledger cli path is not specified', async () => {
    expect.assertions(1);

    const inputArgs = {
      tempLedgerFileName: '/tmp/fake-ledger.dat',
      ledgerCli: null,
      logger,
    };

    await expect(collateLedgerData(inputArgs)).rejects.toEqual(Error('You do not appear to have the "ledgerCli" key set in your config file.'));
  });

  it('calls ledger with the correct arguments', async () => {
    expect.assertions(8);

    const inputArgs = {
      tempLedgerFileName: '/tmp/fake-ledger.dat',
      ledgerCli: '/usr/local/bin/ledger',
      logger,
    };

    await expect(collateLedgerData(inputArgs)).resolves.toEqual('fake stdout output');
  });
});
