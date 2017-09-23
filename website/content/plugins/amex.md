---
title: 'American Express Plugin'
date: '2017-09-13'
lastmod: '2017-09-23'
type: 'plugins'
layout: 'single'
---

This Ledger Reconciler plugin allows you to download and auto-categorize all
the available credit-card transactions in your [American Express Credit
Card][amex-login] account.

{{< figure src="/images/amex-ytd-dropdown.png" title="American Express date range dropdown" alt="American Express date range dropdown" >}}

It goes through and automatically parses all the credit card transaction
details under the **Year to Date** date range.


## Configuration

Under the `plugins` section of your config file, the following keys are needed
for the American Express plugin:

- `name` - Name that is printed on screen (e.g. `American Express`).
- `location` - Location of the plugin. Set this to `./lib/plugins/AMEXPlugin`.
- `username` - Your American Express username.
- `password` - Your American Express password.
- `ledgerAccountName` - The name of the [Ledger account][ledger-structuring-your-account] you would like to associate these transactions to.
- `ledgerCurrency` - The [Ledger currency][ledger-currency] you would like these transactions listed in.

An example configuration one could use with the American Express plugin
might look something like:

``` yaml
plugins:
  - name: 'American Express'
    location: './lib/plugins/AMEXPlugin'
    username: '<amex username>'
    password: '<amex password>'
    ledgerAccountName: 'Liabilities:AMEX'
    ledgerCurrency: 'CAD '
```


## Caveats

The `ledger-reconciler` program attempts to save where it left off in order to
minimize duplicate transactions. Transactions on the American Express
website are precise up to the day; so hours, minutes, and seconds are not
recorded. What this means is that any transactions that come in on the same day
after `ledger-reconciler` is run **will not be recorded** as
`ledger-reconciler` considers each of these newer transactions as "already
processed".


[amex-login]: https://global.americanexpress.com/login
[ledger-structuring-your-account]: http://ledger-cli.org/3.0/doc/ledger3.html#Structuring-your-Accounts
[ledger-currency]: http://ledger-cli.org/3.0/doc/ledger3.html#Currency-and-Commodities
