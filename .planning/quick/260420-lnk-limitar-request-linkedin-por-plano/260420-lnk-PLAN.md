# Quick Task 260420-lnk Plan

## Goal

Enforce LinkedIn import request limits by monetization tier without changing the existing async import architecture.

## Tasks

1. Add a LinkedIn import policy that treats missing or free billing metadata as free-trial, allowing only 1 lifetime import request.
2. Allow paid users (`unit`, `monthly`, `pro`) up to 2 LinkedIn import requests per rolling hour based on persisted `linkedin_import_jobs`.
3. Apply the policy in `POST /api/profile/extract` before job creation and return a controlled limit response.
4. Add focused tests for free-trial exhaustion, paid hourly throttling, and route behavior.
