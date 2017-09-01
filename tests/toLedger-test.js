const toLedger = require('../lib/toLedger');

jest.mock('util', () => ({
  promisify: () => ((filename, args) => {
    expect(filename).toEqual('/usr/local/bin/reckon');
    expect(args.length).toEqual(10);
    expect(args[0]).toEqual('--file');
    expect(args[1]).toEqual('/tmp/fake-csv-input-file');
    expect(args[2]).toEqual('--currency');
    expect(args[3]).toEqual('CAD ');
    expect(args[4]).toEqual('--inverse');
    expect(args[5]).toEqual('--account');
    expect(args[6]).toEqual('Liabilities:Chase-Example-Visa');
    expect(args[7]).toEqual('--unattended');
    expect(args[8]).toEqual('--account-tokens');
    expect(args[9]).toEqual('/tmp/fake-reckon-tokens-file');

    return Promise.resolve({
      stdout: 'I didn\'t find a high-likelyhood money column, but I\'m taking my best guess with column 2.\r\n fake stdout output',
      stderr: 'fake stderr output',
    });
  }),
}));

describe('toLedger function', () => {
  it('throws an error if the ledger account name or currency are not specified', async () => {
    expect.assertions(1);

    const inputArgs = {
      ledgerAccountName: 'Liabilities:Chase-Example-Visa',
      ledgerCurrency: '',
      reckonCli: '/usr/local/bin/reckon',
      csvInputFileName: '/tmp/fake-csv-input-file',
      reckonTokensTempFileName: '/tmp/fake-reckon-tokens-file',
    };

    await expect(toLedger(inputArgs)).rejects.toEqual(Error('The config for one of your plugins is missing either the "ledgerAccountName" or the "ledgerCurrency" keys.'));
  });

  it('throws an error if the reckon path was not specified', async () => {
    expect.assertions(1);

    const inputArgs = {
      ledgerAccountName: 'Liabilities:Chase-Example-Visa',
      ledgerCurrency: 'CAD ',
      reckonCli: '',
      csvInputFileName: '/tmp/fake-csv-input-file',
      reckonTokensTempFileName: '/tmp/fake-reckon-tokens-file',
    };

    await expect(toLedger(inputArgs)).rejects.toEqual(Error('You do not appear to have the "reckonCli" key set in your config file.'));
  });

  it('throws an error if one of the temp input filenames were not supplied', async () => {
    expect.assertions(1);

    const inputArgs = {
      ledgerAccountName: 'Liabilities:Chase-Example-Visa',
      ledgerCurrency: 'CAD ',
      reckonCli: '/usr/local/bin/reckon',
      csvInputFileName: '',
      reckonTokensTempFileName: '/tmp/fake-reckon-tokens-file',
    };

    await expect(toLedger(inputArgs)).rejects.toEqual(Error('Missing required temporary files - this is very likely a bug'));
  });

  it('calls reckon with the correct arguments', async () => {
    expect.assertions(13);

    const inputArgs = {
      ledgerAccountName: 'Liabilities:Chase-Example-Visa',
      ledgerCurrency: 'CAD ',
      reckonCli: '/usr/local/bin/reckon',
      csvInputFileName: '/tmp/fake-csv-input-file',
      reckonTokensTempFileName: '/tmp/fake-reckon-tokens-file',
    };

    await expect(toLedger(inputArgs)).resolves.toEqual('fake stdout output');
  });
});
