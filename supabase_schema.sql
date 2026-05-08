-- ============================================================
-- FARM LEDGER — Supabase Schema
-- Run this entire file in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────
-- PROFILES (linked to Supabase auth.users)
-- ─────────────────────────────────────────
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  role text default 'member' check (role in ('admin', 'member')),
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view all profiles" on public.profiles
  for select using (auth.uid() is not null);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────
-- PROJECTS
-- ─────────────────────────────────────────
create table public.projects (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  crop_type text,
  area_acres numeric(8,2),
  start_date date,
  end_date date,
  status text default 'active' check (status in ('active', 'closed', 'paused')),
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

alter table public.projects enable row level security;

create policy "Authenticated users can view projects" on public.projects
  for select using (auth.uid() is not null);

create policy "Authenticated users can insert projects" on public.projects
  for insert with check (auth.uid() is not null);

create policy "Authenticated users can update projects" on public.projects
  for update using (auth.uid() is not null);

create policy "Authenticated users can delete projects" on public.projects
  for delete using (auth.uid() is not null);

-- ─────────────────────────────────────────
-- CATEGORIES
-- ─────────────────────────────────────────
create table public.categories (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  type text not null check (type in ('expense', 'income', 'both')),
  icon text,
  sort_order int default 0
);

alter table public.categories enable row level security;

create policy "Anyone can view categories" on public.categories
  for select using (auth.uid() is not null);

-- Seed default categories
insert into public.categories (name, type, icon, sort_order) values
  ('Land Preparation', 'expense', 'tractor', 1),
  ('Seeds & Seedlings', 'expense', 'seeding', 2),
  ('Fertiliser', 'expense', 'droplet', 3),
  ('Pesticides & Herbicides', 'expense', 'bug', 4),
  ('Labour', 'expense', 'users', 5),
  ('Irrigation', 'expense', 'wave-sine', 6),
  ('Equipment & Tools', 'expense', 'tool', 7),
  ('Transport', 'expense', 'truck', 8),
  ('Storage', 'expense', 'building-warehouse', 9),
  ('Electricity & Fuel', 'expense', 'bolt', 10),
  ('Veterinary & Medicine', 'expense', 'stethoscope', 11),
  ('Feed & Fodder', 'expense', 'basket', 12),
  ('Crop Sales', 'income', 'cash', 13),
  ('Livestock Sales', 'income', 'pig', 14),
  ('Subsidy & Grant', 'income', 'rosette', 15),
  ('Other Income', 'income', 'plus-circle', 16),
  ('Other Expense', 'expense', 'minus-circle', 17);

-- ─────────────────────────────────────────
-- TRANSACTIONS
-- ─────────────────────────────────────────
create table public.transactions (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  category_id uuid references public.categories(id),
  date date not null default current_date,
  type text not null check (type in ('expense', 'income')),
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text default 'cash' check (payment_method in ('cash', 'upi', 'bank_transfer', 'cheque', 'other')),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

alter table public.transactions enable row level security;

create policy "Authenticated users can view transactions" on public.transactions
  for select using (auth.uid() is not null);

create policy "Authenticated users can insert transactions" on public.transactions
  for insert with check (auth.uid() is not null);

create policy "Authenticated users can update transactions" on public.transactions
  for update using (auth.uid() is not null);

create policy "Authenticated users can delete transactions" on public.transactions
  for delete using (auth.uid() is not null);

-- ─────────────────────────────────────────
-- VIEWS for Reports
-- ─────────────────────────────────────────

-- Project P&L summary
create or replace view public.project_summary as
select
  p.id as project_id,
  p.name as project_name,
  p.crop_type,
  p.status,
  p.start_date,
  coalesce(sum(case when t.type = 'income' then t.amount else 0 end), 0) as total_income,
  coalesce(sum(case when t.type = 'expense' then t.amount else 0 end), 0) as total_expense,
  coalesce(sum(case when t.type = 'income' then t.amount else -t.amount end), 0) as net_profit,
  count(t.id) as transaction_count
from public.projects p
left join public.transactions t on t.project_id = p.id
group by p.id, p.name, p.crop_type, p.status, p.start_date;

-- Category breakdown
create or replace view public.category_summary as
select
  t.project_id,
  p.name as project_name,
  c.name as category_name,
  c.icon as category_icon,
  t.type,
  sum(t.amount) as total_amount,
  count(t.id) as transaction_count,
  date_trunc('month', t.date) as month
from public.transactions t
join public.projects p on p.id = t.project_id
left join public.categories c on c.id = t.category_id
group by t.project_id, p.name, c.name, c.icon, t.type, date_trunc('month', t.date);

-- ─────────────────────────────────────────
-- Done! Your schema is ready.
-- ─────────────────────────────────────────
