# Design doc / RFC skeleton

<!-- Reader: someone who needs to make or review a technical decision. -->

<!-- Put the conclusion first. Supporting detail goes below. -->

<!-- Modeled after React RFCs and Google design docs. -->

# RFC: migrate task queue from Redis to PostgreSQL

**Status:** Accepted
**Author:** @engineer
**Date:** 2025-03-15

## Summary

<!-- One paragraph. If the reader stops here they should understand -->

<!-- what's changing and why. -->

Replace the Redis-backed task queue with a PostgreSQL-based
implementation using `SKIP LOCKED`. This eliminates Redis as an
operational dependency for teams that already run PostgreSQL, and
removes the consistency gap when tasks reference rows in the
same database.

## Motivation

<!-- The problem, not the solution. Why is the current state painful? -->

- Two datastores to operate and monitor for a single workflow.
- Task delivery guarantees are weaker than the database transactions
  they coordinate with.
- 60% of on-call pages in Q4 were Redis connection issues.

## Proposed solution

<!-- What you want to build. Enough detail to review, not enough -->

<!-- to implement — implementation belongs in the code. -->

...

## Alternatives considered

<!-- Every rejected path and why. Future readers need this most — -->

<!-- it prevents re-litigating decisions. -->

### Keep Redis, add transactional outbox

...

### Switch to a managed queue service (SQS)

...

## Risks and open questions

<!-- What you don't know yet. These become the review discussion. -->

- `SKIP LOCKED` throughput under 10k jobs/sec is untested.
- Migration path for in-flight Redis tasks during cutover.
