# Billing Monitoring - Minimal Setup

This document defines exactly what to monitor for the Asaas billing system, with concrete thresholds and queries.

---

## Philosophy

Monitor the **failure modes** identified in testing:

1. **Failed checkouts** (Asaas API failures)
2. **Stale pending checkouts** (webhook never arrived)
3. **Legacy-path webhook frequency** (pre-cutover subscriptions)
4. **RPC rejections** (overflow, negative balance)
5. **Pre-cutover metadata gaps** (missing asaas_subscription_id)

Do **NOT** monitor:
- Latency (not a risk factor)
- Conversion rates (not a ops concern)
- Success count (noise without context)

---

## Setup: Run These Queries on a Schedule

### Query 1: Failed Checkouts (Alert Immediately)

**Frequency:** Every 15 minutes
**Location:** Monitoring/alerting system (DataDog, Grafana, etc.)

```sql
SELECT COUNT(*) as failed_count
FROM billing_checkouts
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '15 minutes';
```

**Threshold:**
- `failed_count > 0` → Alert immediately

**Severity:** Critical (user can't proceed with purchase)

**On Alert:**
1. Check Asaas status page
2. Review app logs for error details
3. See ops runbook: "Failed checkout - Asaas call threw an error"

---

### Query 2: Stale Pending Checkouts (Alert If Any)

**Frequency:** Every 30 minutes
**Location:** Same monitoring system

```sql
SELECT COUNT(*) as stale_pending_count,
       MIN(created_at) as oldest_checkout
FROM billing_checkouts
WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '30 minutes';
```

**Threshold:**
- `stale_pending_count > 0` → Alert to ops

**Severity:** Medium (user didn't get Asaas link or abandoned)

**On Alert:**
1. Identify the user and checkout_reference
2. Check if user was sent correct link or if link expired
3. Create new checkout for user
4. See ops runbook: "Pending checkout for 2+ hours, no payment webhook"

---

### Query 3: Legacy-Path Webhook Frequency (Daily Report)

**Frequency:** Once daily (e.g., 8 AM UTC)
**Location:** Monitoring dashboard

```sql
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_events,
  SUM(CASE WHEN event_type IN ('SUBSCRIPTION_RENEWED', 'SUBSCRIPTION_CANCELED') THEN 1 ELSE 0 END) as recurring_events,
  SUM(CASE WHEN event_payload->>'externalReference' ~ '^usr_' THEN 1 ELSE 0 END) as legacy_path_events,
  ROUND(100.0 * SUM(CASE WHEN event_payload->>'externalReference' ~ '^usr_' THEN 1 ELSE 0 END) / COUNT(*), 1) as legacy_percentage
FROM processed_events
WHERE created_at > NOW() - INTERVAL '1 day'
ORDER BY date DESC
LIMIT 1;
```

**Threshold:**
- `legacy_percentage > 5%` → Investigate (might indicate new issue)
- `legacy_percentage > 0%` and trending UP → Investigate (might indicate regression)
- `legacy_percentage = 0%` and trending DOWN → Expected (pre-cutover subscriptions expiring)

**Severity:** Low (informational, not an immediate problem)

**On Trend:**
- If UP: Check if old subscriptions are being replayed or new issues are using legacy format
- If DOWN: Good! Pre-cutover subscriptions are retiring naturally
- When reaches 0% consistently: Can disable legacy parsing in external-reference.ts

---

### Query 4: RPC Rejections (Alert If Any)

**Frequency:** Every 2 hours
**Location:** Monitoring system (search application logs)

```sql
-- Check logs for RPC exception messages
-- Relevant error strings:
-- - "Credit balance overflow"
-- - "negative existing balance"
-- - "Checkout record not found"
-- - "Plan mismatch"

-- In monitoring system, look for logs containing:
-- [api/webhook/asaas] ERROR: <RPC error message>

-- Or in database, check processed_events for errors:
SELECT COUNT(*) as rpc_error_count
FROM processed_events
WHERE created_at > NOW() - INTERVAL '2 hours'
  AND event_payload::text ILIKE '%error%';
```

**Threshold:**
- Any RPC rejection in the last 2 hours → Review logs and ops runbook

**Severity:** High (indicates data integrity issues or edge cases)

**On Alert:**
1. Check app logs for exact error message
2. Identify user and event type
3. Run diagnostic queries from ops runbook
4. If overflow: Check credit_accounts balance for user
5. If plan mismatch: Check billing_checkouts vs webhook payload
6. If checkout not found: Check if old checkout was deleted accidentally

---

### Query 5: Pre-Cutover Metadata Gaps (Alert If Any)

**Frequency:** Every 4 hours
**Location:** Application logs

```sql
-- Look for structured log event:
-- billing.pre_cutover_missing_metadata
--   asaasSubscriptionId: <sub_id>
--   hasPlan: false|true
--   hasSubscriptionId: false|true

-- In monitoring system, search for:
-- event_name="billing.pre_cutover_missing_metadata"

-- Or in database:
SELECT COUNT(*) as metadata_gap_count,
       ARRAY_AGG(DISTINCT event_payload->>'asaasSubscriptionId') as affected_subscriptions
FROM processed_events
WHERE created_at > NOW() - INTERVAL '4 hours'
  AND event_type = 'SUBSCRIPTION_RENEWED'
  AND event_payload::text ILIKE '%pre_cutover_missing_metadata%';
```

**Threshold:**
- `metadata_gap_count > 0` → Alert (data integrity issue)

**Severity:** Critical (renewal failed, user didn't get credits)

**On Alert:**
1. Identify affected subscription_id
2. Check user_quotas for missing asaas_subscription_id or invalid plan
3. See ops runbook: "Renewal didn't grant credits - pre-cutover subscription"
4. Manually update user_quotas and grant credits

---

## Implementation: Two Approaches

### Approach A: SQL Queries + Spreadsheet (Minimal)

**If using:**
- Scheduled SQL runner (cron job)
- Email alerting
- Spreadsheet for tracking

**Steps:**
1. Create a script that runs the queries above on a schedule
2. Send results to Slack/email
3. Set thresholds and manual alerts
4. Keep a spreadsheet of anomalies and actions taken

**Example cron job:**
```bash
# Run every 15 min
*/15 * * * * /path/to/billing_monitor.sh

# billing_monitor.sh:
#!/bin/bash
RESULT=$(psql -c "SELECT COUNT(*) FROM billing_checkouts WHERE status='failed' AND created_at > NOW() - INTERVAL '15 minutes'")
if [ "$RESULT" -gt 0 ]; then
  curl -X POST https://hooks.slack.com/... -d "{\"text\": \"⚠️ Billing Alert: $RESULT failed checkouts in past 15 min\"}"
fi
```

### Approach B: Monitoring Tool (Recommended)

**If using:** DataDog, Grafana, New Relic, etc.

**Steps:**
1. Create custom metrics from the queries above
2. Set alert thresholds
3. Create dashboard with all 5 metrics
4. Link alerts to runbook URLs (e.g., Slack messages include link to ops-runbook.md)

**Example Grafana setup:**
```
Panel 1: Failed Checkouts (Last 1 Hour)
  Query: SELECT COUNT(*) FROM billing_checkouts WHERE status='failed' AND created_at > NOW() - INTERVAL '1 hour'
  Threshold: Alert if > 0

Panel 2: Stale Pending Checkouts (Last 24 Hours)
  Query: SELECT COUNT(*) FROM billing_checkouts WHERE status='pending' AND created_at < NOW() - INTERVAL '30 minutes'
  Threshold: Alert if > 0

Panel 3: Legacy Webhook Frequency (Last 24 Hours)
  Query: SELECT 100.0 * SUM(...) / COUNT(*) as legacy_pct FROM processed_events WHERE event_type IN (...)
  Threshold: Alert if > 5%

Panel 4: RPC Rejections (Last 2 Hours)
  Query: Count of log events containing "Credit balance overflow" or "Plan mismatch"
  Threshold: Alert if > 0

Panel 5: Pre-Cutover Metadata Gaps (Last 4 Hours)
  Query: Count of log events: billing.pre_cutover_missing_metadata
  Threshold: Alert if > 0
```

---

## Alert Destinations & Escalation

**All Alerts → On-Call Slack Channel**

Slack message format (template):
```
🚨 Billing Alert: <Alert Name>

Issue: <Threshold> triggered
Time: <timestamp>
Context: <query result>

Action: See #billing-ops-runbook for diagnosis steps
Escalate if unresolved in 15 min to @eng-oncall
```

**Critical Alerts (Failed Checkouts, Metadata Gaps):**
- Notify ops immediately
- Escalate to engineering if not resolved in 15 minutes
- Page on-call engineer if business hours + ongoing issues

**Medium Alerts (Stale Pending):**
- Notify ops during business hours
- Async investigation acceptable (non-blocking)

**Low Alerts (Legacy Frequency):**
- Daily summary only
- No escalation unless trending unexpectedly

---

## Dashboard Template

### Billing System Health

**Layout:**
```
+----------------------------------+----------------------------------+
| Failed Checkouts (15 min)        | Stale Pending (30 min)           |
| Current: 0                       | Current: 0                       |
| Threshold: > 0 ⚠️ Alert         | Threshold: > 0 ⚠️ Alert         |
+----------------------------------+----------------------------------+
| RPC Rejections (2 hours)         | Pre-Cutover Gaps (4 hours)       |
| Current: 0                       | Current: 0                       |
| Threshold: > 0 ⚠️ Alert         | Threshold: > 0 ⚠️ Alert         |
+----------------------------------+----------------------------------+
| Legacy Webhook % (24 hours)      | Credit Balance Summary           |
| Current: 0.3%                    | Total Credits: 125,450           |
| Threshold: > 5% 🟡 Investigate   | Active Users: 248                |
|                                  | Avg Credits/User: 506            |
+----------------------------------+----------------------------------+
```

---

## Post-Production Checklist

- [ ] All 5 queries integrated into monitoring system
- [ ] Alert thresholds configured
- [ ] Slack/email notifications tested
- [ ] Dashboard created and visible to on-call team
- [ ] Runbook linked from alerts
- [ ] On-call team trained on each alert type
- [ ] Escalation path documented (slack channel / pagerduty / etc)
- [ ] Query response time acceptable (< 1 second)

---

## Query Optimization Notes

**If queries run slow:**

```sql
-- All queries filter by created_at; ensure index exists:
CREATE INDEX billing_checkouts_created_at ON billing_checkouts(created_at);
CREATE INDEX processed_events_created_at ON processed_events(created_at);
CREATE INDEX processed_events_event_type ON processed_events(event_type);

-- For legacy-path frequency check, ensure text search is indexed:
CREATE INDEX processed_events_payload_text ON processed_events USING GIN(event_payload);
```

---

## Adjusting Thresholds Over Time

**After 2+ weeks in production:**
- Review alert volume: are you getting paged too often?
- Check signal-to-noise ratio: how many alerts are actionable vs noise?
- Adjust thresholds if needed:
  - **Too many alerts?** Increase threshold or increase check frequency (e.g., 30min instead of 15min)
  - **Too few alerts?** Decrease threshold or add new metrics
  - **Wrong timing?** Move checks to different schedule (e.g., skip peak traffic hours)

---

## Sunset: Pre-Cutover Legacy Parsing

Once `legacy_percentage = 0%` for 14+ consecutive days:

1. Remove legacy parsing from `external-reference.ts`
   ```ts
   // DELETE: legacy format handling
   // KEEP: v1 format only
   ```

2. Update production code and redeploy

3. Update this monitoring document to remove "Legacy Webhook Frequency" query

4. Update ops runbook to remove pre-cutover handling sections
