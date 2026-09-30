# VeritaPay — Workflow, Review Process & Quality Standards

## 1. Quy tắc Commit

### Format

```
<type>(<scope>): <mô tả ngắn>

[body tùy chọn — giải thích lý do, không giải thích cái gì]

[footer tùy chọn — breaking changes, closes #issue]
```

### Types

| Type | Dùng khi |
|---|---|
| `feat` | Thêm tính năng mới |
| `fix` | Sửa bug |
| `refactor` | Tái cấu trúc code, không thêm tính năng / không sửa bug |
| `style` | Thay đổi CSS, design, không ảnh hưởng logic |
| `docs` | Thêm / sửa tài liệu |
| `test` | Thêm / sửa test |
| `chore` | Cập nhật deps, config, tooling |
| `contract` | Thay đổi Solidity contract |
| `db` | Thay đổi schema, migration, seed |

### Scopes

`frontend`, `backend`, `contract`, `db`, `config`, `docs`, `ci`

### Ví dụ

```
feat(frontend): add dark mode theme toggle with localStorage persistence

fix(contract): prevent vendor attest before period end

docs(docs): add PROJECT_OVERVIEW and TECH_STACK

db(db): migrate tables to VeritaPay schema with IF NOT EXISTS

refactor(backend): extract indexer cursor logic to separate module

style(frontend): convert hard-coded rgba to CSS tokens in sheet components
```

### Quy tắc

- **Không commit trực tiếp vào `main`** — dùng branch + PR (nếu có team)
- **1 commit = 1 concern** — không gộp `feat` + `fix` vào cùng commit
- **Message bằng tiếng Anh** — lowercase, present tense, không chấm cuối dòng đầu
- **Không commit file nhạy cảm:** `.env`, `recovery_file.*`, private keys, `contracts/out/`
- Commit message tối đa 72 ký tự ở subject line

---

## 2. Quy trình Review

### Trước khi tạo PR

```bash
# Bắt buộc:
bun run check           # Lint + typecheck phải PASS (0 errors)

# Nếu có thay đổi contract:
bun run contracts:build # forge build phải PASS
bun run contracts:test  # forge test phải PASS

# Nếu có thay đổi DB schema:
bun run db:migrate      # Migration phải idempotent

# Kiểm tra thủ công:
# - App chạy được (bun run dev)
# - Backend khởi động được (bun run server)
# - Tính năng đã làm hoạt động đúng trong preview
# - Không có console.error mới trong browser
```

### Checklist PR description

```markdown
## Thay đổi
- [ ] Mô tả ngắn gọn những gì thay đổi

## Test đã làm
- [ ] bun run check — PASS
- [ ] Kiểm tra tính năng trong browser
- [ ] Light mode OK
- [ ] Dark mode OK (nếu liên quan UI)
- [ ] Mobile responsive OK (nếu liên quan UI)

## Breaking changes
- [ ] Có / Không. Nếu có: mô tả migration path

## Checklist
- [ ] Không commit .env hoặc secret
- [ ] Không hardcode địa chỉ contract / RPC URL
- [ ] Không thêm `console.log` không cần thiết
- [ ] AGENTS.md cập nhật nếu deploy contract mới
```

### Review criteria

**Từ chối (must fix):**
- `bun run check` fail
- TypeScript `any` không có lý do
- Secret / private key trong code
- Hardcode RPC URL hoặc contract address
- `Date.now()` trong render body (purity violation)
- Bigint render trực tiếp vào JSX
- Hook gọi sau early return

**Cần thảo luận (should fix):**
- Component > 300 dòng — xem xét tách
- Logic business trong component — nên tách vào hook
- CSS hardcode rgba/hex thay vì dùng token
- Không có error handling cho transaction

**Acceptable:**
- Warning (không phải error) từ lint
- Comment giải thích business logic phức tạp
- Inline style khi token không cover được trường hợp đặc biệt

---

## 3. Tiêu chuẩn chất lượng

### Frontend

| Tiêu chí | Yêu cầu |
|---|---|
| TypeScript | 0 errors, `strict: true` |
| Lint | 0 errors (warnings acceptable) |
| Bundle size | Không thêm dependency mới mà không cần thiết |
| Performance | Không gây re-render không cần thiết (memo khi cần) |
| Accessibility | Contrast ≥ 4.5:1, focus visible, aria-label cho icon-only buttons |
| Responsive | Mobile (375px), tablet (768px), desktop (1280px) |
| Theme | Light + Dark đều OK, không flash khi reload |
| Error handling | Mọi transaction có `onError` với toast |

### Smart Contracts

| Tiêu chí | Yêu cầu |
|---|---|
| Compilation | `forge build` — 0 errors |
| Tests | `forge test` — tất cả PASS |
| Audit | Balanced severity audit trước deploy |
| Gas | Tránh unbounded loop trên on-chain array |
| Events | Mọi state transition quan trọng có event |
| Access control | Mọi function mutation có kiểm tra `msg.sender` |

### Backend

| Tiêu chí | Yêu cầu |
|---|---|
| Startup | Server khởi động không throw error |
| Migration | Idempotent — chạy nhiều lần không bị lỗi |
| API | Health endpoint `/api/health` luôn trả 200 |
| Indexer | Không crash khi RPC trả lỗi tạm thời |
| DB | Query dùng Drizzle ORM, search_path = `VeritaPay` |

### Database

| Tiêu chí | Yêu cầu |
|---|---|
| Schema | Tất cả tables trong schema `VeritaPay` |
| Migrations | `CREATE TABLE IF NOT EXISTS` — idempotent |
| Indexes | Foreign keys và lookup columns phải có index |
| Nullability | NOT NULL cho cột bắt buộc, nullable cho optional |

---

## 4. Môi trường

| Môi trường | Mô tả | Chain |
|---|---|---|
| Development | `bun run dev` + `bun run server` | Arc Testnet |
| Testnet | Deployed contract, real test USDC | Arc Testnet |
| Mainnet | Chưa deploy — cần independent audit trước | Arc Mainnet (future) |

> **Quy tắc:** Không deploy lên mainnet từ Arc Studio. Mainnet yêu cầu independent professional audit và review toàn bộ bởi team.

---

## 5. Quản lý dependencies

- **Không thêm dependency mới** nếu đã có package trong sandbox pre-installed
- Trước khi `bun add X`: kiểm tra xem `X` đã có trong pre-installed list chưa
- Dependency mới phải ghi vào PR description với lý do
- Không dùng `npm` hoặc `npx` — chỉ dùng `bun` / `bunx`
- Không cài global package (`bun add -g`) trừ khi user yêu cầu rõ ràng

---

## 6. Bảo mật

- **`.env` không commit** — kiểm tra `.gitignore` trước khi commit
- **`recovery_file.*` không commit** — chứa entity secret Circle
- **Private key không bao giờ xuất hiện trong code** — dù là comment
- **Secret key không dùng `VITE_` prefix** — Vite expose mọi `VITE_*` ra browser bundle
- **Địa chỉ contract là public** — OK để dùng `VITE_VERITAPAY_ADDRESS`
- **Không log giá trị `process.env.*`** trong production code
