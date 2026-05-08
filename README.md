# Farm Ledger — Setup Guide

## What you get
- Multi-user login (email + password)
- Create unlimited farm projects (Banana Farming 2026, Coffee Plantation, Poultry Batch 12, etc.)
- Track income and expense transactions per project
- Categories: Labour, Seeds, Fertiliser, Pesticides, Transport, Crop Sales, and more
- Reports: Monthly trend chart, Project P&L comparison, Category pie chart, Full summary table
- Filter transactions by project, type, date range, search

---

## Step 1 — Supabase setup

1. Go to https://supabase.com and create a new project
2. Go to **SQL Editor** in the left sidebar
3. Paste the entire contents of `supabase_schema.sql` and click **Run**
4. Go to **Project Settings → API** and copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon/public key** → `VITE_SUPABASE_ANON_KEY`

---

## Step 2 — Local development

```bash
# Clone or unzip the project
cd farm-ledger

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local
# Edit .env.local and paste your Supabase URL and anon key

# Start development server
npm run dev
```

---

## Step 3 — Deploy to Vercel

1. Push this folder to a new GitHub repo (e.g. `farm-ledger`)
2. Go to https://vercel.com → **Add New Project** → import the repo
3. In **Environment Variables**, add:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
4. Click **Deploy** — done!

---

## Step 4 — First login

1. Open the app
2. Click **Sign up** and create your admin account
3. Add your first project (e.g. "Banana Farming - 2026")
4. Start adding transactions!

---

## Default categories (pre-loaded)

**Expenses:** Land Preparation, Seeds & Seedlings, Fertiliser, Pesticides & Herbicides, Labour, Irrigation, Equipment & Tools, Transport, Storage, Electricity & Fuel, Veterinary & Medicine, Feed & Fodder, Other Expense

**Income:** Crop Sales, Livestock Sales, Subsidy & Grant, Other Income

---

## File structure

```
src/
  hooks/
    useAuth.jsx          # Auth context (login/signup/signout)
  components/
    Layout.jsx           # Sidebar + navigation
    TransactionModal.jsx # Add/edit transaction form
    ProjectModal.jsx     # Add/edit project form
  pages/
    AuthPage.jsx         # Login & signup
    Dashboard.jsx        # Overview + recent transactions
    Projects.jsx         # Project management
    Transactions.jsx     # Full transaction list + filters
    Reports.jsx          # Charts and P&L analysis
  lib/
    supabase.js          # Supabase client
```
