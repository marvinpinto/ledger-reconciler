---
title: 'Requirements & Installation'
date: '2017-09-07'
lastmod: '2017-09-23'
type: 'docs'
layout: 'single'
---

You will need to have a few things in place before using Ledger Reconciler.

- A working [Ledger][ledger-cli] setup or at least an understanding of how it
  works.
- A newish version of the [Node.js][nodejs-current] runtime (>= 8.4.0 since it
  needs async/await support).
- The [reckon][reckon-gem] Ruby gem installed and available somewhere locally.
- A working [gpg][gpg] setup with [gpg-agent][gpg-agent]. Only needed if you
  intend on encrypting values in your config file.


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


## GPG Encryption

Ledger Reconciler gives you the option of encrypting your secret settings in
the `.ledger-reconciler.yaml` config file. This alleviates the threat of
leaking your private banking credentials and allows you to commit your config
file into a version control system - like `git` - should you need to.

Any scalar values in the config file prefixed with the `ENCRYPTED:` value will
be decrypted using `gpg`. Ledger Reconciler was not designed for stdin or
readline input so you will need to have a working `gpg-agent` setup for this to
function correctly.

As an example, let's assume we have the following values in the config file and
we wish to encrypt the `password` value:
``` yaml
plugins:
  - name: 'PC Mastercard'
    location: './lib/plugins/PCMastercardPlugin'
    username: 'donald_duck'
    password: 'shhsekret'
```

Manually issue the `gpg --encrypt` command and produce the encrypted output:
``` bash
$ echo "shhsekret" | gpg --encrypt -r 52654E6EB0BB564B --armor | base64 --wrap 0
LS0tLS1CRUdJTiBQR1AgTUVTU0FHRS0tLS0tClZlcnNpb246IEdudVBHIHYyLjAuMjIgKEdOVS9MaW51eCkKQ29tbWVudDogR1BHVG9vbHMgLSBodHRwczovL2dwZ3Rvb2xzLm9yZwoKaFFFTUErWWhkMW5jNHRSNEFRZjhDa3dxNURCRXdPYTFQMFVnTDlIMlc1aXhPc2NRUEtGU04vVnNSWmwxN0RVeApmVjQwSXVKalZscERLSUtxVSsvSFY0RmhmZWN6SjR6dkZoRUZzT2loc1czL3RFTDJhUHpOMjQzMWFnb1NPUlRpCkhZR284YUJPV2dnMmV6c055Skl0SXRnQ3lSdVQxRnN0NWF3dU9pMHlpM2g0b2NVQnhaUzQ1T285azloeDR6WHgKVFUrbDlPZXhXS1lvM01UclFEWWpwYTRoaWZzajA3SUVWc3lFKzNPV3RsUVVkdi96bWVMYWUzR1VIUEc0eno0Zgp5N1NMdGh5ZkFncDgzcjdkOXUvMWdCVk0ybFRkNlFINkVreTM0RkVxMDZkVDljdXcxN2FXaTdqK3hrdlVzU0VVCjBEM3ZaOUplVnc2dlNPTTJMNXpMZkhNRC9KUW5URW51RTM0TTR2b3hUZEpGQWNydzMrZWs5dldPTUFXaFR1Tm0KVzMxS01jR05mWHpxNFEyaFhxT3hKdFVnZEFHUkRqN3pPK1Znbm9reTNWUjZCRytoRTIxb1BuZGVZZ1B1TlNsdApZTVJYVDJ6awo9VGx1cwotLS0tLUVORCBQR1AgTUVTU0FHRS0tLS0tCg==
```

Copy the encrypted string and add it back to the config file:
``` yaml
plugins:
  - name: 'PC Mastercard'
    location: './lib/plugins/PCMastercardPlugin'
    username: 'donald_duck'
    password: 'ENCRYPTED:LS0tLS1CRUdJTiBQR1AgTUVTU0FHRS0tLS0tClZlcnNpb246IEdudVBHIHYyLjAuMjIgKEdOVS9MaW51eCkKQ29tbWVudDogR1BHVG9vbHMgLSBodHRwczovL2dwZ3Rvb2xzLm9yZwoKaFFFTUErWWhkMW5jNHRSNEFRZjhDa3dxNURCRXdPYTFQMFVnTDlIMlc1aXhPc2NRUEtGU04vVnNSWmwxN0RVeApmVjQwSXVKalZscERLSUtxVSsvSFY0RmhmZWN6SjR6dkZoRUZzT2loc1czL3RFTDJhUHpOMjQzMWFnb1NPUlRpCkhZR284YUJPV2dnMmV6c055Skl0SXRnQ3lSdVQxRnN0NWF3dU9pMHlpM2g0b2NVQnhaUzQ1T285azloeDR6WHgKVFUrbDlPZXhXS1lvM01UclFEWWpwYTRoaWZzajA3SUVWc3lFKzNPV3RsUVVkdi96bWVMYWUzR1VIUEc0eno0Zgp5N1NMdGh5ZkFncDgzcjdkOXUvMWdCVk0ybFRkNlFINkVreTM0RkVxMDZkVDljdXcxN2FXaTdqK3hrdlVzU0VVCjBEM3ZaOUplVnc2dlNPTTJMNXpMZkhNRC9KUW5URW51RTM0TTR2b3hUZEpGQWNydzMrZWs5dldPTUFXaFR1Tm0KVzMxS01jR05mWHpxNFEyaFhxT3hKdFVnZEFHUkRqN3pPK1Znbm9reTNWUjZCRytoRTIxb1BuZGVZZ1B1TlNsdApZTVJYVDJ6awo9VGx1cwotLS0tLUVORCBQR1AgTUVTU0FHRS0tLS0tCg=='
```

Ledger Reconciler will now do the right thing and use the decrypted `shhsekret`
value as needed when processing the `PC Mastercard` plugin!

**Important:** Do not encrypt your secret values for key `52654E6EB0BB564B` -
this is [my key][marvin-gpg-pub-key] that I used here as an example. You can
find your own public key as follows:
``` bash
$ gpg --list-keys
/home/marvin/.gnupg/pubring.gpg
-------------------------------
pub   4096R/52654E6EB0BB564B 2016-12-13
uid                          Marvin Pinto <marvin@pinto.im>
uid                          Marvin Pinto (git) <git@pinto.im>
sub   2048R/E6217759DCE2D478 2016-12-13 [expires: 2017-12-13]
sub   2048R/26515E9EF2D0033C 2016-12-13 [expires: 2017-12-13]
sub   2048R/F705991D14C837D5 2016-12-13 [expires: 2017-12-13]
```


[ledger-cli]: http://ledger-cli.org
[nodejs-current]: https://nodejs.org/en/download/current
[reckon-gem]: https://github.com/cantino/reckon
[reckon-unattended-tokens]: https://github.com/cantino/reckon#unattended-mode
[gpg]: https://www.gnupg.org
[gpg-agent]: https://unix.stackexchange.com/a/188813
[marvin-gpg-pub-key]: https://pgp.mit.edu/pks/lookup?op=get&search=0x52654E6EB0BB564B
