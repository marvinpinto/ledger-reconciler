---
title: 'Chase Canada Plugin'
date: '2017-09-07'
lastmod: '2017-09-07'
type: 'plugins'
layout: 'single'
---

This plugin allows you to download and auto-categorize all the available
credit-card transactions in your [Chase Canada][chase-login] account.

{{< figure src="/images/chase-canada-statement-cycle-dropdown.png" title="Chase Canada statement cycle dropdown" alt="Chase Canada statement cycle dropdown" >}}

It goes through and automatically selects each statement in the "statement
cycle" dropdown, and parses that output looking for your credit card
transaction details.


## Configuration

Under the `plugins` section of your config file, the following keys are needed
for the Chase Canada plugin:

- `name` - Name that is printed on screen (e.g. `Chase Canada`).
- `location` - Location of the plugin. Set this to `./lib/plugins/ChaseCanadaPlugin`.
- `username` - Your Chase banking username.
- `password` - Your Chase banking password.
- `securityAnswer` - The security answer to your Chase banking security question.
- `ledgerAccountName` - The name of the [Ledger account][ledger-structuring-your-account] you would like to associate these transactions to.
- `ledgerCurrency` - The [Ledger currency][ledger-currency] you would like these transactions listed in.

An example configuration one could use with the Chase Canada plugin might look
something like:

``` yaml
plugins:
  - name: 'Chase Canada'
    location: './lib/plugins/ChaseCanadaPlugin'
    username: '<chase banking username>'
    password: '<chase banking password>'
    securityAnswer: '<chase banking security answer>'
    ledgerAccountName: 'Liabilities:Chase-Example-Visa'
    ledgerCurrency: 'CAD '
```


## Environment Variables

Instead of using the configuration file to store your Chase Canada secrets such
as your username, password, and security answer, this plugin allows you to
instead supply these values as environment variables. The plugin first checks
the config file for these values and then falls back to checking the
environment variables.

Set the following environment variables before executing the
`ledger-reconciler` program and you should then be able to forego storing
secrets in your config file:

- `CHASECANADA_PLUGIN_USERNAME` - Your Chase banking username.
- `CHASECANADA_PLUGIN_PASSWORD` - Your Chase banking password.
- `CHASECANADA_PLUGIN_SECURITYANSWER` - The security answer to your Chase banking security question.


## Caveats

The `ledger-reconciler` program attempts to save where it left off in order to
minimize duplicate transactions. Transactions on the Chase Canada website are
precise up to the day; so hours, minutes, and seconds are not recorded. What
this means is that any transactions that come in on the same day after
`ledger-reconciler` is run **will not be recorded** as `ledger-reconciler`
considers each of these newer transactions as "already processed".


[chase-login]: https://online.chasecanada.ca/ChaseCanada_Consumer/Login.do
[ledger-structuring-your-account]: http://ledger-cli.org/3.0/doc/ledger3.html#Structuring-your-Accounts
[ledger-currency]: http://ledger-cli.org/3.0/doc/ledger3.html#Currency-and-Commodities
