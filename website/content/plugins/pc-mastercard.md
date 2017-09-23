---
title: 'PC Financial Mastercard Plugin'
date: '2017-09-11'
lastmod: '2017-09-23'
type: 'plugins'
layout: 'single'
---

This plugin allows you to download and auto-categorize all the available
credit-card transactions in your [PC Financial Mastercard][pc-mc-login]
account.

{{< figure src="/images/pc-mastercard-dropdown.png" title="PC Financial Mastercard statement cycle dropdown" alt="PC Financial Mastercard statement cycle dropdown" >}}

It goes through and automatically selects each statement in the "statement
cycle" dropdown, and parses that output looking for your credit card
transaction details.


## Configuration

Under the `plugins` section of your config file, the following keys are needed
for the PC Financial Mastercard plugin:

- `name` - Name that is printed on screen (e.g. `PC Mastercard`).
- `location` - Location of the plugin. Set this to `./lib/plugins/PCMastercardPlugin`.
- `username` - Your PC Financial Mastercard username.
- `password` - Your PC Financial Mastercard password.
- `securityAnswer` - The security answer to your PC Financial Mastercard security question.
- `ledgerAccountName` - The name of the [Ledger account][ledger-structuring-your-account] you would like to associate these transactions to.
- `ledgerCurrency` - The [Ledger currency][ledger-currency] you would like these transactions listed in.

An example configuration one could use with the PC Financial Mastercard plugin
might look something like:

``` yaml
plugins:
  - name: 'PC Mastercard'
    location: './lib/plugins/PCMastercardPlugin'
    username: '<pc mastercard username>'
    password: '<pc mastercard password>'
    securityAnswer: '<pc mastercard security answer>'
    ledgerAccountName: 'Liabilities:PC-Mastercard'
    ledgerCurrency: 'CAD '
```


## Caveats

The `ledger-reconciler` program attempts to save where it left off in order to
minimize duplicate transactions. Transactions on the PC Financial Mastercard
website are precise up to the day; so hours, minutes, and seconds are not
recorded. What this means is that any transactions that come in on the same day
after `ledger-reconciler` is run **will not be recorded** as
`ledger-reconciler` considers each of these newer transactions as "already
processed".


[pc-mc-login]: https://online.pcmastercard.ca/PCB_Consumer/Login.do
[ledger-structuring-your-account]: http://ledger-cli.org/3.0/doc/ledger3.html#Structuring-your-Accounts
[ledger-currency]: http://ledger-cli.org/3.0/doc/ledger3.html#Currency-and-Commodities
