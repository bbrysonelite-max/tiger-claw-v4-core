# Tiger Claw Admin Commands

The `tiger-admin` internal operations co-pilot supports natural language querying over Tiger Claw's stateless fleet and Hive intelligence network. Since it runs the standard native agent loop, you can request BI and system data conversationally.

## Supported Queries

- **"Fleet status"** → active tenants, trials, paused, suspended
- **"Hive health"** → signal freshness, stale sources, ICP sample sizes
- **"Who's in trial right now?"** → list active trials with hours remaining
- **"Any paused tenants?"** → tenants whose trial ended without payment
- **"Queue status"** → BullMQ depth and recent job failures
- **"Show founding members"** → leaderboard per vertical+region
- **"What needs attention?"** → surfaces anything anomalous across fleet + Hive
- **"Provision [name] as [flavor] in [region]"** → triggers provisioner
