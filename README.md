# Student Connect

A department/university student networking platform — profiles, discovery, connections,
messaging, groups, mentorship, events, and an admin panel.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres, Auth,
Storage, Realtime, RLS) · TanStack Query · Recharts (analytics, later phase) · Vercel.

**Local development runs entirely in Docker** — see [Docker workflow](#docker-workflow).

---

## Build status

The project is being built phase by phase.

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Project scaffold, Supabase setup, Auth, Profiles, Onboarding | ✅ Done |
| 2 | Discovery / search + Connections | ✅ Done |
| 3 | Groups & communities (incl. auto batch groups) | ✅ Done |
| 4 | Messaging (DMs, then group chat) | ✅ Done |
| 5 | Events & announcements | ✅ Done |
| 6 | Mentorship | ✅ Done |
| 7 | Admin / moderation panel | ✅ Done |
| 8 | Analytics dashboard | ⬜ Not started |
| 9 | Polish: responsive QA, RLS audit, seed data, deploy | ⬜ Not started |

---

## Setup

Everything runs in Docker — nothing is installed or served on your host machine.
You need Docker Desktop (or any Docker engine) running; you do **not** need Node.js
installed locally.

### 1. Create a Supabase project

Create one at [supabase.com](https://supabase.com), then grab the values from
**Project Settings → API**.

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY`. Set `NEXT_PUBLIC_COLLEGE_EMAIL_DOMAIN` to your college's
email domain (no `@`).

### 3. Run the migrations

In the Supabase dashboard open **SQL Editor** and run each file in
`supabase/migrations/` in order:

| File | What it does |
| --- | --- |
| `0001_profiles.sql` | `profiles`, enums, RLS, `avatars` bucket, signup trigger |
| `0002_phase1_audit_fixes.sql` | Audit fixes — upgrade path only |
| `0003_rls_perf_and_year_bounds.sql` | Audit fixes — upgrade path only |
| `0004_connections_and_discovery.sql` | `connections`, `notifications`, their RLS and triggers |
| `0005_discovery_functions.sql` | `search_profiles`, `suggested_people`, `connection_state` |
| `0006_connection_lifecycle_fixes.sql` | Phase 2 audit fixes — durable rejections, reachable restricted profiles |
| `0007_groups.sql` | `groups`, `group_members`, the feed tables, and their RLS |
| `0008_group_triggers.sql` | Owner assignment, auto batch groups, join notifications, covers bucket |
| `0009_group_ownership_fixes.sql` | Phase 3 audit fixes — owner protection, ownership transfer, member counts |
| `0010_messaging.sql` | `conversations`, `conversation_participants`, `messages`, RLS, and the messaging RPCs |
| `0011_messaging_fixes.sql` | Phase 4 audit fixes — group-chat moderation, private unused DMs |
| `0012_events_announcements.sql` | `events`, `event_rsvps`, `announcements`, RLS, reminders, covers bucket |
| `0013_event_fixes.sql` | Phase 5 audit fixes — `ends_at` generated column, aggregated RSVP counts |
| `0014_mentorship.sql` | `mentors`, `mentor_availability`, `mentorship_requests`, and their RLS |
| `0015_mentorship_functions.sql` | Booking RPCs, directory search, mentorship notifications |
| `0016_mentorship_fixes.sql` | Phase 6 audit fixes — transition guard, booking limit, decline cooling-off |
| `0017_mentorship_polish.sql` | Phase 6 audit fixes — single-mentor lookup, paused visibility, slot hygiene |
| `0018_reports_and_admin.sql` | `reports`, admin RPCs, and the club-admin escalation fix |
| `0006_connection_lifecycle_fixes.sql` | Phase 2 audit fixes — reachable restricted profiles, durable rejections |

On a **fresh** database, `0001` already contains the audit fixes, so `0002` and `0003`
are no-ops — running them anyway is harmless.

`0001` already includes the Phase 1 audit fixes, so a fresh project needs nothing
further. **If you ran `0001` before those fixes landed**, also run
`supabase/migrations/0002_phase1_audit_fixes.sql` — it repairs the email-sync trigger
and tightens the self-insert policy. Running it on a fresh project is harmless.

With the Supabase CLI instead:

```bash
supabase link --project-ref your-project-ref
supabase db push
```

### 4. Set the allowed signup domain in the database

The client-side check uses the env var; the database trigger is what actually enforces
the rule. Keep them in sync:

```sql
update public.app_settings
set value = 'your-college.edu'
where key = 'allowed_email_domain';
```

Set it to an empty string to allow any domain.

### 5. Configure Auth in the Supabase dashboard

**Authentication → URL Configuration**

- Site URL: `http://localhost:3000`
- Redirect URLs: `http://localhost:3000/auth/callback` (add your production URL too)

**Authentication → Providers → Email**: enable *Confirm email*.

**Authentication → Providers → Google** (optional): enable it and paste your Google OAuth
client ID and secret. In the Google Cloud console, the authorised redirect URI is
`https://<your-project-ref>.supabase.co/auth/v1/callback`.

### 6. Start the app

```bash
docker compose up web
```

First run builds the image and installs dependencies inside the container. Open
<http://localhost:3000>. Source is bind-mounted, so hot reload picks up your edits.

### 7. Seed dummy data (optional)

With the stack running, in a second terminal:

```bash
docker compose run --rm seed
```

Creates eight pre-verified students. They all use the password `Password123`.

---

## What Phase 1 covers

**Authentication**
- Email/password signup and sign-in, plus Google OAuth
- Signup restricted to a configurable college email domain — validated in the form and
  enforced by a database trigger, so it cannot be bypassed by calling the API directly
- Email verification required before the app is reachable
- Password reset flow
- Session refresh and route guards in `middleware.ts`

**Profiles**
- `profiles` table with skills/interests arrays, social links, visibility, and role
- Public profile page at `/profile/[id]`, editable at `/profile/edit`
- Profile completeness indicator (8 weighted sections)
- Visibility toggle: public / department-only / connections-only

**Onboarding**
- Three-step wizard after first signup: basics + photo → skills/interests → links + privacy
- Avatar upload to the `avatars` Supabase Storage bucket, scoped per user by RLS

**Row Level Security**
- Every table has RLS enabled with explicit policies
- Profile reads respect the owner's visibility setting
- A trigger blocks users from editing their own `role`, `is_active`, `id`, or `email`

---

## What Phase 2 covers

**Discovery / search**
- `/discover` with debounced search over name, skills, and interests
- Filter panel: branch, year, skill tags, interest tags — all held in the URL, so a
  filtered view is shareable and survives a refresh
- Paginated grid of profile cards
- "People you may know" on the dashboard, scored in SQL: shared skills ×3, shared
  interests ×2, mutual connections ×4, same branch ×1

**Connections**
- Send, accept, reject, cancel, and disconnect
- `/connections` with Connections / Requests / Sent tabs and in-list search
- Mutual connection count on other people's profiles
- Notifications on request and on acceptance, written by database triggers

**Row Level Security**
- A connection row is visible only to its two participants
- Only the addressee can accept or reject; the requester cannot self-accept
- A unique index on the *unordered pair* blocks duplicate and reciprocal requests
- `notifications` has no INSERT policy — only the `SECURITY DEFINER` triggers write them
- `visibility = 'connections'` now resolves properly via `are_connected()`

> Discovery SQL runs with **invoker** rights so profiles RLS applies automatically and a
> search can never surface a profile the viewer is not allowed to see.
> `mutual_connection_count()` is the one `SECURITY DEFINER` exception, and it returns a
> count rather than rows.

---

## What Phase 3 covers

**Groups**
- `/groups` with search, category chips (club / batch / project / interest), and a "my groups" filter
- `/groups/new` — public groups join instantly, private groups queue for approval
- `/groups/[id]` — feed, member roster, and admin controls in one page
- Roles: owner, admin, member. Owners must hand over the group before leaving

**Feed**
- Posts, comments, and likes, all scoped to active members
- Authors delete their own content; group admins moderate anything

**Auto batch groups**
- A student is enrolled into a `<branch> — Year <n>` group automatically, and moves
  across groups when their year or branch changes
- Batch groups cannot be created by hand — the RLS insert policy refuses
  `category = 'batch'`, so only the trigger makes them

**Ownership**
- Owner, admin, and member roles. Group admins can manage members but cannot promote
  themselves to owner, demote the owner, or remove them — the policies constrain the
  *mutation*, not just the actor
- An owner cannot leave or be removed, so a group is never stranded without an
  administrator. `transfer_group_ownership()` is the sanctioned way out: it demotes the
  outgoing owner to admin and promotes an existing active member atomically

**Row Level Security**
- Groups are listable by everyone, including private ones — a private group has to be
  discoverable for anyone to request to join. Privacy is enforced on the feed and
  roster, not on the group's existence
- A pending member can see their own row (so they know they are waiting) but cannot
  read posts, comment, or like
- Nobody can self-insert as owner or admin; the creator's ownership is granted by a
  `SECURITY DEFINER` trigger
- Member counts come from `group_member_counts()`, not from reading `group_members`.
  That table is deliberately unreadable for groups you have not joined, so counting
  rows directly reported zero members for every group on the browse page

> The spec lists `group_members` as `(group_id, user_id, role)`. A `status` column is
> added so private-group approval works without a second table. The spec also says batch
> groups are generated "on signup", but year and branch are only known after onboarding,
> so the trigger fires on profile change instead.

---

## What Phase 4 covers

**Direct messages**
- Restricted to connections. `get_or_create_dm()` refuses a stranger and reuses the
  existing thread rather than creating duplicates
- Reading history and sending are separate permissions: a thread stays readable after
  two people disconnect, but sending stops. Otherwise "restricted to users who are
  connected" would be unenforceable the moment either side withdraws

**Group chat**
- One conversation per group, opened on demand by any member
- Membership is *derived* from `group_members` rather than copied into
  `conversation_participants`, so leaving a group revokes chat access immediately and
  no stale participant row can outlive it

**Realtime**
- The thread subscribes to `postgres_changes` on `messages`, filtered to its own
  conversation, and handles INSERT and DELETE
- `messages` is added to the `supabase_realtime` publication by the migration, guarded
  so the same file still runs on a plain Postgres

**Moderation**
- Group admins can delete messages in their own group's chat, matching what they can
  already do in the group feed. The grant is scoped by `can_moderate_conversation()`:
  it applies to group conversations they administer and to nothing else — a plain
  member still cannot touch anyone else's message

**Read state**
- `read_by uuid[]` per message; unread counts and last-message previews come from a
  single `list_conversations()` call
- There is **no UPDATE policy** on `messages` at all, so content can never be rewritten
  and `read_by` can only move through `mark_conversation_read()`, which appends the
  caller and nobody else

> Opening a DM records `created_by`. Until the first message is sent the thread is
> visible only to whoever opened it, so clicking "Message" and changing your mind does
> not put an empty conversation in someone else's list.

> The spec lists `conversation_participants` for both conversation kinds. It is used for
> DMs only; group membership is derived. Duplicating it would let the two drift apart,
> and a stale row there would mean access to a chat you had left.

---

## What Phase 5 covers

**Events**
- `/events` with upcoming/past and category filters; `/events/[id]` with the full detail
  and attendee list
- Only club admins and super admins publish. A club admin manages their own events; a
  super admin manages anyone's

**RSVPs**
- Going / interested / can't go, and tapping the active choice clears it
- Going and interested are public — an attendee count nobody can read is not a count.
  **"Can't go" stays private**, visible only to the person who declined, the organiser of
  that specific event, and super admins
- Because only the public statuses are ever counted, counting through RLS stays accurate
  here — unlike the group member counts in Phase 3

**Announcements**
- Department-wide feed with pinned items first; admins publish, pin, and delete

**Times**
- Event times are stored as real instants. `<input type="datetime-local">` submits a
  bare wall clock with no zone, so the browser converts it against the admin's own zone
  before it is sent — otherwise a `timestamptz` resolves it in the *database's* zone and
  every event lands hours off
- Times render in the reader's zone with an explicit zone label. The first paint is
  labelled UTC so server and client markup match, then the local rendering replaces it
- `ends_at` (a generated `coalesce(end_time, start_time)`) decides upcoming vs past, so
  an event that has started but is still running is not filed under "past"

**Reminders**
- `generate_event_reminders()` creates an in-app notification for events you said you
  were going to that start within 24 hours, naming the event and linking to it
- It is a **pull model**: the caller generates their own reminders when they open the
  notifications page, so no scheduler is required. A `NOT EXISTS` guard makes it
  idempotent, so repeated calls cannot spam anyone

---

## What Phase 6 covers

**Opting in**
- Join the mentor directory with expertise tags and a note; pause new requests without
  leaving, or leave entirely
- The other half — flagging yourself as *seeking* mentorship — is a `seeking_mentorship`
  boolean on the profile, since the spec's schema covers mentors only

**Directory**
- `/mentorship` with keyword search over name and expertise, plus expertise, branch, and
  year filters, paginated
- `search_mentors()` runs as `SECURITY DEFINER` **on purpose**: listing yourself is the
  consent to be seen, so a mentor whose profile visibility is `department` or
  `connections` still appears. Otherwise the directory would quietly hide the people
  most likely to have restricted their profile — the same trap connections-only profiles
  fell into in Phase 2. Only directory-appropriate columns are returned

**Requests**
- Mentee sends a short message → mentor accepts or declines → either side marks it
  completed. A partial unique index allows only one *live* thread per pair
- The state machine is enforced by a trigger, not by the policy: RLS splits OLD from NEW
  and cannot express the pairing between them, so `requested → completed` was reachable
  without the mentor ever accepting. Only the mentor answers a request, and only an
  accepted mentorship can be completed
- A decline holds for **30 days** before the same mentee can ask again. Connections make
  a rejection permanent; a mentorship decline is usually "not this term", so this is a
  cooling-off period rather than a ban — but it is no longer zero

**Scheduling**
- Mentors publish slots; only a mentee whose request has been **accepted** can book one
- Booking goes through `book_mentor_slot()`, which claims the slot with a conditional
  update — two mentees racing for the same slot means the second gets a clear error
  rather than a double booking
- One live booking per mentee per mentor, so a single student cannot take every slot on
  offer. Release the one you hold to move to a different time
- Open slots are public so mentees can see what is there; *who* booked a slot is visible
  only to the mentor and the booker, and the mentor's own list names them
- Slots must be in the future and cannot overlap — the first is enforced by the insert
  policy (a CHECK constraint cannot call `now()`), the second by a GiST exclusion
  constraint on `(mentor_id, tstzrange(slot_start, slot_end))`
- Pausing takes a mentor out of the directory and hides their row from strangers, while
  staying visible to themselves and to anyone they have an accepted mentorship with

---

## What Phase 7 covers

**Roles**
- `student` / `club_admin` / `super_admin`. `/admin` is guarded in middleware, but that
  is convenience only — **every admin RPC re-checks the caller's role in SQL**, so a
  direct API call gets nowhere even if the route guard were bypassed
- Building this surfaced a pre-existing escalation: `is_admin()` covers club admins *and*
  super admins, and both the profiles update policy and the privilege guard used it — so
  any club admin could promote themselves to super_admin or deactivate anybody. Role and
  `is_active` changes now require `is_super_admin()`

**Moderation**
- Anyone can report a post, message, or profile — but only something they can actually
  see. Without that check, a guessed message id plus the `SECURITY DEFINER` queue turned
  reporting into a way to surface a stranger's private DM to moderators
- One open report per person per target, and the target has to exist
- The queue runs as `SECURITY DEFINER` so a moderator can read reported content without
  being a member of the group or a party to the conversation it sits in
- Actions: remove the content and close, mark handled, or dismiss

**User management** (super admin only)
- Search by name or email, change roles, deactivate and reactivate accounts
- You cannot deactivate yourself, and the **last** active super admin cannot step down —
  otherwise the panel would lock everyone out

**Content management**
- Events: create, edit (`/events/[id]/edit`), and delete
- Announcements: publish, edit inline, pin, and delete

**Group approval queue**
- Pending private-group requests across every group you administer; super admins see all

---

## Testing

Two container-only harnesses, neither of which touches Supabase:

```bash
docker compose --profile tools run --rm db-validate   # every migration applies, twice
docker compose --profile tools run --rm db-test       # RLS behaviour suite
```

`db-test` boots a throwaway Postgres, stubs the Supabase-managed objects
(`auth.users`, `auth.uid()`, `storage.*`), applies every migration, then asserts real
policy behaviour as different users — that a requester cannot self-accept, that a
rejection cannot be erased and re-sent, that a pending member cannot read a group feed,
and so on. Run it after any migration change.

---

## Project structure

```
app/
  (auth)/            login, signup, verify-email, forgot/reset password
  auth/              callback route, sign-out route, server actions
  onboarding/        three-step profile setup wizard
  profile/[id]/      public profile page
  profile/edit/      profile editor
  dashboard/         signed-in landing page
  discover/          search + filters + results grid
  connections/       connections, requests, sent
  groups/            group list, creation, and group detail
  messages/          conversation list and thread view
  events/            event list, creation, and event detail
  mentorship/        directory, mentor settings, requests, mentor detail
  admin/             overview, moderation queue, users, group requests
  announcements/     department-wide announcement feed
  notifications/     notification feed
components/
  ui/                reusable component library (button, input, modal, tag input, …)
  auth/              auth forms
  onboarding/        wizard steps
  profile/           profile header, tag list, completeness card
  discover/          search bar, filter panel, profile card, suggestions
  connections/       connection button, connection list
  groups/            group card, join button, feed, member management
  messages/          conversation list, realtime thread, composer
  events/            event card, RSVP buttons, announcement feed, cover upload
  mentorship/        mentor card, filters, availability, booking, requests
  admin/             report queue, user table, group requests, report button
  notifications/     notification bell
  layout/            app navigation
lib/
  supabase.ts        central browser client
  supabase/          server, admin, and middleware clients
  actions/           server actions
  queries/           server-side data access
  validation.ts      Zod schemas
  types/database.ts  generated-style database types
supabase/
  migrations/        0001 schema + RLS, 0002 audit fixes
scripts/
  seed.ts            dummy data for local testing

Dockerfile           multi-stage: deps → dev / builder → runner / ci
docker-compose.yml   web (dev), ci, seed, web-prod services
.dockerignore
```

---

## Docker workflow

All commands run in containers. Nothing touches your host.

| Command | Description |
| --- | --- |
| `docker compose up web` | Dev server with hot reload → <http://localhost:3000> |
| `docker compose up -d web` | Same, detached |
| `docker compose logs -f web` | Tail the dev server logs |
| `docker compose run --rm ci` | Typecheck + lint (exits non-zero on failure) |
| `docker compose run --rm seed` | Insert dummy students |
| `docker compose exec web sh` | Shell inside the running dev container |
| `docker compose run --rm ci npm run build` | Production build check |
| `docker compose down` | Stop and remove containers |
| `docker compose down -v` | Also drop the `node_modules` / `.next` volumes |

Production image (serves the optimised build on port **3001**):

```bash
docker compose --env-file .env.local --profile prod up web-prod
```

`--env-file` is required here because Compose interpolates **build args** from the shell
and `.env` only — `env_file:` applies at runtime, not at build time, and `next build`
inlines the `NEXT_PUBLIC_*` values.

### Validating migrations

Before any SQL goes near Supabase, it is applied to a throwaway Postgres that stubs out
the Supabase-managed objects (`auth.users`, `auth.uid()`, `storage.*`, and the
`authenticated` role):

```bash
docker compose --profile tools run --rm db-validate
```

Every migration runs twice, so a failure also catches anything that is not idempotent.

The RLS policies and triggers have a behavioural suite on top of that — it asserts who
may accept, reject, delete, and read what:

```bash
docker compose --profile tools run --rm db-test
```

Both are stubs, not Supabase. They prove the SQL executes and the policies admit and deny
the right rows; they do not replace testing against a real project.

### Adding a dependency

Because `node_modules` lives in a named volume, install through the container so the
volume and `package.json` stay in sync:

```bash
docker compose run --rm ci npm install <package>
docker compose build web
```

### Image stages

| Stage | Purpose |
| --- | --- |
| `deps` | `npm ci`, cached on the lockfile alone |
| `dev` | Hot-reloading dev server |
| `builder` | Runs `next build` |
| `runner` | Minimal production image, non-root `nextjs` user |
| `ci` | Typecheck, lint, and one-off scripts |

### npm scripts (run inside containers)

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm run seed` | Insert dummy students |

---

## Deployment (Vercel)

1. Push the repository to GitHub and import it into Vercel.
2. Add every variable from `.env.example` to the Vercel project, setting
   `NEXT_PUBLIC_SITE_URL` to the production URL.
3. Add `https://your-app.vercel.app/auth/callback` to the Supabase redirect allow-list and
   set the Supabase Site URL to the production URL.
