const gulp = require('gulp');
const gutil = require('gulp-util');
const {exec, spawn} = require('child-process-promise'); // eslint-disable-line no-unused-vars
const eslint = require('gulp-eslint');
const source = require('vinyl-source-stream');
const streamify = require('gulp-streamify');
const fs = require('fs');
const request = require('request');
const decompress = require('gulp-decompress');
const ip = require('ip');

const hugoVersion = '0.26';
const hugoBinary = 'tmp/hugo';
const hugoUrl = `https://github.com/gohugoio/hugo/releases/download/v${hugoVersion}/hugo_${hugoVersion}_Linux-64bit.tar.gz`;

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
    'tests/**/*.js',
  ];
  return gulp.src(files)
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

gulp.task('download-hugo', () => {
  if (!fs.existsSync(hugoBinary)) {
    return request(hugoUrl)
      .pipe(source('hugo.tar.gz'))
      .pipe(streamify(decompress({strip: 1})))
      .pipe(gulp.dest('tmp'));
  }
  return;
});

gulp.task('website-dev-server', ['download-hugo'], () => {
  const tag = 'website-dev-server';
  return Promise.resolve().then(() => {
    return executeAsyncProcess({
      process: hugoBinary,
      processArguments: [
        'server',
        '--baseUrl', `http://${ip.address()}:1313`,
        '--source', 'website',
        '--config', 'website/config.yaml',
        '--bind', ip.address(),
      ],
      taskTag: tag,
      envVars: {},
    });
  }).catch((err) => {
    printOutput(tag, {stdout: '', stderr: err.toString()});
    throw new Error(`Error in task "${tag}"`);
  });
});
