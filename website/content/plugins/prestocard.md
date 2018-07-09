---
title: 'Prestocard Plugin'
date: '2019-07-09'
lastmod: '2019-07-09'
type: 'plugins'
layout: 'single'
---

This plugin allows you to download and scrutinize all your
[Prestocard][presto-website] transactions, in effect treating it like just
another Ledger account.

It uses the Transit Usage Report functionality to record all trasactions for a
given year.


## Configuration

Under the `plugins` section of your config file, the following keys are needed
for the Prestocard plugin:

- `name` - Name that is printed on screen (e.g. `Prestocard`).
- `location` - Location of the plugin. Set this to `./lib/plugins/PrestocardPlugin`.
- `username` - Your Prestocard username.
- `password` - Your Prestocard password.
- `ledgerCurrency` - The [Ledger currency][ledger-currency] you would like these transactions listed in.
- `transitUsageReportYear` - The Transit Usage Report year to process transactions for.

Full Prestocard configuration example:
``` yaml
plugins:
  - name: Prestocard
    location: ./lib/plugins/PrestocardPlugin
    username: 'prestouser'
    password: 'hunter2'
    ledgerAccountName: 'Assets:Prestocard Balance'
    ledgerCurrency: 'CAD '
    transitUsageReportYear: 2018
    inverseTransactions: false
```


[presto-website]: https://www.prestocard.ca
