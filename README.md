# Project Management System (PMS)

A full-featured internal **Project Management System** built with **Next.js App Router**, **TypeScript**, **Tailwind CSS**, **Prisma**, and **MySQL**.

This application is designed to manage clients, projects, sub-projects, users, assignments, time entries, estimates, reports, and billing-related workflows with role-based access control.

## Core technology stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- Prisma ORM
- MySQL
- JWT-based session authentication stored in HTTP-only cookies

## Main functional areas

### Authentication and access control
- Login with username or email
- Password hashing and secure session cookies
- Role-based routing and server-side permission checks
- User types supported:
  - Admin
  - Manager
  - Team Lead
  - Employee
  - Report Viewer
  - Accounts
- Functional role support for scoped manager and team-lead workflows

### Dashboard
- Summary cards and operational overviews
- Billing-focused visibility for permitted roles
- Reporting and workflow shortcuts

### User management
- Create users
- Edit users
- Activate/deactivate users
- Change password
- Profile management
- Functional role mapping
- Role-based user visibility and moderation rules

### Client management
- Create and edit clients
- Client-level settings that control whether Countries, Movies, and Languages appear in Time Entries and Estimates
- Optional project-type behavior controlled from client-level settings

### Country and language management
- Manage country master list
- Manage language master list
- Country ISO code usage in reports and filters
- Active/inactive controls

### Movie management
- Create and edit movies
- Client-linked movie records
- Use movies in time entries and reporting
- Movie-wise reporting with filters and CSV export

### Project management
- Create and edit projects
- Status support such as Draft, Active, On Hold, Completed, and Archived
- Client-linked project ownership
- Assignment-aware project visibility
- Project-level flags that can override client-level entry field visibility

### Sub-project management
- Create and edit sub-projects
- Client -> Project dependent selection
- Sub-project level override options for Countries and Movies visibility in entries
- Assignment-ready structure for user/project mapping

### Team lead assignments
- Assign employees to team leads
- Team Lead moderation limited to assigned employees
- Functional-role matching rules for review/moderation

### User assignments
- Assign users at project level or sub-project level
- Client -> Project -> Sub-Project dependent filtering
- Project-level assignment and sub-project-level assignment support
- Assignment validation to prevent invalid removals when entries already exist

### Time entries
- Create time entries
- Edit time entries
- Delete time entries for Admin / Manager / Team Lead users with valid access
- Client -> Project dependent filters on list pages
- Project / Sub-project / Country / Movie / Language support depending on client/project/sub-project settings
- Prevent future dates on create and edit
- Default date support can be set to today in create forms
- Status workflow and moderation
- Pagination on list page

### Estimates
- Create estimates
- Edit and resubmit estimates
- Delete estimates for Admin / Manager / Team Lead users with valid access
- Client -> Project dependent filters on list pages
- Project / Sub-project / Country / Movie / Language support depending on client/project/sub-project settings
- Prevent future dates on create and edit
- Review and moderation workflow
- Pagination on list page

### Billing and transactions
- Billing transactions stored against projects
- Effective date support
- Billing transaction type support
- Billing dashboard visibility for authorized roles

### Reports
Reports currently include:
- Client-wise hours
- Project / Sub-Project-wise hours
- Task-wise detailed hours
- Movie-wise minutes

Report capabilities include:
- Independent filter sets per report section
- Date range filters
- Client / Project / Sub-Project dependent filters
- Country filters where applicable
- Movie-based dependent filtering in the Movie-wise report
- Pagination
- Anchor-based focus retention on Apply and Pagination
- CSV export for all supported report sections
- Employee-wise report section kept hidden unless needed later

## Important rules already enforced
- Team Leads can only act on employees assigned to them
- Role-scoped Managers are limited by matching functional role rules where applicable
- Project and sub-project visibility is assignment-aware
- Entry forms validate whether selected client/project/sub-project/movie/language/country combinations are valid
- Future dates are blocked in Time Entries and Estimates

## Prerequisites

Install the following before setup:

- Node.js 20 or newer
- npm
- MySQL 8.x recommended
- Git

Recommended but optional:
- Linux / WSL / macOS shell
- Process manager such as PM2, systemd, or Docker Compose for non-development environments
- Reverse proxy such as Nginx or Caddy for production hosting
- Object storage such as S3-compatible storage if the project is extended with file uploads
- Email provider if notification or reminder functionality is added later

## Required environment variables

Create a `.env` file based on `.env.example`.

Typical required values:

```env
DATABASE_URL="mysql://username:password@127.0.0.1:3306/pms_db"
SESSION_SECRET="replace-with-a-long-random-random-secret"
APP_URL="http://localhost:3000"
AUDIT_LOG_ENABLED="true"
```

Use a long random value for `SESSION_SECRET`.

## Installation steps

### 1. Copy environment file
```bash
cp .env.example .env
```

### 2. Update environment variables
Set your database connection, app URL, session secret, and any optional flags.

### 3. Install dependencies
```bash
npm install
```

### 4. Create the database
Example MySQL command:

```sql
CREATE DATABASE pms_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 5. Generate Prisma client
```bash
npx prisma generate
```

### 6. Apply schema
For a fresh environment:
```bash
npx prisma db push
```

If you are using migrations in your environment:
```bash
npx prisma migrate deploy
```

### 7. Seed sample data
```bash
npm run db:seed
```

### 8. Start development server
```bash
npm run dev
```

Open:
```text
http://localhost:3000/login
```

## Seed credentials

If seed data is enabled in the current project version, typical sample users may include:
- Admin
- Manager
- Team Lead
- Employee

Check `prisma/seed.ts` for the exact current credentials and demo records used in your copy.

## Useful development commands

```bash
npm install
npm run dev
npm run build
npm run lint
npx prisma generate
npx prisma db push
npx prisma migrate deploy
npm run db:seed
```

## Production checklist

Before going live, remember the following:

- Use a strong production `SESSION_SECRET`
- Use production database credentials with least-privilege DB access
- Keep `NODE_ENV=production`
- Make sure cookies are served over HTTPS
- Put the app behind a reverse proxy and TLS/SSL
- Store secrets in the server environment, never in source control
- Take regular database backups
- Test Prisma generate and migration/deploy flow in the target environment
- Verify all required environment variables are available at build time and runtime
- Review audit-log settings and keep them enabled where required
- Confirm timezone handling for reports, time entries, estimates, and scheduled jobs
- Monitor server logs and application errors
- Restrict direct public access to the database
- Run the app with a process manager or containers so it restarts automatically after failure or reboot
- Review CORS, headers, and security hardening if the app is exposed publicly
- Validate CSV export access by role before release
- If email and reminders are added later, configure SPF / DKIM / provider credentials before enabling them

## Notes for deployment in any environment

This application can be deployed in any environment that supports:
- Node.js runtime
- MySQL connectivity
- Environment variable injection
- Ability to run Prisma generate and schema deployment commands
- Persistent process management for the application server

Typical deployment approaches:
- Single Linux server
- VPS with reverse proxy
- Docker / Docker Compose
- Container platform
- Managed Node.js hosting with external MySQL

## Project structure highlights

- `app/` -> Next.js App Router pages and layouts
- `components/` -> reusable UI and form components
- `lib/actions/` -> server actions
- `lib/` -> auth, permissions, db helpers, domain rules, guards, utilities
- `prisma/` -> Prisma schema and seed data

## Final note

This PMS is built as a role-aware internal business application. Before production rollout, validate:
- role permissions
- review flows
- assignment flows
- report filters
- CSV exports
- seed/demo data removal if not needed
- environment-specific URLs and secrets
