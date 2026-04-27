# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Seam is a personal iOS app (Expo + React Native) for deciding whether to buy
vintage clothing by comparing candidate items against owned items by
measurement, price, condition, and duplication risk. Local-first; no auth; no
App Store distribution. Full requirements live in `plan/initial-plan.md`.

## Monorepo layout

pnpm workspaces + Turborepo. Three packages, all `private`:

- `packages/app/` — Expo SDK 54 iOS app. Expo Router (`app/` dir), expo-sqlite,
  Drizzle ORM, Zustand, react-hook-form, expo-notifications.
- `packages/domain/` — pure-TS domain logic (`type: "module"`). No RN / Expo
  imports. Subpath exports: `compare`, `scoring`, `extraction`, `pricing`,
  `wear`, `units`, `rules`. Tested with Vitest.
- `packages/shared/` — Zod schemas, TS types, and constants (Japanese
  display labels like `CATEGORY_LABEL` live as `*_LABEL` exports under
  `constants/`). Imported by both `app` and `domain`.

Workspace path aliases (resolved by `tsconfig` paths and Metro):

- `@seam/shared`, `@seam/shared/*`
- `@seam/domain`, `@seam/domain/*`
- `@/*` → `packages/app/src/*` (app only)

`@seam/domain` and `@seam/shared` resolve directly to source (`./src/index.ts`)
— they are not built before consumption. Don't add a `dist`-based build step
unless you also wire it into `turbo.json` and the package `exports`.

## Commands

Run from the repo root unless noted. Turbo handles cross-package orchestration.

```sh
pnpm install              # install all workspaces
pnpm typecheck            # turbo run typecheck (each package: tsc --noEmit)
pnpm test                 # turbo run test (vitest run in each package)
pnpm lint                 # turbo run lint (only @seam/app has eslint)
pnpm build                # turbo run build
pnpm format               # biome format --write . (config: biome.json)
pnpm format:check         # biome format . — used by CI
```

Biome is configured for formatting only (`linter.enabled: false`); ESLint is
still the linter for `@seam/app`. Biome's `files.includes` excludes
`packages/app/src/db/migrations/**`, native `ios/`/`android/` dirs, and build
output.

Single-package and single-test:

```sh
pnpm --filter @seam/domain test
pnpm --filter @seam/domain test:watch
pnpm --filter @seam/domain test:coverage
pnpm --filter @seam/app typecheck
pnpm --filter @seam/domain vitest run src/scoring/calculateSizeScore.test.ts
pnpm --filter @seam/domain vitest run -t "calculateSizeScore"
```

App-only (must `cd packages/app` for Expo CLI):

```sh
cd packages/app
pnpm ios                  # build & run on iOS simulator (requires Xcode)
pnpm start                # Metro + QR for Expo Go (limited features)
pnpm prebuild             # regenerate native ios/ project
pnpm drizzle:generate     # emit src/db/migrations/*.sql + migrations.js
pnpm drizzle:check        # validate migration history
```

E2E (Maestro, local only — no iOS simulator on CI):

```sh
maestro test .maestro/                       # run all flows
maestro test .maestro/10_create_item.yaml    # single flow
```

CI (`.github/workflows/test.yml`) runs, in order, `pnpm format:check`,
`pnpm -r lint`, `pnpm -r typecheck`, `pnpm -r test`, then a Metro bundle build
(`expo export --platform ios`) on every push / PR to `main`. Maestro is
intentionally skipped — GitHub-hosted Linux runners can't host an iOS
simulator.

`.github/workflows/release.yml` is a separate workflow that triggers on `v*`
tags (or `workflow_dispatch`). On macOS it runs `expo prebuild`, strips the
push entitlement, and produces an **unsigned** IPA via `xcodebuild archive`
(`CODE_SIGNING_ALLOWED=NO`); the IPA is attached to a GitHub Release, and
`.github/scripts/update-source.mjs` rewrites `docs/source.json` (the
AltStore-style source manifest served from GitHub Pages). The tag version
must match `packages/app/app.json`'s `expo.version`, otherwise the workflow
fails fast.

## Database & migrations

- Drizzle schema: `packages/app/src/db/schema.ts` (single source of truth for
  every table). DB client: `packages/app/src/db/client.ts` (`db`, `sqlite`,
  `schema` re-export). Drizzle config: `packages/app/drizzle.config.ts`
  (`dialect: 'sqlite'`, `driver: 'expo'`).
- Migrations live in `packages/app/src/db/migrations/`. **Always run
  `pnpm drizzle:generate` after editing `schema.ts`** — it produces both the
  `.sql` files and the `migrations.js` index that the app imports.
- Migrations are applied at app start via `useDbMigrations()`
  (`packages/app/src/db/migrate.ts`) called in `app/_layout.tsx`. The
  `.sql` files are inlined into the JS bundle by the
  `babel-plugin-inline-import` plugin configured in `babel.config.js` — this
  is why migrations work in production builds without filesystem access. Do
  not remove that plugin.
- Local SQLite files (`*.db`, `*.sqlite`) are gitignored.

## Domain layer rules

- `packages/domain/` must stay free of React Native, Expo, and SQLite
  imports. It is pure TS and is consumed by both the app and unit tests.
- Per `plan/initial-plan.md` and `tsconfig.base.json`: TypeScript strict mode
  is enforced (`noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`,
  `noImplicitReturns`). Do not introduce `any`.
- All scoring / comparison / extraction / pricing logic must be pure
  functions. UI/repository code consumes domain functions; it does not
  re-implement them. New scoring or comparison logic belongs under
  `packages/domain/src/<area>/` with a co-located `*.test.ts`.

## Repository layer

`packages/app/src/repositories/` — one repository per table, all re-exported
from `repositories/index.ts`. Cross-table workflows (creating an item with
measurements + photos + tags + candidate info; converting candidate → owned;
sold/unsold transitions) live in `repositories/itemFlow.ts` and are the
preferred entry points from screens / forms — don't compose multiple
repositories ad hoc in UI code.

## Routing & UI

- Expo Router with file-based routes under `packages/app/app/`:
  - `(tabs)/` — bottom tab screens (Home, Closet, Wishlist, Compare, Stats,
    Settings).
  - `item/[id].tsx`, `item/new.tsx` — owned-item CRUD screens.
  - `candidate/[id].tsx`, `candidate/new.tsx` — candidate CRUD screens.
  - `settings/` — sub-screens (measurement-rules, brand-guides, data-reset).
- Typed routes are enabled (`app.json` → `experiments.typedRoutes`).
- Reusable UI lives in `packages/app/src/components/` and is re-exported from
  `components/index.ts`. Theme tokens (`font`, `space`, `useThemeColors`,
  etc.) come from `packages/app/src/theme/`. Prefer these over hard-coded
  styles.
- Forms use react-hook-form + Zod resolvers; the canonical example is
  `src/forms/ItemForm.tsx`.

## Notifications, photos, backup

- `src/notifications/` wraps `expo-notifications`. Foreground handler is
  configured once at module load from `app/_layout.tsx`
  (`configureNotificationHandler()`). Reminders are persisted in the
  `reminders` table so the configured state can be restored.
- `src/photos/savePhoto.ts` copies picked images into the app's
  document directory and stores only the relative path in SQLite (the
  `photos.relative_path` column). Don't store absolute URIs — they break
  across app reinstalls and iOS container renames.
- `src/backup/` — JSON export/import (Zod-validated, supports `merge` and
  `replace` modes), CSV export of `items`, and full data reset. The
  data-reset path also wipes on-disk photo blobs and the last-export tracker.

## Conventions

- Never use `any`. Prefer Zod-inferred types from `@seam/shared/schemas` for
  anything crossing the persistence or import/export boundary.
- Keep UI and domain logic separate: screens call repositories and domain
  functions, never raw `db` queries from inside a component.
- Japanese is the user-facing language; display labels live as `*_LABEL`
  constants in `packages/shared/src/constants/` (e.g. `CATEGORY_LABEL`,
  `ITEM_STATUS_LABEL`). Code identifiers stay in English.
- When adding a new table: update `schema.ts`, run `pnpm drizzle:generate`,
  add a Zod schema in `packages/shared/src/schemas/`, add a repository in
  `packages/app/src/repositories/`, and extend the JSON export/import in
  `src/backup/` if the data should round-trip.
