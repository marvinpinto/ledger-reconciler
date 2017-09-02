const chalk = require('chalk');

class Logger {
  constructor(silentMode, debugMode) {
    this.silentMode = silentMode;
    this.debugMode = debugMode;

    this.debug = this.debug.bind(this);
    this.info = this.info.bind(this);
    this.warn = this.warn.bind(this);
    this.error = this.error.bind(this);
  }

  debug(output) {
    this.debugMode ? console.log(chalk.blue(`[DEBUG]: ${output}`)) : null;
  }

  info(output) {
    this.silentMode ? null : console.log(chalk.cyan(`[INFO]: ${output}`));
  }

  warn(output) {
    console.log(chalk.yellow(`[WARN]: ${output}`));
  }

  error(output) {
    console.log(chalk.red(`[ERROR}: ${output}`));
  }
}

module.exports = Logger;
