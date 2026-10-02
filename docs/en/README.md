# VeritaPay — Project Documentation

Complete documentation for the VeritaPay project. Read in the order below when onboarding.

| File | Contents |
|---|---|
| [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) | Goals, features, detailed feature descriptions, architecture overview |
| [TECH_STACK.md](./TECH_STACK.md) | Tech stack, dependencies, directory structure, scripts |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | Design tokens, component library, typography, UI/UX guidelines |
| [CODING_STANDARDS.md](./CODING_STANDARDS.md) | Coding style, naming conventions, rules, patterns |
| [WORKFLOW.md](./WORKFLOW.md) | Commit rules, review process, quality standards |

## Quick Start

```bash
# 1. Start database (if container stopped after sandbox resume)
docker start veritapay-pg   # or: docker compose up -d

# 2. Start backend
bun run server

# 3. Start frontend (separate terminal)
bun run dev
```

## Important Links

- Contract: [0x00004e3d9f50cf3ea828cfccf65dba8c33444e1f](https://explorer.testnet.arc.io/address/0x00004e3d9f50cf3ea828cfccf65dba8c33444e1f)
- Chain: Arc Testnet (Chain ID: 5042002)
- USDC: `0x3600000000000000000000000000000000000000`
