const gulp = require('gulp');
const {spawn} = require('child-process-promise');
const colors = require('ansi-colors');
const log = require('fancy-log');
const source = require('vinyl-source-stream');
const streamify = require('gulp-streamify');
const fs = require('fs');
const request = require('request');
const decompress = require('gulp-decompress');
const ip = require('ip');
const vnuJar = require('vnu-jar');
const htmlhint = require('gulp-htmlhint');
const awspublish = require('gulp-awspublish');
const rename = require('gulp-rename');
const cloudfront = require('gulp-cloudfront-invalidate-aws-publish');
const axios = require('axios');
const argv = require('minimist')(process.argv.slice(2));

const hugoVersion = '0.26';
const hugoBinary = 'tmp/hugo';
const hugoUrl = `https://github.com/gohugoio/hugo/releases/download/v${hugoVersion}/hugo_${hugoVersion}_Linux-64bit.tar.gz`;

const files = {
  html: 'dist/website/**/*.html',
};

const printOutput = (tag, output) => {
  if (output.stdout) {
    output.stdout.split('\n').forEach(line => {
      const tline = line.trim();
      if (tline) {
        log(colors.magenta(`${tag}: ${tline}`));
      }
    });
  }

  if (output.stderr) {
    output.stderr.split('\n').forEach(line => {
      const tline = line.trim();
      if (tline) {
        log(colors.red(`${tag}: ${tline}`));
      }
    });
  }
};

const executeAsyncProcess = async args => {
  let isStderrOutputPresent = false;

  if (!args.process || !args.taskTag || !args.processArguments || args.envVars === undefined) {
    throw new Error('Invalid arguments passed into "executeAsyncProcess"');
  }

  if (!args.failOnStderr) {
    args.failOnStderr = false;
  }

  // Use spawn to execute the specified process
  const overriddenEnv = Object.assign({}, process.env, args.envVars);
  const promise = spawn(args.process, args.processArguments, {env: overriddenEnv});
  const childProcess = promise.childProcess;
  childProcess.stdout.on('data', data => {
    printOutput(args.taskTag, {stdout: data.toString(), stderr: ''});
  });
  childProcess.stderr.on('data', data => {
    isStderrOutputPresent = true;
    printOutput(args.taskTag, {stdout: '', stderr: data.toString()});
  });
  await promise;

  if (args.failOnStderr && isStderrOutputPresent) {
    throw new Error('Failed due to stderr output');
  }

  return Promise.resolve();
};

export const lintJavascript = () => {
  const jsfiles = ['gulpfile.babel.js', 'index.js', 'lib/**/*.js', 'tests/**/*.js'];

  return executeAsyncProcess({
    process: 'yarn',
    processArguments: ['eslint', argv.fix ? '--fix' : '', ...jsfiles],
    taskTag: 'lintJavascript',
    envVars: {},
  });
};

const downloadHugo = () => {
  if (!fs.existsSync(hugoBinary)) {
    return request(hugoUrl)
      .pipe(source('hugo.tar.gz'))
      .pipe(streamify(decompress({strip: 1})))
      .pipe(gulp.dest('tmp'));
  }
  return Promise.resolve();
};

const websiteDevServer = () => {
  return executeAsyncProcess({
    process: hugoBinary,
    processArguments: [
      'server',
      '--baseUrl',
      `http://${ip.address()}:1313`,
      '--source',
      'website',
      '--config',
      'website/config.yaml',
      '--bind',
      ip.address(),
    ],
    taskTag: 'websiteDevServer',
    envVars: {},
  });
};
export const startWebsiteDevServer = gulp.series(downloadHugo, websiteDevServer);

const validateHtml5Content = () => {
  return executeAsyncProcess({
    process: 'java',
    processArguments: ['-jar', vnuJar, '--skip-non-html', '--errors-only', '--exit-zero-always', 'dist/website/'],
    taskTag: 'validateHtml5Content',
    envVars: {},
    failOnStderr: true,
  });
};

const generateProductionHugoWebsite = () => {
  return executeAsyncProcess({
    process: hugoBinary,
    processArguments: [
      '--baseURL',
      'https://disjoint.ca/projects/ledger-reconciler',
      '--source',
      'website',
      '--config',
      'website/config.yaml',
      '--destination',
      '../dist/website',
      '--cleanDestinationDir',
    ],
    taskTag: 'generateProductionHugoWebsite',
    envVars: {},
  });
};

const htmlProofer = () => {
  return executeAsyncProcess({
    process: 'htmlproofer',
    processArguments: [
      '--allow-hash-href',
      '--report-script-embeds',
      '--check-html',
      '--only-4xx',
      '--url-swap',
      '"https...disjoint.ca/projects/ledger-reconciler:"',
      '--url-ignore',
      '"/global.americanexpress.com/"',
      './dist/website',
    ],
    taskTag: 'htmlProofer',
    envVars: {},
  });
};

const analyzeHtmlContent = () => {
  return gulp
    .src(files.html)
    .pipe(htmlhint('.htmlhintrc'))
    .pipe(htmlhint.reporter('htmlhint-stylish'))
    .pipe(htmlhint.failReporter({suppress: true}));
};

export const websiteTests = gulp.series(
  downloadHugo,
  generateProductionHugoWebsite,
  gulp.parallel(analyzeHtmlContent, validateHtml5Content, htmlProofer),
);

const deployWebsiteTask = () => {
  const publisher = awspublish.create({
    params: {
      Bucket: process.env.S3_BUCKET_NAME,
    },
  });

  const cfSettings = {
    distribution: process.env.CLOUDFRONT_DISTRIBUTION_ID,
    indexRootPath: true,
  };

  const headers = {
    'Cache-Control': 'max-age=7200', // 2 hours
  };

  return gulp
    .src(['dist/website/**'])
    .pipe(
      rename(path => {
        // Purpose is to deploy the website files into the
        // '/projects/ledger-reconciler' subdirectory within the S3 bucket
        path.dirname = `projects/ledger-reconciler/${path.dirname}`;
      }),
    )
    .pipe(publisher.publish(headers))
    .pipe(publisher.sync('projects/ledger-reconciler'))
    .pipe(cloudfront(cfSettings))
    .pipe(
      awspublish.reporter({
        states: ['create', 'update', 'delete'],
      }),
    );
};
export const deployWebsite = gulp.series(downloadHugo, generateProductionHugoWebsite, deployWebsiteTask);

export const submitSitemaps = async () => {
  const urls = ['https://www.google.com/ping', 'https://www.bing.com/ping'];

  const promises = urls.map(ele => {
    return axios.request({
      method: 'get',
      url: ele,
      params: {
        sitemap: 'https://disjoint.ca/projects/ledger-reconciler/sitemap.xml',
      },
    });
  });
  await Promise.all(promises);
  printOutput('submitSitemaps', {stdout: 'Sitemaps successfully submitted', stderr: ''});
  return Promise.resolve();
};
