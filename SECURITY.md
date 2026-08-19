# Security Policy

## About this project

The Defence Ecosystem is a single, self-contained HTML file. It has **no
backend, no database, no login, no server-side code, and collects no user
data**. All logic runs locally in the visitor's browser, and the only outbound
links are to third-party organisations' public websites.

This means the project's realistic risk surface is small and mostly limited to:

* **Incorrect or malicious links** — a node pointing to the wrong domain, a
  defunct domain that has been re-registered by someone else, or a typo that
  resolves somewhere unintended.
* **Inaccurate or misattributed information** — an organisation described or
  categorised incorrectly.
* **Dependency-free by design** — there are no third-party runtime packages, so
  there is no supply-chain dependency risk in the shipped file.

## Supported versions

The live version deployed at the project's GitHub Pages site is the only
supported version. Fixes are applied to the current file; there are no
long-term support branches.

| Version | Supported |
| ------- | --------- |
| Current live deployment | ✅ |
| Older copies / forks | ❌ |

## Reporting a vulnerability or a bad link

If you find a security issue — for example a link that resolves to an
unexpected, malicious, or inappropriate destination — please report it
**privately** rather than opening a public issue, so it can be fixed before it
is widely seen.

**Email: juliusdavidson1987@gmail.com**

Please include:

* The node or organisation name affected
* The incorrect link or behaviour you observed
* What you expected instead (e.g. the correct official domain), if known

For **non-security corrections** (an out-of-date link, a wrong description, a
missing organisation), please use the in-tool **"✎ Suggest a correction"**
button, which pre-fills the project's correction form — that's the fastest
route for routine fixes.

## What to expect

* An acknowledgement of your report, typically within a few days.
* An assessment of the issue and, where valid, a fix to the live file.
* Credit for the report if you would like it (and are happy to be named).

## Scope

In scope: the contents of this repository and the deployed HTML file.

Out of scope: the security of the third-party websites this tool links to.
Those are operated independently by the organisations concerned; this project
simply points to them and cannot control or vouch for their security.
