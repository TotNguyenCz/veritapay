import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { ShieldCheck, LayoutGrid, User, Building2 } from 'lucide-react'

import { LandingHero } from '@/components/LandingHero'
import { ServiceMarketplace } from '@/components/ServiceMarketplace'
import { SubscriberDashboard } from '@/components/SubscriberDashboard'
import { VendorDashboard } from '@/components/VendorDashboard'
import { ThemeToggle } from '@/components/ThemeToggle'
import { VERITAPAY_ADDRESS } from '@/veritapay-config'

type Tab = 'marketplace' | 'subscriber' | 'vendor'

function AppShell() {
  const [tab, setTab] = useState<Tab>('marketplace')

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'marketplace', label: 'Marketplace', icon: <LayoutGrid className="size-4" /> },
    { id: 'subscriber', label: 'My Subscriptions', icon: <User className="size-4" /> },
    { id: 'vendor', label: 'Vendor', icon: <Building2 className="size-4" /> },
  ]

  return (
    <div className="min-h-dvh" style={{ background: 'var(--bg-gradient)' }}>
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b" style={{ background: 'var(--surface-strong)', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)', borderColor: 'var(--border)' }}>
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="size-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent)' }}>
              <ShieldCheck className="size-3.5" style={{ color: 'var(--accent-fg)' }} />
            </div>
            <span className="display text-base font-bold" style={{ color: 'var(--ink)' }}>VeritaPay</span>
            {VERITAPAY_ADDRESS && (
              <span className="ml-1 rounded-full px-2 py-0.5 text-xs font-semibold"
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
            <ThemeToggle />
            <ConnectKitButton />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
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
