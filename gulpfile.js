const gulp = require('gulp');
const gutil = require('gulp-util');
const {exec, spawn} = require('child-process-promise'); // eslint-disable-line no-unused-vars
const eslint = require('gulp-eslint');

const printOutput = (tag, output) => {
  if (output.stdout) {
    output.stdout.split('\n').forEach((line) => {
      const tline = line.trim();
      if (tline) {
        gutil.log(gutil.colors.magenta(`${tag}: ${tline}`));
      }
    });
  }

  if (output.stderr) {
    output.stderr.split('\n').forEach((line) => {
      const tline = line.trim();
      if (tline) {
        gutil.log(gutil.colors.red(`${tag}: ${tline}`));
      }
    });
  }
};

const executeAsyncProcess = (args) => { // eslint-disable-line no-unused-vars
  let isStderrOutputPresent = false;

  return Promise.resolve().then(() => {
    if (!args.process ||
        !args.taskTag ||
        !args.processArguments ||
        args.envVars === undefined) {
      throw new Error('Invalid arguments passed into "executeAsyncProcess"');
    }

    if (!args.failOnStderr) {
      args.failOnStderr = false;
    }

    // Use spawn to execute the specified process
    const overriddenEnv = Object.assign({}, process.env, args.envVars);
    const promise = spawn(args.process, args.processArguments, {env: overriddenEnv});
    const childProcess = promise.childProcess;
    childProcess.stdout.on('data', (data) => {
      printOutput(args.taskTag, {stdout: data.toString(), stderr: ''});
    });
    childProcess.stderr.on('data', (data) => {
      isStderrOutputPresent = true;
      printOutput(args.taskTag, {stdout: '', stderr: data.toString()});
    });
    return promise;
  }).then(() => {
    if (args.failOnStderr && isStderrOutputPresent) {
      return Promise.reject('Failed due to stderr output');
    }

    return Promise.resolve();
  });
};

gulp.task('lint-javascript', () => {
  const files = [
    'gulpfile.js',
    'index.js',
    'lib/**/*.js',
  ];
  return gulp.src(files)
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});
