<!--
Template: security vulnerability report. For documenting a security issue
with impact assessment and remediation guidance.
Source: github/securitylab docs/report-template.md (adapted to markdown document).

When using (by create-issue):
  1. Place in docs/issue/YYYY-MM-DD-subject/ISSUE.md
  2. Translate to Chinese
  3. Remove this comment
-->

# {Title}

## Summary

A concise description of the vulnerability, its impact, and severity.
For example: an unsafe deserialization vulnerability allows any unauthenticated
user to execute arbitrary code on the server.

## Affected Component

The module, endpoint, function, or area where the vulnerability exists.

## Tested Version

The version where the vulnerability was confirmed.

## Details

Full technical details of the vulnerability. Point to the relevant source code
where possible.

## Proof of Concept

Complete instructions to reproduce the vulnerability, including any specific
configuration needed.

## Impact

What an attacker could achieve by exploiting this vulnerability.
Include the scope (who is affected) and severity.

## Remediation

Suggested fix or mitigation. Note that this is a suggestion; the maintainer
may have a better approach.

## Additional Context

Related CVEs, similar vulnerabilities in other projects, or references.
