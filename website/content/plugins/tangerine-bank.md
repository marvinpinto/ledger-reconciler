---
title: 'Tangerine Banking Plugin'
date: '2017-09-16'
lastmod: '2017-09-24'
type: 'plugins'
layout: 'single'
---

This plugin allows you to download and auto-categorize all the available
banking transactions in your [Tangerine Banking][tangerine-login] account.

{{< figure src="/images/tangerine-bank-transaction-history-dropdown.png" title="Tangerine Bank transaction history dropdown" alt="Tangerine Bank transaction history dropdown" >}}

It parses all the transactions in the specified sub-account from the last 12
months and inputs that information into Ledger.


## Configuration

Under the `plugins` section of your config file, the following keys are needed
for the Tangerine Banking plugin:

- `name` - Name that is printed on screen (e.g. `Tangerine Banking - Chequing`).
- `location` - Location of the plugin. Set this to `./lib/plugins/TangerineBankingPlugin`.
- `username` - Your Tangerine client number, card number, or username.
- `bankingWebsitePin` - Your Tangering website PIN.
- `accountNumber` - The account number listed on your Tangerine banking portal. The parser will go through and retrieve all the transactions within the last 12 months from this account. e.g. `123456789`.
- `securityQuestions` - A list of all the security questions and answers associated with your Tangerine account. See the example below on how to format this list.
- `ledgerAccountName` - The name of the [Ledger account][ledger-structuring-your-account] you would like to associate these transactions to.
- `ledgerCurrency` - The [Ledger currency][ledger-currency] you would like these transactions listed in.

Full Tangerine Banking configuration example:
``` yaml
plugins:
  - name: 'Tangerine Banking - Chequing'
    location: './lib/plugins/TangerineBankingPlugin'
    username: '11122233'
    bankingWebsitePin: '123456'
    accountNumber: '123456789'
    securityQuestions:
      - question: 'Who won the super bowl last year'
        answer: 'Raptors'
      - question: 'Pick a number between one and 100'
        answer: 'Blue'
    ledgerAccountName: 'Assets:TangerineChequing'
    ledgerCurrency: 'CAD '
```


## Caveats

The `ledger-reconciler` program attempts to save where it left off in order to
minimize duplicate transactions. Transactions on the Tangerine Banking website
are precise up to the day; so hours, minutes, and seconds are not recorded.
What this means is that any transactions that come in on the same day after
`ledger-reconciler` is run **will not be recorded** as `ledger-reconciler`
considers each of these newer transactions as "already processed".


[tangerine-login]: https://www.tangerine.ca/app
[ledger-structuring-your-account]: http://ledger-cli.org/3.0/doc/ledger3.html#Structuring-your-Accounts
[ledger-currency]: http://ledger-cli.org/3.0/doc/ledger3.html#Currency-and-Commodities
