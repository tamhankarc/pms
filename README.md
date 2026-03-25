# PMS Next.js Starter

A production-minded starter for your internal **Project Management & Billing System** built with **Next.js App Router**, **Tailwind CSS**, **Prisma**, and **MySQL**.

## What this starter already includes

- Role-based app shell and login
- Platform user types: Admin, Manager, Team Lead, Employee, Report Viewer
- Fixed functional role per employee/team lead for reporting
- Employee groups for project visibility
- Client-first project model with **optional movie linkage**
- Time entry submission and moderation
- Estimate submission and moderation
- Team Lead ↔ Employee assignment model
- Project billing transactions:
  - Partial billing
  - Upgrade before completion
  - Upgrade after completion
  - Adjustment
- Seed data and sample dashboard/report pages

## Important moderation rule already enforced

- Every employee can be assigned to one or more Team Leads.
- A Team Lead can only moderate **time entries** and **estimates** for employees explicitly assigned to them.
- Admin and Manager can perform **full project-level moderation**.

## 1) Local setup in WSL

### Prerequisites

- Node.js 20.19+ or 22.12+ or 24+ recommended by Prisma's current Next.js guide. citeturn584036view0
- MySQL running locally in WSL, Docker, or another reachable host
- Git

### Create env file

```bash
cp .env.example .env
```

Update `.env`:

```env
DATABASE_URL="mysql://root:password@127.0.0.1:3306/pms_db"
SESSION_SECRET="replace-with-a-long-random-secret"
APP_URL="http://localhost:3000"
```

### Install dependencies

```bash
npm install
```

### Create database

```sql
CREATE DATABASE pms_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Generate Prisma client and push schema

```bash
npx prisma generate
npx prisma db push
```

### Seed the database

```bash
npm run db:seed
```

### Start development server

```bash
npm run dev
```

Open:

```text
http://localhost:3000/login
```

### Seed credentials

- Admin: `admin@company.com` / `Admin@123`
- Manager: `manager@company.com` / `Manager@123`
- Team Lead: `lead@company.com` / `Lead@123`
- Employee: `dev1@company.com` / `Employee@123`

## 2) Suggested WSL workflow

```bash
cd ~/projects
unzip pms-nextjs.zip
cd pms-nextjs
cp .env.example .env
npm install
npx prisma db push
npm run db:seed
npm run dev
```

If you use VS Code:

```bash
code .
```

## 3) Deploying to Vercel + Railway

This repository is ready for the setup you described:

- **Vercel** for the Next.js app
- **Railway MySQL** for the database

Prisma documents a Next.js + Prisma deployment flow to Vercel, and Vercel's Railway integration can expose Railway database variables such as `DATABASE_URL` to Vercel deployments. citeturn584036view0turn584036view2

### Railway

1. Create a Railway project
2. Add a **MySQL** database service
3. Copy the generated `DATABASE_URL`

### Vercel

1. Push this project to GitHub
2. Import the repo into Vercel
3. Add environment variables:
   - `DATABASE_URL`
   - `SESSION_SECRET`
   - `APP_URL`
4. Keep install/build settings standard initially

Prisma recommends regenerating Prisma Client during Vercel builds and using `prisma migrate deploy` in deployment workflows. This starter already includes `postinstall: prisma generate`; for production migrations, use `npm run db:deploy`. citeturn584036view1

### Optional production build script

```json
"vercel-build": "prisma generate && prisma migrate deploy && next build"
```

That pattern comes directly from Prisma's Vercel deployment guidance. citeturn584036view1
