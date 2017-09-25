---
title: 'Development & Contributing Upstream'
date: '2017-09-07'
lastmod: '2017-09-25'
type: 'docs'
layout: 'single'
---

Here's what you need to get started:

- [Source code][ledger-reconciler] for Ledger Reconciler.
- [Node.js][nodejs-current] >= 8.4.0 (needs async/await support).
- [Yarn][yarnpkg] package manager.
- [Ledger][ledger-cli] installed and available locally.
- [reckon][reckon-gem] Ruby gem installed and available locally.
- A basic config file as per the [installation][installation] docs.

Clone and install all the Ledger Reconciler dependencies. Git LFS here is used
for the website images.
``` bash
git clone https://github.com/marvinpinto/ledger-reconciler.git
cd ledger-reconciler
git lfs install
git lfs pull
yarn install
```

Be sure to use the `--debug` and `--dry-run` flags when testing and iterating
on your program locally.
``` bash
node index.js --debug --dry-run
```

Before submitting a [pull request][ledger-reconciler-pr], do make sure all the
tests pass locally.
``` bash
yarn run lint
yarn run all-tests
```


### Plugin Development

The Ledger Reconciler plugin runner (`index.js`) was designed to execute any
compatible plugins explicitly specified by the end user. What this means is
that plugins can be loaded directly from the `ledger-reconciler` library, or
from an external npm package.

The location of external or internal plugins is specified via the `location`
key in the config file.

All plugins need to adhere to the following interface:
``` js
async scrapeTransactions() {
  // ...
}

getMostRecentTransactionDate() {
  // ...
}

getRemainingBalance() {
  // ...
}
```

They also need to set the `page` variable to that of a new browser instance,
for example:
``` js
this.page = await this.browser.newPage();
```

Your best bet is to extend the `BasePlugin` class - have a look at the examples
in the [lib/plugins][ledger-reconciler-plugins-dir] directory on GitHub.

While iterating on a plugin locally, you may find it useful to have Chrome take
screenshots of what the webpage looks like at point in time.

``` js
await page.pdf({path: 'screenshot.pdf'});
```


### Website Development

If you need to update the Ledger Reconciler documentation - under the
[website][ledger-reconciler-website-dir] directory - you might find it useful
to run the local dev server to see what your changes look like before
submitting upstream.

``` bash
yarn start
```


### Getting Help

This project is not very active at the moment so your best bet is to open up a
[new issue][ledger-reconciler-issues] with the problem you're facing. You can
also stop by the [gitter.im][gitter-im-chatroom] chat room if you need
synchronous help and I'll do what I can.


### Release Procedure

1. On **master**, create a new release document with all relevant highlights.
   (e.g. `content/releases/<NEW VERSION>.md`)
1. Update `content/releases/_index.md` to reflect the unreleased state.
1. Cut a new release: `yarn version --new-version <NEW VERSION>`
1. Update the release notes on GitHub to point back to the website release
   page.


[nodejs-current]: https://nodejs.org/en/download/current
[yarnpkg]: https://yarnpkg.com
[ledger-reconciler]: https://github.com/marvinpinto/ledger-reconciler
[ledger-reconciler-issues]: https://github.com/marvinpinto/ledger-reconciler/issues
[ledger-reconciler-pr]: https://github.com/marvinpinto/ledger-reconciler/pulls
[reckon-gem]: https://github.com/cantino/reckon
[ledger-cli]: http://ledger-cli.org
[installation]: {{< relref "/installation.md" >}}
[gitter-im-chatroom]: https://gitter.im/ledger-reconciler/Lobby
[ledger-reconciler-plugins-dir]: https://github.com/marvinpinto/ledger-reconciler/tree/master/lib/plugins
[ledger-reconciler-website-dir]: https://github.com/marvinpinto/ledger-reconciler/tree/master/website
