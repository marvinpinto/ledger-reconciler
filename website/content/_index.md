---
title: 'Ledger Reconciler'
subtitle: 'Automatically download and reconcile your ledger financial entries'
description: 'Automatically download and reconcile your ledger financial entries'
date: '2017-09-06'
lastmod: '2017-09-06'
---

**Ledger Reconciler is a open-source command-line tool that automates:**

- Logging into your bank accounts and retrieving your transactions (using [headless Chrome][headless-chrome])
- Classifying these transactions using Bayesian machine learning (via [reckon][reckon])
- Updating your [ledger][ledger-cli] transaction file with these newly classified entries


``` text
  Usage: ledger-reconciler [options]

  Options:

    -V, --version               output the version number
    -c, --config <config file>  Ledger Reconciler config file
    --silent                    Suppress all output except warnings & errors
    --debug                     Print out debug output
    --dry-run                   Perform a dry run - scrape transactions for all plugins but do not update anything
    -h, --help                  output usage information
```
It also saves the point at which it left off after a successful completion to
minimize duplicate transactions.


<h2 class="content-subhead">Supported financial institutions</h2>

Ledger Reconciler currently supports the following financial institutions:

- [Chase Canada][chase-canada-plugin]
- [PC Financial Mastercard][pc-mastercard-plugin]


<h2 class="content-subhead">Don't see your financial institution?</h2>

If you would like ledger-reconciler to support an institution not on the list
above, you have the option of either creating the new plugin yourself or asking
for help from the community. The latter can be done by [creating a GitHub
issue][ledger-reconciler-issues].


[headless-chrome]: https://chromium.googlesource.com/chromium/src/+/lkgr/headless/README.md
[ledger-cli]: http://ledger-cli.org
[reckon]: https://github.com/cantino/reckon
[ledger-reconciler-issues]: https://github.com/marvinpinto/ledger-reconciler/issues
[chase-canada-plugin]: {{< relref "/plugins/chase-canada.md" >}}
[pc-mastercard-plugin]: {{< relref "/plugins/pc-mastercard.md" >}}
