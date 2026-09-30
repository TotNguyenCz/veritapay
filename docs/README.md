# VeritaPay — Tài liệu dự án x

Bộ tài liệu đầy đủ cho dự án VeritaPay. Đọc theo thứ tự dưới đây khi onboarding.

| File | Nội dung |
|---|---|
| [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) | Mục tiêu, tính năng, mô tả chi tiết từng tính năng, kiến trúc tổng quan |
| [TECH_STACK.md](./TECH_STACK.md) | Tech stack, dependencies, cấu trúc thư mục, scripts |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | Design tokens, component library, typography, UI/UX guidelines |
| [CODING_STANDARDS.md](./CODING_STANDARDS.md) | Coding style, naming conventions, coding rules, patterns |
| [WORKFLOW.md](./WORKFLOW.md) | Quy tắc commit, quy trình review, tiêu chuẩn chất lượng |

## Quick start

```bash
# 1. Start database (nếu container đã stop sau khi sandbox resume)
docker start veritapay-pg   # hoặc docker compose up -d

# 2. Start backend
bun run server

# 3. Start frontend (terminal khác)
bun run dev
```

## Links quan trọng

- Contract: [0x00004e3d9f50cf3ea828cfccf65dba8c33444e1f](https://explorer.testnet.arc.io/address/0x00004e3d9f50cf3ea828cfccf65dba8c33444e1f)
- Chain: Arc Testnet (Chain ID: 5042002)
- USDC: `0x3600000000000000000000000000000000000000`
