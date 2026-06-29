# TLV Capital CRM

Internal CRM for TLV Capital — a defense export company managing a multi-region sales pipeline, product catalog, and client relationships.

## Prerequisites

- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- A Supabase project (cloud) or local instance

## Environment Variables

Create a `.env.local` file in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Running Locally

```bash
npm install
npm run dev
```

The app runs at `http://localhost:3000`.

## Database

Migrations live in `supabase/migrations/`. To apply them against a local Supabase instance:

```bash
supabase start
supabase db push
```

## Data Migration

To import existing data from the source spreadsheets:

```bash
npm run migrate
```

See `scripts/migrate.ts` for source file paths and field mapping.

## Documentation

- `docs/PRODUCT.md` — Business requirements (non-technical, maintained with the VP of Business Operations)
- `docs/ARCHITECTURE.md` — Stack decisions, folder structure, design patterns
- `docs/SCHEMA.md` — Database schema with all tables and columns
- `CLAUDE.md` — Instructions for Claude Code sessions
