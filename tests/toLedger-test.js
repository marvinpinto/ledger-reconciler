const toLedger = require('../lib/toLedger');
const child_process = require('child_process'); // eslint-disable-line camelcase

jest.mock('child_process', () => {
  return {
    spawnSync: jest.fn(() => {
      return {
        stdout:
          "I didn't find a high-likelyhood money column, but I'm taking my best guess with column 2.\r\n fake stdout output",
        stderr: 'fake stderr output',
      };
    }),
  };
});

describe('toLedger function', () => {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    child_process.spawnSync.mockClear();
  });

  it('throws an error if the ledger account name or currency are not specified', async () => {
    const inputArgs = {
      ledgerAccountName: 'Liabilities:Chase-Example-Visa',
      ledgerCurrency: '',
      reckonCli: '/usr/local/bin/reckon',
      csvInputFileName: '/tmp/fake-csv-input-file',
      reckonTokensTempFileName: '/tmp/fake-reckon-tokens-file',
      logger,
    };

    await expect(toLedger(inputArgs)).rejects.toEqual(
      Error(
        'The config for one of your plugins is missing either the "ledgerAccountName" or the "ledgerCurrency" keys.',
      ),
    );
    expect(child_process.spawnSync).toHaveBeenCalledTimes(0);
  });

  it('throws an error if the reckon path was not specified', async () => {
    const inputArgs = {
      ledgerAccountName: 'Liabilities:Chase-Example-Visa',
      ledgerCurrency: 'CAD ',
      reckonCli: '',
      csvInputFileName: '/tmp/fake-csv-input-file',
      reckonTokensTempFileName: '/tmp/fake-reckon-tokens-file',
      logger,
    };

    await expect(toLedger(inputArgs)).rejects.toEqual(
      Error('You do not appear to have the "reckonCli" key set in your config file.'),
    );
    expect(child_process.spawnSync).toHaveBeenCalledTimes(0);
  });

  it('throws an error if one of the temp input filenames were not supplied', async () => {
    const inputArgs = {
      ledgerAccountName: 'Liabilities:Chase-Example-Visa',
      ledgerCurrency: 'CAD ',
      reckonCli: '/usr/local/bin/reckon',
      csvInputFileName: '',
      reckonTokensTempFileName: '/tmp/fake-reckon-tokens-file',
      logger,
    };

    await expect(toLedger(inputArgs)).rejects.toEqual(
      Error('Missing required temporary files - this is very likely a bug'),
    );
    expect(child_process.spawnSync).toHaveBeenCalledTimes(0);
  });

  it('calls reckon with the correct arguments', async () => {
    const inputArgs = {
      ledgerAccountName: 'Liabilities:Chase-Example-Visa',
      ledgerCurrency: 'CAD ',
      reckonCli: '/usr/local/bin/reckon',
      csvInputFileName: '/tmp/fake-csv-input-file',
      reckonTokensTempFileName: '/tmp/fake-reckon-tokens-file',
      logger,
    };

    await expect(toLedger(inputArgs)).resolves.toEqual('fake stdout output\r\n');

    expect(child_process.spawnSync).toHaveBeenCalledTimes(1);
    expect(child_process.spawnSync.mock.calls[0][0]).toEqual('/usr/local/bin/reckon');
    expect(child_process.spawnSync.mock.calls[0][1]).toHaveLength(12);
    expect(child_process.spawnSync.mock.calls[0][1]).toContain('--file');
    expect(child_process.spawnSync.mock.calls[0][1]).toContain('/tmp/fake-csv-input-file');
    expect(child_process.spawnSync.mock.calls[0][1]).toContain('--currency');
    expect(child_process.spawnSync.mock.calls[0][1]).toContain('CAD ');
    expect(child_process.spawnSync.mock.calls[0][1]).toContain('--inverse');
    expect(child_process.spawnSync.mock.calls[0][1]).toContain('--account');
    expect(child_process.spawnSync.mock.calls[0][1]).toContain('Liabilities:Chase-Example-Visa');
    expect(child_process.spawnSync.mock.calls[0][1]).toContain('--unattended');
    expect(child_process.spawnSync.mock.calls[0][1]).toContain('--account-tokens');
    expect(child_process.spawnSync.mock.calls[0][1]).toContain('/tmp/fake-reckon-tokens-file');
    expect(child_process.spawnSync.mock.calls[0][1]).toContain('--date-format');
    expect(child_process.spawnSync.mock.calls[0][1]).toContain('%m/%d/%Y');
  });

  it('omits the inverse argument if specified', async () => {
    const inputArgs = {
      ledgerAccountName: 'Liabilities:Chase-Example-Visa',
      ledgerCurrency: 'CAD ',
      reckonCli: '/usr/local/bin/reckon',
      csvInputFileName: '/tmp/fake-csv-input-file',
      reckonTokensTempFileName: '/tmp/fake-reckon-tokens-file',
      logger,
      inverseTransactions: false,
    };

    await expect(toLedger(inputArgs)).resolves.toEqual('fake stdout output\r\n');

    expect(child_process.spawnSync).toHaveBeenCalledTimes(1);
    expect(child_process.spawnSync.mock.calls[0][0]).toEqual('/usr/local/bin/reckon');
    expect(child_process.spawnSync.mock.calls[0][1]).toHaveLength(11);
    expect(child_process.spawnSync.mock.calls[0][1]).not.toContain('--inverse');
  });
});
