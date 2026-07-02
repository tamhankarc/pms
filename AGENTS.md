# AGENTS.md

## Project

This is a Next.js App Router + Prisma + MySQL PMS project.

## Important rules

- Do not remove existing functionality unless explicitly requested.
- Inspect existing patterns before editing.
- Preserve client-specific billing logic.
- Preserve existing permission and menu access rules.
- Prefer complete, safe changes over partial patches.
- Do not expose secrets.
- Do not modify production .env.
- Do not run destructive database commands.
- Do not reset, drop, or truncate database tables.

## Commands to run after changes

```bash
npx prisma validate
npx prisma generate
npm run build
```
