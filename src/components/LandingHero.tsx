import { Zap, BarChart3, ArrowRight, ShieldCheck } from 'lucide-react'
import { ConnectKitButton } from 'connectkit'
import { VeritaPayLockup } from '@/components/shared/VeritaPayLogo'

interface Props {
  onEnterApp: () => void
}

export function LandingHero({ onEnterApp }: Props) {
  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--bg-gradient)' }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 max-w-7xl mx-auto w-full">
        <VeritaPayLockup size="md" />
        <ConnectKitButton />
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-20 text-center max-w-3xl mx-auto">
        {/* Hero mark — large version */}
        <div className="mb-6 flex justify-center">
          <VeritaPayLockup size="lg" />
        </div>

        <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold mb-8"
          style={{ background: 'rgba(18,45,69,0.08)', color: 'var(--accent)' }}>
          <Zap className="size-3" />
          Live on Arc Testnet · USDC native gas
        </div>

        <h1 className="display text-5xl font-bold leading-tight mb-5" style={{ color: 'var(--ink)', letterSpacing: '-0.04em' }}>
          Billing that proves<br />what you deliver
        </h1>
        <p className="text-lg leading-relaxed mb-10 max-w-xl" style={{ color: 'var(--muted)' }}>
          Vendors stake their reputation. Clients subscribe with a USDC budget.
          Each period, performance is attested on-chain. Miss your SLA — get paid less.
          No invoices. No disputes waiting 60 days. No intermediaries.
        </p>

        <div className="flex items-center gap-4 flex-wrap justify-center">
          <button
            onClick={onEnterApp}
            className="inline-flex items-center gap-2 rounded-2xl px-7 py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.99]"
            style={{ background: 'var(--accent)' }}
          >
            Open App
            <ArrowRight className="size-4" />
          </button>
          <a
            href="https://explorer.testnet.arc.io"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-2xl px-7 py-3.5 text-sm font-semibold transition-all hover:scale-[1.02]"
            style={{ background: 'rgba(18,45,69,0.07)', color: 'var(--accent)' }}
          >
            View on ArcScan
          </a>
        </div>
      </div>

      {/* Feature row */}
      <div className="max-w-5xl mx-auto w-full px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: <BarChart3 className="size-5" />,
              title: 'Performance-computed billing',
              body: 'Payment = budget × (reported uptime / SLA target). Partial delivery earns partial payment — automatically.',
            },
            {
              icon: <ShieldCheck className="size-5" />,
              title: 'Public reputation scores',
              body: 'Bayesian score from every period on-chain. Any contract or app can read it — trust is programmable.',
            },
            {
              icon: <Zap className="size-5" />,
              title: 'Sub-second finality on Arc',
              body: 'USDC is the gas token. No ETH to hold. Settlements confirm in under 1 second. No waiting for batch processing.',
            },
          ].map((f) => (
            <div key={f.title} className="glass-card p-6">
              <div className="size-9 rounded-xl flex items-center justify-center mb-3"
                style={{ background: 'rgba(18,45,69,0.09)', color: 'var(--accent)' }}>
                {f.icon}
              </div>
              <div className="text-sm font-semibold mb-1.5" style={{ color: 'var(--ink)' }}>{f.title}</div>
              <div className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{f.body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
