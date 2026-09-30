/**
 * ServiceMarketplace — service listing backed by the Postgres DB (via /api/services).
 * DB data provides aggregates (total subscribers, total USDC settled) not available on-chain.
 * Contract reads are used only for live subscription / attest actions.
 */

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ExternalLink, Clock, Zap, Plus, ShieldCheck, Users, TrendingUp } from 'lucide-react'
import { TARGET_CHAIN_ID, USDC_FACT } from '@/veritapay-config'
import { Amount } from '@/onchain-money'
import { buildAddressExplorerUrl } from '@/onchain-facts'
import { ReputationBadge } from '@/components/shared/ReputationBadge'
import { SubscribeSheet } from '@/components/SubscribeSheet'
import { RegisterServiceSheet } from '@/components/RegisterServiceSheet'
import { ProtocolStats } from '@/components/ProtocolStats'
import { useApi } from '@/hooks/useApi'

/** Shape returned by GET /api/services (mirrors DB row) */
interface DbService {
  id: number
  serviceId: string        // bigint serialised as string
  vendor: string
  name: string
  metadataUri: string
  pricePerPeriod: string   // bigint as string
  periodDuration: number
  challengeWindow: number
  gracePeriod: number
  targetUptimeBps: number
  active: boolean
  createdAtBlock: string
  createdAtTs: string
  totalSubscribers: number
  totalPeriodsSettled: number
  totalUsdcSettled: string
  syncedAt: string
}

function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  if (days >= 28) return `${Math.round(days / 30)} month${Math.round(days / 30) === 1 ? '' : 's'}`
  if (days >= 7) return `${Math.round(days / 7)} week${Math.round(days / 7) === 1 ? '' : 's'}`
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'}`
  const hours = Math.floor(seconds / 3600)
  return `${hours}h`
}

function ServiceCard({
  svc,
  onSubscribe,
}: {
  svc: DbService
  onSubscribe: (svc: DbService) => void
}) {
  const priceFormatted = Amount.fromRaw(BigInt(svc.pricePerPeriod), USDC_FACT.decimals).toFixed(2)
  const slaTarget = (svc.targetUptimeBps / 100).toFixed(2)
  const settledFormatted = Amount.fromRaw(BigInt(svc.totalUsdcSettled || '0'), USDC_FACT.decimals).toFixed(0)

  return (
    <div className="glass-card p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-sm mb-1 truncate" style={{ color: 'var(--ink)' }}>
            {svc.name}
          </div>
          <div className="flex items-center gap-1.5">
            <a
              href={buildAddressExplorerUrl(TARGET_CHAIN_ID, svc.vendor)}
              target="_blank" rel="noreferrer"
              className="mono text-xs hover:underline truncate max-w-[140px]"
              style={{ color: 'var(--muted)' }}
            >
              {svc.vendor.slice(0, 8)}…{svc.vendor.slice(-6)}
            </a>
            <ExternalLink className="size-3 shrink-0" style={{ color: 'var(--subtle)' }} />
          </div>
        </div>
        <ReputationBadge vendor={svc.vendor as `0x${string}`} size="sm" />
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-inner p-3">
          <div className="text-xs mb-0.5" style={{ color: 'var(--muted)' }}>Price / period</div>
          <div className="display text-lg font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
            {priceFormatted} <span className="text-sm font-medium" style={{ color: 'var(--subtle)' }}>USDC</span>
          </div>
        </div>
        <div className="glass-inner p-3">
          <div className="text-xs mb-0.5" style={{ color: 'var(--muted)' }}>SLA target</div>
          <div className="display text-lg font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
            {slaTarget}<span className="text-sm font-medium" style={{ color: 'var(--subtle)' }}>%</span>
          </div>
        </div>
      </div>

      {/* Secondary info row */}
      <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: 'var(--muted)' }}>
        <span className="flex items-center gap-1">
          <Clock className="size-3" />
          {formatDuration(svc.periodDuration)} period
        </span>
        <span className="flex items-center gap-1">
          <Zap className="size-3" />
          {formatDuration(svc.challengeWindow)} window
        </span>
        <span className="flex items-center gap-1">
          <Users className="size-3" />
          {svc.totalSubscribers} sub{svc.totalSubscribers !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1">
          <TrendingUp className="size-3" />
          {settledFormatted} USDC settled
        </span>
      </div>

      <button
        onClick={() => onSubscribe(svc)}
        className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99]"
        style={{ background: 'var(--accent)' }}
      >
        Subscribe
      </button>
    </div>
  )
}

/** Convert a DbService back to the shape SubscribeSheet expects (wagmi contract struct) */
function dbToContractService(svc: DbService) {
  return {
    vendor: svc.vendor as `0x${string}`,
    name: svc.name,
    metadataUri: svc.metadataUri,
    pricePerPeriod: BigInt(svc.pricePerPeriod),
    periodDuration: svc.periodDuration,
    challengeWindow: svc.challengeWindow,
    gracePeriod: svc.gracePeriod,
    targetUptimeBps: svc.targetUptimeBps,
    active: svc.active,
    createdAt: BigInt(svc.createdAtBlock),
  }
}

export function ServiceMarketplace() {
  const { address, chainId } = useAccount()
  const [subscribeTarget, setSubscribeTarget] = useState<{ id: bigint; service: ReturnType<typeof dbToContractService> } | null>(null)
  const [showRegister, setShowRegister] = useState(false)

  const { data: services, loading, refetch } = useApi<DbService[]>('/services', { refreshInterval: 12_000 })

  const isWrongChain = !!chainId && chainId !== TARGET_CHAIN_ID
  const activeServices = services?.filter((s) => s.active) ?? []

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="display text-2xl font-bold" style={{ color: 'var(--ink)' }}>Service Marketplace</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
            Subscribe to vendor services backed by on-chain SLA commitments
          </p>
        </div>
        {address && (
          <button
            onClick={() => setShowRegister(true)}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
            style={{ background: 'rgba(18,45,69,0.08)', color: 'var(--accent)' }}
          >
            <Plus className="size-4" />
            List a service
          </button>
        )}
      </div>

      {/* Protocol stats bar */}
      <ProtocolStats />

      {isWrongChain ? (
        <div className="glass-card p-8 text-center">
          <div className="text-sm font-semibold mb-1" style={{ color: 'var(--ink)' }}>Switch to Arc Testnet</div>
          <div className="text-xs" style={{ color: 'var(--muted)' }}>VeritaPay runs on Arc Testnet (chain ID 5042002).</div>
        </div>
      ) : loading && !services ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card p-5 animate-pulse">
              <div className="h-4 bg-black/5 rounded w-2/3 mb-3" />
              <div className="h-3 bg-black/5 rounded w-1/3 mb-4" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-14 bg-black/5 rounded-xl" />
                <div className="h-14 bg-black/5 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : activeServices.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <ShieldCheck className="size-8 mx-auto mb-3" style={{ color: 'var(--subtle)' }} />
          <div className="text-sm font-semibold mb-1" style={{ color: 'var(--ink)' }}>No services listed yet</div>
          <div className="text-xs mb-4" style={{ color: 'var(--muted)' }}>Be the first vendor to list a service.</div>
          {address && (
            <button
              onClick={() => setShowRegister(true)}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
              style={{ background: 'var(--accent)' }}
            >
              <Plus className="size-4" /> List a service
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeServices.map((svc) => (
            <ServiceCard
              key={svc.serviceId}
              svc={svc}
              onSubscribe={(s) => setSubscribeTarget({ id: BigInt(s.serviceId), service: dbToContractService(s) })}
            />
          ))}
        </div>
      )}

      {subscribeTarget && address && (
        <SubscribeSheet
          serviceId={subscribeTarget.id}
          service={subscribeTarget.service}
          onClose={() => { setSubscribeTarget(null); void refetch() }}
        />
      )}

      {showRegister && address && (
        <RegisterServiceSheet
          onClose={() => { setShowRegister(false); void refetch() }}
        />
      )}
    </div>
  )
}
