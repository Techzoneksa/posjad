# JAAD CLOUD Supabase Database

This folder contains the clean-instance migration flow for the standalone Node.js backend.

## Apply to a New Supabase Instance

1. Copy `server/.env.example` to `server/.env`.
2. Set `DATABASE_URL` to the Supabase direct PostgreSQL connection string.
3. From `server/`, install dependencies:

```bash
npm install
```

4. Build the consolidated SQL file:

```bash
npm run build:migration
```

5. Apply the historical migrations plus the hardening layer:

```bash
npm run db:migrate
```

The script applies the files from `supabase/migrations/` in filename order, records checksums in `public._jaad_migration_history`, then applies `server/db/hardening.sql`.

## Manual SQL Editor Path

If direct database access is not available, run:

```bash
npm run build:migration
```

Then paste `server/db/consolidated.sql` into the Supabase SQL editor for the new project.

## Security Notes

- `public.has_role(_user_id uuid, _role public.app_role)` is recreated as `SECURITY DEFINER` with `search_path = public`.
- `public.is_admin(_user_id uuid)` is recreated the same way.
- Execute access is restricted to the `authenticated` role.
- RLS is enabled dynamically on all public application tables after the historical migrations finish.
