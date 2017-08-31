const chalk = require('chalk');

const debugMode = process.env.NODE_ENV === 'development';

const debug = (output) => {
  debugMode ? console.log(chalk.blue(`[DEBUG]: ${output}`)) : null;
};

const info = (output) => {
  console.log(chalk.cyan(`[INFO]: ${output}`));
};

const warn = (output) => {
  console.log(chalk.yellow(`[WARN]: ${output}`));
};

const error = (output) => {
  console.log(chalk.red(`[ERROR}: ${output}`));
};

module.exports = {
  debug,
  info,
  warn,
  error,
};
