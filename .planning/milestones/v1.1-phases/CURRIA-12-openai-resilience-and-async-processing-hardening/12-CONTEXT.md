# Phase 12 Context

## Why This Phase Exists

The next major risk is operational rather than feature-related: OpenAI-backed resume flows can still degrade into cascading timeouts, and PDF processing remains too synchronous for larger or slower inputs. Both risks threaten the core promise that a user can reliably generate and download a resume in production.

## Problems To Solve

- No explicit circuit breaker or provider-protection layer is called out for OpenAI-dependent generation paths.
- Timeout handling can stack across provider calls, rewrite stages, and route execution.
- PDF extraction or parsing is still exposed as a synchronous path that can overrun route budgets.
- Observability needs to make breaker state, provider slowness, and staged processing visible.

## Acceptance Lens

This phase is only done when provider degradation fails fast and predictably, heavy PDF work no longer relies on an unbounded synchronous request path, and operators can see why a generation flow degraded.

## Requirements

- OPS-08
- OPS-09
