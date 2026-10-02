import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { LayoutGrid, User, Building2, BookOpen } from 'lucide-react'
import { VeritaPayLockup } from '@/components/shared/VeritaPayLogo'

import { LandingHero } from '@/components/LandingHero'
import { ServiceMarketplace } from '@/components/ServiceMarketplace'
import { SubscriberDashboard } from '@/components/SubscriberDashboard'
import { VendorDashboard } from '@/components/VendorDashboard'
import { ThemeToggle } from '@/components/ThemeToggle'
import { AppFooter } from '@/components/AppFooter'
import { DocsPage } from '@/components/DocsPage'
import { VERITAPAY_ADDRESS } from '@/veritapay-config'

type View = 'app' | 'docs'
type Tab = 'marketplace' | 'subscriber' | 'vendor'

function AppShell() {
  const [view, setView] = useState<View>('app')
  const [tab, setTab] = useState<Tab>('marketplace')

  if (view === 'docs') {
    return <DocsPage onBack={() => setView('app')} />
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'marketplace', label: 'Marketplace', icon: <LayoutGrid className="size-4" /> },
    { id: 'subscriber', label: 'My Subscriptions', icon: <User className="size-4" /> },
    { id: 'vendor', label: 'Vendor', icon: <Building2 className="size-4" /> },
  ]

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--bg-gradient)' }}>
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b" style={{ background: 'var(--surface-strong)', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)', borderColor: 'var(--border)' }}>
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <VeritaPayLockup size="sm" />
            {VERITAPAY_ADDRESS && (
              <span className="rounded-full px-2 py-0.5 text-xs font-semibold"
                style={{ background: 'rgba(22,163,74,0.14)', color: 'var(--success)' }}>
                Deployed
              </span>
            )}
          </div>

          {/* Tab bar */}
          <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: 'var(--surface-muted)' }}>
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
                style={tab === t.id
                  ? { background: 'var(--accent)', color: 'var(--accent-fg)' }
                  : { color: 'var(--muted)', background: 'transparent' }
                }
              >
                {t.icon}
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setView('docs')}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
              style={{ color: 'var(--muted)', background: 'var(--surface-muted)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ink)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)' }}
              aria-label="Documentation"
            >
              <BookOpen className="size-3.5" />
              <span className="hidden sm:inline">Docs</span>
            </button>
            <ThemeToggle />
            <ConnectKitButton />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        {tab === 'marketplace' && <ServiceMarketplace />}
        {tab === 'subscriber' && <SubscriberDashboard />}
        {tab === 'vendor' && <VendorDashboard />}
      </main>

      {/* Status bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30">
        {!VERITAPAY_ADDRESS && (
          <div className="rounded-full px-4 py-2 text-xs font-semibold shadow-lg"
            style={{ background: 'rgba(217,119,6,0.12)', color: 'var(--warning)', border: '1px solid rgba(217,119,6,0.25)' }}>
            Contract not yet deployed — deploying to Arc Testnet
          </div>
        )}
      </div>

      <AppFooter onNavigateDocs={() => setView('docs')} />
    </div>
  )
}

export default function App() {
  const { isConnected } = useAccount()
  const [enteredApp, setEnteredApp] = useState(false)

  if (!enteredApp && !isConnected) {
    return <LandingHero onEnterApp={() => setEnteredApp(true)} />
  }

  return <AppShell />
}
