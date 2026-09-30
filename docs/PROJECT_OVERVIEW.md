# VeritaPay — Tổng quan dự án

## 1. Mục tiêu

VeritaPay là một **giao thức thanh toán subscription có xác minh hiệu suất** chạy trên Arc Testnet. Giao thức giải quyết bài toán thanh toán SLA doanh nghiệp: thay vì hóa đơn thủ công, xác nhận qua email và vòng đối soát 30–90 ngày, VeritaPay tự động hóa toàn bộ chu kỳ thanh toán bằng smart contract — **không cần escrow, không cần bên thứ ba tin cậy**.

**Mục tiêu cốt lõi:**
- Vendor đăng ký dịch vụ với cam kết SLA on-chain (uptime mục tiêu, giá mỗi kỳ, cửa sổ thách thức)
- Subscriber đăng ký với ngân sách USDC được ủy quyền trước (không khóa vốn upfront)
- Sau mỗi kỳ thanh toán, vendor nộp performance attestation có chữ ký (uptime %, latency p99, error rate)
- Nếu không bị thách thức trong cửa sổ quy định, contract tự động settle USDC theo tỷ lệ hiệu suất thực / mục tiêu
- Điểm uy tín Bayesian của vendor được công bố công khai on-chain

---

## 2. Tính năng cần xây dựng

| # | Tính năng | Trạng thái |
|---|---|---|
| F-01 | Marketplace dịch vụ | Done |
| F-02 | Đăng ký dịch vụ (vendor) | Done |
| F-03 | Subscribe dịch vụ (USDC approve + subscribe) | Done |
| F-04 | Quản lý subscription (subscriber dashboard) | Done |
| F-05 | Nộp attestation (vendor) | Done |
| F-06 | Raise / resolve dispute | Done |
| F-07 | Điểm uy tín vendor on-chain | Done |
| F-08 | Lịch sử period từ DB (full history) | Done |
| F-09 | Protocol stats bar | Done |
| F-10 | Light / Dark theme | In progress |
| F-11 | Tài liệu dự án | In progress |

---

## 3. Mô tả chi tiết từng tính năng

### F-01 Marketplace dịch vụ

Hiển thị danh sách tất cả dịch vụ đã đăng ký trên VeritaPay, được load từ DB (thay vì gọi RPC từng card). Mỗi card hiển thị:
- Tên dịch vụ, địa chỉ vendor (rút gọn)
- Giá mỗi kỳ (USDC), độ dài kỳ, target uptime SLA
- Badge uy tín on-chain (Bayesian score, số kỳ honored/total)
- Tổng subscribers và USDC đã settle từ DB
- Nút "Subscribe" mở SubscribeSheet

**Nguồn dữ liệu:** `/api/services` (DB) + `getVendorReputation` (on-chain read per card)

### F-02 Đăng ký dịch vụ (vendor)

Bottom sheet cho phép vendor đăng ký dịch vụ mới:
- Tên, metadata URI (optional), giá/kỳ, thời hạn kỳ, cửa sổ thách thức, grace period, target uptime %
- Gọi `registerService()` trên smart contract
- Sau khi confirm, DB indexer tự động sync

**Contract function:** `registerService(name, metadataUri, pricePerPeriod, periodDuration, challengeWindow, gracePeriod, targetUptimeBps)`

### F-03 Subscribe dịch vụ

Luồng 2 bước:
1. **Approve USDC:** Gọi `USDC.approve(VeritaPay, maxUint256)` — chỉ cần làm một lần
2. **Subscribe:** Gọi `subscribe(serviceId, budgetPerPeriod, duration)` — duration = 0 là open-ended

Nếu allowance đã đủ, bỏ qua bước 1. Hiển thị thông báo rõ ràng bước nào đang thực hiện.

**Contract functions:** `ERC20.approve`, `subscribe(uint256, uint256, uint256)`

### F-04 Quản lý subscription (subscriber dashboard)

Hiển thị tất cả subscription active của subscriber. Mỗi subscription card:
- Tên dịch vụ, ngân sách/kỳ, tổng đã trả, số kỳ honored
- Period hiện tại với state machine (Pending / Attested / Settled / Disputed / Resolved / Missed)
- Các action theo state: Raise Dispute, Force Settle, Mark Missed
- Toggle "Full History" load toàn bộ period từ DB (không giới hạn 6 period của contract)

**Nguồn dữ liệu:** `getActiveSubscriptions` + `getSubscription` + `getPeriod` (on-chain) + `/api/subscriptions/:id/periods` (DB)

### F-05 Nộp attestation (vendor)

Vendor dashboard hiển thị:
- Danh sách services của vendor (từ DB)
- Bar thống kê tổng: subscribers, USDC earned
- Điểm uy tín on-chain với màu sắc semantic
- Queue các subscription đang chờ attestation (period đã kết thúc, state = PENDING)
- AttestSheet: nhập uptime %, latency p99 (ms), error rate %, evidence hash (optional)
- Lịch sử attestation từ DB

**Contract function:** `attest(subscriptionId, uptimeBps, latencyP99Ms, errorRateBps, evidenceHash)`

### F-06 Dispute và resolution

- **Raise dispute:** Subscriber gọi `raiseDispute(periodId, reason)` trong cửa sổ thách thức
- **Auto-resolve:** Sau 7 ngày không xử lý → contract auto-refund subscriber
- **Manual settle:** Vendor hoặc subscriber gọi `settlePayment(periodId)` sau cửa sổ thách thức

**Contract functions:** `raiseDispute(uint256, string)`, `settlePayment(uint256)`, `markMissedPeriod(uint256)`

### F-07 Điểm uy tín vendor

Điểm Bayesian được tính on-chain: `score = (honoredPeriods * 10000) / (totalPeriods + LAPLACE_K)` với Laplace smoothing. Màu sắc semantic: ≥80% xanh, ≥50% cam, <50% đỏ. Hiển thị dạng `ReputationBadge` component tái sử dụng.

**Contract function:** `getVendorReputation(address)`

### F-08 Lịch sử period đầy đủ

Tab "Full History" trong subscriber dashboard load từ `/api/subscriptions/:id/periods` — toàn bộ lịch sử không giới hạn (contract `getSubscriptionPeriods` chỉ trả max 6). Mỗi row: period index, thời gian start/end, state, uptime attested, số tiền settle.

### F-09 Protocol stats bar

Bar hiển thị metrics tổng toàn giao thức từ `/api/stats`:
- Tổng services, subscriptions, periods settled, USDC settled (format $xxx.xx), disputes

### F-10 Light / Dark theme

Hệ thống theme đầy đủ với CSS custom properties, toggle button trong header, persist localStorage, anti-flash script, ConnectKit theme sync, và kiểm tra contrast accessibility. Xem `docs/DESIGN_SYSTEM.md` để biết thêm.

### F-11 Tài liệu dự án

Bộ tài liệu trong `docs/` gồm: PROJECT_OVERVIEW, TECH_STACK, DESIGN_SYSTEM, CODING_STANDARDS, WORKFLOW.

---

## 4. Kiến trúc tổng quan

```
Browser
  └─ React (Vite) ─ Port 5173
       ├─ wagmi / viem ──────────────────────── Arc Testnet RPC
       ├─ ConnectKit ─ wallet connect
       └─ /api/* (Vite proxy) ─────────────── Bun Backend ─ Port 3001
                                                    ├─ REST API (Hono)
                                                    ├─ Event Indexer (polls every 6s)
                                                    └─ Drizzle ORM
                                                            └─ PostgreSQL (schema: VeritaPay)

Smart Contract: VeritaPay.sol (Foundry)
  └─ Arc Testnet: 0x00004e3d9f50cf3ea828cfccf65dba8c33444e1f
```

---

## 5. Deployed Contracts

| Contract | Chain | Address |
|---|---|---|
| VeritaPay | Arc Testnet (5042002) | `0x00004e3d9f50cf3ea828cfccf65dba8c33444e1f` |

USDC (Arc Testnet): `0x3600000000000000000000000000000000000000` (6 decimals ERC-20, 18 decimals native gas)
