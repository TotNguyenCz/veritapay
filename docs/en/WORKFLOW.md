# VeritaPay — Workflow, Review Process & Quality Standards

## 1. Commit Rules

### Format

```
<type>(<scope>): <short description>

[optional body — explains WHY, not what]

[optional footer — breaking changes, closes #issue]
```

### Types

| Type | When to use |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code restructuring, no feature addition or bug fix |
| `style` | CSS, design changes with no logic impact |
| `docs` | Add or update documentation |
| `test` | Add or update tests |
| `chore` | Update deps, config, tooling |
| `contract` | Solidity contract changes |
| `db` | Schema, migration, or seed changes |

### Scopes

`frontend`, `backend`, `contract`, `db`, `config`, `docs`, `ci`

### Examples

```
feat(frontend): add dark mode theme toggle with localStorage persistence

fix(contract): prevent vendor attest before period end

docs(docs): add PROJECT_OVERVIEW and TECH_STACK

db(db): migrate tables to VeritaPay schema with IF NOT EXISTS

refactor(backend): extract indexer cursor logic to separate module

style(frontend): convert hard-coded rgba to CSS tokens in sheet components
```

### Rules

- **Do not commit directly to `main`** — use a branch + PR (when working in a team)
- **1 commit = 1 concern** — do not combine `feat` + `fix` in the same commit
- **Messages in English** — lowercase, present tense, no period at the end of the subject line
- **Do not commit sensitive files:** `.env`, `recovery_file.*`, private keys, `contracts/out/`
- Subject line max 72 characters

---

## 2. Review Process

### Before Creating a PR

```bash
# Required:
bun run check           # Lint + typecheck must PASS (0 errors)

# If contract changes:
bun run contracts:build # forge build must PASS
bun run contracts:test  # forge test must PASS

# If DB schema changes:
bun run db:migrate      # Migration must be idempotent

# Manual checks:
# - App runs (bun run dev)
# - Backend starts (bun run server)
# - The implemented feature works correctly in the preview
# - No new console.error in the browser
```

### PR Description Checklist

```markdown
## Changes
- [ ] Brief description of what changed

## Testing Done
- [ ] bun run check — PASS
- [ ] Feature verified in the browser
- [ ] Light mode OK
- [ ] Dark mode OK (if UI-related)
- [ ] Mobile responsive OK (if UI-related)

## Breaking Changes
- [ ] Yes / No. If yes: describe the migration path

## Checklist
- [ ] No .env or secret committed
- [ ] No hardcoded contract addresses / RPC URLs
- [ ] No unnecessary console.log added
- [ ] AGENTS.md updated if a new contract was deployed
```

### Review Criteria

**Reject (must fix):**
- `bun run check` fails
- TypeScript `any` without justification
- Secret / private key in code
- Hardcoded RPC URL or contract address
- `Date.now()` in the render body (purity violation)
- Bigint rendered directly into JSX
- Hook called after an early return

**Needs discussion (should fix):**
- Component > 300 lines — consider splitting
- Business logic inside a component — extract to a hook
- Hardcoded rgba/hex CSS instead of using tokens
- No error handling for transactions

**Acceptable:**
- Lint warnings (not errors)
- Comments explaining complex business logic
- Inline styles when a token doesn't cover the specific case

---

## 3. Quality Standards

### Frontend

| Criteria | Requirement |
|---|---|
| TypeScript | 0 errors, `strict: true` |
| Lint | 0 errors (warnings acceptable) |
| Bundle size | No new dependency without justification |
| Performance | No unnecessary re-renders (memoize when needed) |
| Accessibility | Contrast ≥ 4.5:1, focus visible, aria-label for icon-only buttons |
| Responsive | Mobile (375px), tablet (768px), desktop (1280px) |
| Theme | Light + Dark both work, no flash on reload |
| Error handling | Every transaction has an `onError` with a toast |

### Smart Contracts

| Criteria | Requirement |
|---|---|
| Compilation | `forge build` — 0 errors |
| Tests | `forge test` — all PASS |
| Audit | Balanced severity audit before deploy |
| Gas | Avoid unbounded loops over on-chain arrays |
| Events | Every important state transition has an event |
| Access control | Every mutation function checks `msg.sender` |

### Backend

| Criteria | Requirement |
|---|---|
| Startup | Server starts without throwing errors |
| Migration | Idempotent — running multiple times must not error |
| API | Health endpoint `/api/health` always returns 200 |
| Indexer | Does not crash on temporary RPC errors |
| DB | Queries use Drizzle ORM, search_path = `VeritaPay` |

### Database

| Criteria | Requirement |
|---|---|
| Schema | All tables in the `VeritaPay` schema |
| Migrations | `CREATE TABLE IF NOT EXISTS` — idempotent |
| Indexes | Foreign keys and lookup columns must be indexed |
| Nullability | NOT NULL for required columns, nullable for optional |

---

## 4. Environments

| Environment | Description | Chain |
|---|---|---|
| Development | `bun run dev` + `bun run server` | Arc Testnet |
| Testnet | Deployed contract, real test USDC | Arc Testnet |
| Mainnet | Not yet deployed — requires independent audit | Arc Mainnet (future) |

> **Rule:** Do not deploy to mainnet from Arc Studio. Mainnet requires an independent professional audit and a full team review.

---

## 5. Dependency Management

- **Do not add a new dependency** if the package is already in the sandbox pre-installed list
- Before `bun add X`: check whether `X` is already in the pre-installed list
- New dependencies must be noted in the PR description with a reason
- Do not use `npm` or `npx` — only `bun` / `bunx`
- Do not install global packages (`bun add -g`) unless the user explicitly requests it

---

## 6. Security

- **`.env` must not be committed** — verify `.gitignore` before committing
- **`recovery_file.*` must not be committed** — contains the Circle entity secret
- **Never log or print** `CIRCLE_API_KEY`, `CIRCLE_ENTITY_SECRET`, or the recovery file content
- **Never ask the user to share** an API key or entity secret in chat — they paste directly into `.env`
