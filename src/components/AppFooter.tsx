import { Github, ExternalLink, Zap, BookOpen } from 'lucide-react'
import { VERITAPAY_ADDRESS, TARGET_CHAIN_ID } from '@/veritapay-config'
import { VeritaPayLockup } from '@/components/shared/VeritaPayLogo'

const CONTRACT_URL = VERITAPAY_ADDRESS
  ? `https://explorer.testnet.arc.io/address/${VERITAPAY_ADDRESS}`
  : null

const CHAIN_LABEL = TARGET_CHAIN_ID === 5042002 ? 'Arc Testnet' : `Chain ${String(TARGET_CHAIN_ID)}`

interface Props {
  onNavigateDocs: () => void
}

export function AppFooter({ onNavigateDocs }: Props) {
  const linkStyle = { color: 'var(--muted)' }
  const linkHover = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.color = 'var(--ink)' }
  const linkLeave = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.color = 'var(--muted)' }

  return (
    <footer
      className="mt-20 border-t"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-strong)' }}
    >
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">

          {/* Brand column */}
          <div className="flex flex-col gap-4">
            <VeritaPayLockup size="md" />

            <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
              Performance-attested subscription billing on Arc. Vendors commit
              to SLA targets on-chain. Clients pay only for what was delivered.
            </p>

            <div
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold w-fit"
              style={{ background: 'var(--surface-muted)', color: 'var(--muted)' }}
            >
              <Zap className="size-3" style={{ color: 'var(--accent)' }} />
              <span>Built on {CHAIN_LABEL}</span>
            </div>

            {VERITAPAY_ADDRESS && (
              <a
                href={CONTRACT_URL ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-mono transition-opacity hover:opacity-70 w-fit"
                style={{ color: 'var(--subtle)' }}
              >
                {VERITAPAY_ADDRESS.slice(0, 6)}…{VERITAPAY_ADDRESS.slice(-4)}
                <ExternalLink className="size-3 shrink-0" />
              </a>
            )}
          </div>

          {/* Protocol */}
          <div className="flex flex-col gap-3">
            <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--subtle)' }}>
              Protocol
            </div>
            {[
              { label: 'Marketplace',      href: '#marketplace' },
              { label: 'My Subscriptions', href: '#subscriber' },
              { label: 'Vendor Dashboard', href: '#vendor' },
              CONTRACT_URL ? { label: 'Smart Contract', href: CONTRACT_URL, external: true } : null,
            ]
              .filter((x): x is { label: string; href: string; external?: boolean } => x !== null)
              .map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target={link.external ? '_blank' : undefined}
                  rel={link.external ? 'noopener noreferrer' : undefined}
                  className="inline-flex items-center gap-1.5 text-sm transition-colors"
                  style={linkStyle}
                  onMouseEnter={linkHover}
                  onMouseLeave={linkLeave}
                >
                  {link.label}
                  {link.external && <ExternalLink className="size-3 opacity-50 shrink-0" />}
                </a>
              ))}
          </div>

          {/* Developers */}
          <div className="flex flex-col gap-3">
            <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--subtle)' }}>
              Developers
            </div>

            {/* GitHub — external link */}
            <a
              href="https://github.com/TotNguyenCz/veritapay"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm transition-colors"
              style={linkStyle}
              onMouseEnter={linkHover}
              onMouseLeave={linkLeave}
            >
              GitHub <ExternalLink className="size-3 opacity-50 shrink-0" />
            </a>

            {/* Documentation — in-app navigation */}
            <button
              onClick={onNavigateDocs}
              className="inline-flex items-center gap-1.5 text-sm transition-colors text-left"
              style={linkStyle}
              onMouseEnter={linkHover}
              onMouseLeave={linkLeave}
            >
              <BookOpen className="size-3.5 shrink-0 opacity-60" />
              Documentation
            </button>

            {/* Contract Source — external */}
            <a
              href="https://github.com/TotNguyenCz/veritapay/blob/main/contracts/VeritaPay.sol"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm transition-colors"
              style={linkStyle}
              onMouseEnter={linkHover}
              onMouseLeave={linkLeave}
            >
              Contract Source <ExternalLink className="size-3 opacity-50 shrink-0" />
            </a>

            {/* API Reference — in-app docs, tech-stack page */}
            <button
              onClick={onNavigateDocs}
              className="inline-flex items-center gap-1.5 text-sm transition-colors text-left"
              style={linkStyle}
              onMouseEnter={linkHover}
              onMouseLeave={linkLeave}
            >
              <BookOpen className="size-3.5 shrink-0 opacity-60" />
              API Reference
            </button>
          </div>

          {/* Resources */}
          <div className="flex flex-col gap-3">
            <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--subtle)' }}>
              Resources
            </div>
            {[
              { label: 'Arc Testnet Explorer', href: 'https://explorer.testnet.arc.io' },
              { label: 'Get Test USDC',         href: 'https://faucet.circle.com' },
              { label: 'Arc Documentation',     href: 'https://docs.arc.io' },
              { label: 'Circle USDC',           href: 'https://www.circle.com/usdc' },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm transition-colors"
                style={linkStyle}
                onMouseEnter={linkHover}
                onMouseLeave={linkLeave}
              >
                {link.label} <ExternalLink className="size-3 opacity-50 shrink-0" />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t" style={{ borderColor: 'var(--border)' }}>
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
              Powered by Arc <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
