import { Github, ExternalLink, Zap } from 'lucide-react'
import { VERITAPAY_ADDRESS, TARGET_CHAIN_ID } from '@/veritapay-config'
import { VeritaPayLockup } from '@/components/shared/VeritaPayLogo'

const CONTRACT_URL = VERITAPAY_ADDRESS
  ? `https://explorer.testnet.arc.io/address/${VERITAPAY_ADDRESS}`
  : null

const CHAIN_LABEL = TARGET_CHAIN_ID === 5042002 ? 'Arc Testnet' : `Chain ${String(TARGET_CHAIN_ID)}`

const COLS = [
  {
    heading: 'Protocol',
    links: [
      { label: 'Marketplace',        href: '#marketplace' },
      { label: 'My Subscriptions',   href: '#subscriber' },
      { label: 'Vendor Dashboard',   href: '#vendor' },
      CONTRACT_URL
        ? { label: 'Smart Contract', href: CONTRACT_URL, external: true }
        : null,
    ].filter((x): x is { label: string; href: string; external?: boolean } => x !== null),
  },
  {
    heading: 'Developers',
    links: [
      { label: 'GitHub',              href: 'https://github.com/TotNguyenCz/veritapay', external: true },
      { label: 'Documentation',       href: 'https://github.com/TotNguyenCz/veritapay/tree/main/docs', external: true },
      { label: 'Contract Source',     href: 'https://github.com/TotNguyenCz/veritapay/blob/main/contracts/VeritaPay.sol', external: true },
      { label: 'API Reference',       href: 'https://github.com/TotNguyenCz/veritapay/tree/main/docs/TECH_STACK.md', external: true },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { label: 'Arc Testnet Explorer', href: 'https://explorer.testnet.arc.io', external: true },
      { label: 'Get Test USDC',         href: 'https://faucet.circle.com', external: true },
      { label: 'Arc Documentation',     href: 'https://docs.arc.io', external: true },
      { label: 'Circle USDC',           href: 'https://www.circle.com/usdc', external: true },
    ],
  },
]

export function AppFooter() {
  return (
    <footer
      className="mt-20 border-t"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-strong)' }}
    >
      {/* Main grid */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">

          {/* Brand column */}
          <div className="flex flex-col gap-4">
            <VeritaPayLockup size="md" />

            <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
              Performance-attested subscription billing on Arc. Vendors commit
              to SLA targets on-chain. Clients pay only for what was delivered.
            </p>

            {/* Chain badge */}
            <div
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold w-fit"
              style={{ background: 'var(--surface-muted)', color: 'var(--muted)' }}
            >
              <Zap className="size-3" style={{ color: 'var(--accent)' }} />
              <span>Built on {CHAIN_LABEL}</span>
            </div>

            {/* Contract address */}
            {VERITAPAY_ADDRESS && (
              <a
                href={CONTRACT_URL ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-mono transition-opacity hover:opacity-70 w-fit"
                style={{ color: 'var(--subtle)' }}
              >
                <span>
                  {VERITAPAY_ADDRESS.slice(0, 6)}…{VERITAPAY_ADDRESS.slice(-4)}
                </span>
                <ExternalLink className="size-3 shrink-0" />
              </a>
            )}
          </div>

          {/* Link columns */}
          {COLS.map((col) => (
            <div key={col.heading} className="flex flex-col gap-3">
              <div
                className="text-xs font-bold uppercase tracking-widest mb-1"
                style={{ color: 'var(--subtle)' }}
              >
                {col.heading}
              </div>
              {col.links.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target={link.external ? '_blank' : undefined}
                  rel={link.external ? 'noopener noreferrer' : undefined}
                  className="inline-flex items-center gap-1.5 text-sm transition-colors hover:underline"
                  style={{ color: 'var(--muted)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
                >
                  {link.label}
                  {link.external && <ExternalLink className="size-3 opacity-50 shrink-0" />}
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className="border-t"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="max-w-6xl mx-auto px-6 h-12 flex items-center justify-between gap-4">
          <span className="text-xs" style={{ color: 'var(--subtle)' }}>
            © {new Date().getFullYear()} VeritaPay. Open source under MIT.
          </span>

          <div className="flex items-center gap-4">
            <a
              href="https://github.com/TotNguyenCz/veritapay"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-opacity hover:opacity-70"
              aria-label="GitHub repository"
            >
              <Github className="size-4" style={{ color: 'var(--subtle)' }} />
            </a>
            <a
              href="https://arc.io"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs transition-opacity hover:opacity-70"
              style={{ color: 'var(--subtle)' }}
            >
              Powered by Arc
              <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
