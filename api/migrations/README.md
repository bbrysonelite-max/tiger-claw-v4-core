# Migrations

Versioned SQL migrations applied automatically at startup by `services/migrate.ts`.

## Naming convention

Use zero-padded sequential integers only:

```
001_initial.sql
002_unify_tenants.sql
...
025_add_missing_indexes.sql
026_your_next_migration.sql
```

**No letter suffixes.** `005a_hive_foundation.sql` exists as a legacy exception — do not repeat this pattern. A new migration that needs to slot between existing ones should take the next available number, not a letter suffix.

## Rules

- Every migration runs once, tracked in the `schema_migrations` table.
- Each migration file runs in a single transaction. A failure rolls back the entire file.
- Never edit a migration that has already run in production. Write a new migration instead.
- Use `IF NOT EXISTS` / `IF EXISTS` guards so migrations are safe to re-run during development.
