const Logger = require('../lib/Logger');

describe('Logger class', () => {
  beforeEach(() => {
    window.console.log = jest.fn();
  });

  it('suppresses debug output if the debug flag is not set', async () => {
    const logger = new Logger(null, null);
    logger.debug('hello');
    expect(window.console.log.mock.calls.length).toEqual(0);
  });

  it('displays debug output when the debug flag is set', async () => {
    const logger = new Logger(null, true);
    logger.debug('hello');
    expect(window.console.log.mock.calls.length).toEqual(1);
  });

  it('suppresses informational output if the silent flag is set', async () => {
    const logger = new Logger(true, true);
    logger.info('hello');
    expect(window.console.log.mock.calls.length).toEqual(0);
  });

  it('displays informational output if the silent flag is not set', async () => {
    const logger = new Logger(null, true);
    logger.info('hello');
    expect(window.console.log.mock.calls.length).toEqual(1);
  });

  it('displays warning output no matter what flags are set', async () => {
    const logger = new Logger(true, true);
    logger.warn('hello');
    expect(window.console.log.mock.calls.length).toEqual(1);
  });

  it('displays error output no matter what flags are set', async () => {
    const logger = new Logger(true, true);
    logger.error('hello');
    expect(window.console.log.mock.calls.length).toEqual(1);
  });
});
