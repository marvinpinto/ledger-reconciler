---
title: 'Requirements & Installation'
date: '2017-09-07'
lastmod: '2017-09-07'
type: 'docs'
layout: 'single'
---

You will need to have a few things in place before using Ledger Reconciler.

- A working [Ledger][ledger-cli] setup or at least an understanding of how it
  works.
- A newish version of the [Node.js][nodejs-current] runtime (>= 8.4.0 since it
  needs async/await support).
- The [reckon][reckon-gem] Ruby gem installed and available somewhere locally.


## Installation

Install Ledger Reconciler via npm:
``` bash
npm install -g ledger-reconciler
```

Do note that depending on your setup, you may need to prefix that installation
command with `sudo`. You should now be able to execute the `ledger-reconciler`
script globally.


## Configuration File

If a config file is not specified on the command line (via the `--config`
option), Ledger Reconciler will look for a file named `.ledger-reconciler.yaml`
in the current working directory.

A basic config file needs to have the following yaml keys set:

- `ledgerCli` - path to your [Ledger][ledger-cli] binary file.
- `reckonCli` - path to your [Reckon][reckon-gem] binary file.
- `chromiumHeadlessArgs` - any additional arguments you may wish to supply to
  the headless chrome instance. You can safely leave this empty `[]`,
- `ledgerDataFile` - path to your Ledger data file (e.g. `ledger.dat`).
- `reckonTokens` - contents of your reckon account tokens for unattended mode
  ([more details][reckon-unattended-tokens]).
- `plugins` - this list depends on which plugins you have enabled.

Here is full `.ledger-reconciler.yaml` example. This sample configuration only
enables the Chase Canada plugin.

``` yaml
---
ledgerCli: 'ledger'
reckonCli: 'reckon'
chromiumHeadlessArgs:
  - '--no-sandbox'
ledgerDataFile: '/absolute/path/to/your/ledger.dat'

plugins:
  - name: 'Chase Canada'
    location: './lib/plugins/ChaseCanadaPlugin'
    username: '<chase banking username>'
    password: '<chase banking password>'
    securityAnswer: '<chase banking security answer>'
    ledgerAccountName: 'Liabilities:Chase-Example-Visa'
    ledgerCurrency: 'CAD '

reckonTokens:
  Expenses:
    Computing:
      Cloud Services:
        - /amazon web services/i
  Income:
    Credit Card Rewards:
      - /rewards auto-redemption/i
    Interest:
      - /interest paid/i
  Liabilities:
    Chase-Example-Visa:
      - /Bill Payment - REWARDS/i
```


[ledger-cli]: http://ledger-cli.org
[nodejs-current]: https://nodejs.org/en/download/current
[reckon-gem]: https://github.com/cantino/reckon
[reckon-unattended-tokens]: https://github.com/cantino/reckon#unattended-mode
