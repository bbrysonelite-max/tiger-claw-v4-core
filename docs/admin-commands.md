# Tiger Claw Admin Commands

The `tiger-admin` internal operations co-pilot supports natural language querying over Tiger Claw's stateless fleet and Hive intelligence network. Since it runs the standard native agent loop, you can request BI and system data conversationally.

## Supported Queries

### Fleet Status
* "What is the fleet status?"
* "Give me a breakdown of active vs paused tenants."
* "List running trials."
* "Summarize the fleet briefing."
* *Tool Triggered: `tiger_briefing` (Admin Mode)*
* *Returns: Total active/paused tenants, trial counts with hours remaining, and 24h conversion stats.*

### Hive Health & Intelligence
* "What's the health of the Hive network?"
* "Check source staleness."
* "What's our community unlock progress?"
* "Are any platform sources stale?"
* *Tool Triggered: `tiger_hive` (query action in Admin Mode)*
* *Returns: Prior source staleness warnings, ICP signal aggregation status, and founding member unlock counts per vertical.*

### Queue Depth / System Anomalies (Direct API)
* "What is the current queue depth?"
* *Tool Triggered:* The agent can infer queue health and anomalies by interrogating system stats if built-in, otherwise refer to the GCP dashboard.

## Security & Architecture Notes
- **Isolation:** Admin tenant interactions are hard-guarded by `hiveEmitter.ts`. Admin messages and mock conversions **will not** pollute the global anonymous Hive intelligence pool.
- **Provisioning:** The admin tenant is flagged via the API `POST /admin/provision` as comped (bypassing the 72h trial expiry) and non-Hive opted (`hiveOptIn: false`).
