## Sub Admin Role + Faster Login

### 1. New `sub_admin` role
- Add `'sub_admin'` to the `app_role` enum.
- Login flow (`LoginPage.tsx`): if Access ID matches a `sub_admins` row, sign in with synthetic email `subadmin_<id>@mnrgroup.com`, set `user_metadata.role = 'sub_admin'`, route to `/sub-admin`.
- Admin can create / edit / delete Sub Admin Access IDs from a new **Settings → Sub Admins** section (name + access_id, optional auto-generate).

### 2. New table `sub_admins`
```
id uuid pk, name text, access_id text unique, user_id uuid, status text default 'active',
created_at, updated_at
```
With GRANTs + RLS (admins manage; sub_admin can read own row).

### 3. RLS updates (read-only access for sub_admin across all offices)
For `products`, `gate_passes`, `product_items`, `gate_pass_items`, `product_timeline`, `gate_pass_timeline`, `offices`, `gates`, `stores`, `departments`, `login_sessions`, `profiles`:
- Add SELECT policy: `has_role(auth.uid(), 'sub_admin')`.
For `messages`:
- Add SELECT + INSERT + UPDATE (mark read) policies so sub_admin can chat in any office context.
No INSERT/UPDATE/DELETE policies on products / gate_passes for sub_admin → strictly read-only.

### 4. Sub Admin pages (new)
Route `/sub-admin` with its own layout (Header + sidebar/mobile menu).

**Dashboard (`/sub-admin`)**
- Top: **Recent Gate Entries** (latest 10 across all offices, with office name badge).
- Below: **Recent Gate Passes** (latest 10 across all offices).
- Below: **Office cards grid** — one card per office showing:
  - Total Gate Entries, Total Gate Passes, Pending (entries+passes pending).
  - Click → `/sub-admin/offices/:officeId` details page.

**Office Details (`/sub-admin/offices/:officeId`)**
- Tabs: Gate Entries | Gate Passes (read-only lists, search/filter, click row → view dialog only, no edit/delete buttons).

**Online Users (`/sub-admin/online`)**
- List of all users (gate/store/department/admin/sub_admin) with:
  - 🟢 green dot if `last_seen_at` within 2 min, else 🔴 red dot.
  - Name, role, office, **Last seen: <relative time>**.
- Auto-refresh every 30s.

**Chat**
- Reuse existing `ChatDialog` from product/gate pass cards; sub_admin can open chat on any entry across offices.

### 5. Admin Settings: Sub Admin management UI
Add card "Sub Admins" in `SettingsPage.tsx`:
- List existing sub admins (name, access id, status, last login).
- Add / Edit / Delete actions. Access ID optional → auto-generate when blank (like other entities).

### 6. Faster Super Admin login
Current delay comes from sequential `signInWithPassword` → on failure → `signUp` → role insert → profile upsert, then heavy preload before navigate. Fixes:
- Skip the legacy password retry path for admin (use single deterministic password).
- Navigate to `/admin` **immediately** after `signInWithPassword` success; run `login_sessions` insert + profile upsert + preload in background (`void`-promises).
- Cache last successful admin session in `localStorage` so the splash spinner doesn't reappear on reload.
- Apply same "navigate first, hydrate after" pattern to sub admin login.

### Technical notes
- New files:
  - `src/pages/subadmin/SubAdminLayout.tsx`
  - `src/pages/subadmin/SubAdminDashboard.tsx`
  - `src/pages/subadmin/SubAdminOfficeDetails.tsx`
  - `src/pages/subadmin/SubAdminOnlinePage.tsx`
  - `src/components/SubAdminManager.tsx` (used inside SettingsPage)
- Edits: `App.tsx` (routes + role union), `LoginPage.tsx`, `SettingsPage.tsx`, `appPreload.ts` (preload for sub_admin = all offices summary), `Header.tsx` (show sub_admin role label).
- Migration: enum value, `sub_admins` table + GRANT + RLS, new SELECT policies for sub_admin role on existing tables, messages policies for sub_admin.

### Out of scope
- Sub admin cannot create/edit/delete entries or pass — enforced by RLS (no write policies added).
- Sub admin notifications: reuse existing `notifications` table; no new triggers added in this step.

Proceed?