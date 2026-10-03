/**
 * ServiceMarketplace — contract-first service listing.
 *
 * Data strategy:
 *   1. Read all service IDs from contract (getAllServiceIds) — always fresh.
 *   2. Fetch each service struct (getServiceListing) via multicall.
 *   3. Enrich with DB aggregates (/api/services) when available.
 *      If the DB is empty / indexer hasn't caught up, the card still renders
 *      from on-chain data with aggregate fields defaulting to 0.
 *
 * This means a newly registered service appears immediately after the tx
 * confirms — no waiting for the indexer.
 */

import { useState, useMemo } from 'react'
import { useAccount, useReadContract, useReadContracts } from 'wagmi'
import { ExternalLink, Clock, Zap, Plus, ShieldCheck, Users, TrendingUp } from 'lucide-react'
import { TARGET_CHAIN_ID, VERITAPAY_ADDRESS, VERITAPAY_ABI, USDC_FACT } from '@/veritapay-config'
import { Amount } from '@/onchain-money'
import { buildAddressExplorerUrl } from '@/onchain-facts'
import { ReputationBadge } from '@/components/shared/ReputationBadge'
import { SubscribeSheet } from '@/components/SubscribeSheet'
import { RegisterServiceSheet } from '@/components/RegisterServiceSheet'
import { ProtocolStats } from '@/components/ProtocolStats'
import { useApi } from '@/hooks/useApi'

// ─── Types ────────────────────────────────────────────────────────────────────

/** On-chain service struct from getServiceListing */
interface ContractService {
  vendor: `0x${string}`
  name: string
  metadataUri: string
  pricePerPeriod: bigint
  periodDuration: number
  challengeWindow: number
  gracePeriod: number
  targetUptimeBps: number
  active: boolean
  createdAt: bigint
}

/** DB row from /api/services — used only for aggregates */
interface DbService {
  serviceId: string
  totalSubscribers: number
  totalPeriodsSettled: number
  totalUsdcSettled: string
}

/** Merged view — on-chain data + DB aggregates */
interface ServiceView {
  id: bigint
  service: ContractService
  totalSubscribers: number
  totalPeriodsSettled: number
  totalUsdcSettled: bigint
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  if (days >= 28) return `${Math.round(days / 30)} month${Math.round(days / 30) === 1 ? '' : 's'}`
  if (days >= 7) return `${Math.round(days / 7)} week${Math.round(days / 7) === 1 ? '' : 's'}`
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'}`
  const hours = Math.floor(seconds / 3600)
  return `${hours}h`
}

// ─── ServiceCard ──────────────────────────────────────────────────────────────

function ServiceCard({ view, onSubscribe }: { view: ServiceView; onSubscribe: (v: ServiceView) => void }) {
  const { service, totalSubscribers, totalUsdcSettled } = view
  const priceFormatted = Amount.fromRaw(service.pricePerPeriod, USDC_FACT.decimals).toFixed(2)
  const slaTarget = (service.targetUptimeBps / 100).toFixed(2)
  const settledFormatted = Amount.fromRaw(totalUsdcSettled, USDC_FACT.decimals).toFixed(0)

  return (
    <div className="glass-card p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-sm mb-1 truncate" style={{ color: 'var(--ink)' }}>
            {service.name}
          </div>
          <div className="flex items-center gap-1.5">
            <a
              href={buildAddressExplorerUrl(TARGET_CHAIN_ID, service.vendor)}
              target="_blank" rel="noreferrer"
              className="mono text-xs hover:underline truncate max-w-[140px]"
              style={{ color: 'var(--muted)' }}
            >
              {service.vendor.slice(0, 8)}…{service.vendor.slice(-6)}
            </a>
            <ExternalLink className="size-3 shrink-0" style={{ color: 'var(--subtle)' }} />
          </div>
        </div>
        <ReputationBadge vendor={service.vendor} size="sm" />
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
          {formatDuration(service.periodDuration)} period
        </span>
        <span className="flex items-center gap-1">
          <Zap className="size-3" />
          {formatDuration(service.challengeWindow)} window
        </span>
        <span className="flex items-center gap-1">
          <Users className="size-3" />
          {totalSubscribers} sub{totalSubscribers !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1">
          <TrendingUp className="size-3" />
          {settledFormatted} USDC settled
        </span>
      </div>

      <button
        onClick={() => onSubscribe(view)}
        className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99]"
        style={{ background: 'var(--accent)' }}
      >
        Subscribe
      </button>
    </div>
  )
}

// ─── ServiceMarketplace ───────────────────────────────────────────────────────

export function ServiceMarketplace() {
  const { address, chainId } = useAccount()
  const [subscribeTarget, setSubscribeTarget] = useState<ServiceView | null>(null)
  const [showRegister, setShowRegister] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // 1. Read all service IDs from contract — always fresh
  const {
    data: serviceIds,
    isLoading: idsLoading,
    refetch: refetchIds,
  } = useReadContract({
    address: VERITAPAY_ADDRESS,
    abi: VERITAPAY_ABI,
    functionName: 'getAllServiceIds',
    chainId: TARGET_CHAIN_ID,
    query: { refetchInterval: 12_000 },
  })

  // 2. Multicall: fetch each service listing in one round-trip
  const serviceContracts = useMemo(
    () =>
      (serviceIds ?? []).map((id) => ({
        address: VERITAPAY_ADDRESS,
        abi: VERITAPAY_ABI,
        functionName: 'getServiceListing' as const,
        args: [id] as const,
        chainId: TARGET_CHAIN_ID,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [serviceIds?.join(','), refreshKey]
  )

  const { data: serviceResults, isLoading: servicesLoading } = useReadContracts({
    contracts: serviceContracts,
    query: { enabled: (serviceIds?.length ?? 0) > 0, refetchInterval: 12_000 },
  })

  // 3. DB aggregates — enrichment only, non-blocking
  const { data: dbServices } = useApi<DbService[]>('/services', { refreshInterval: 30_000 })

  // Build a map from serviceId → DB row for O(1) lookup
  const dbMap = useMemo(() => {
    const m = new Map<string, DbService>()
    dbServices?.forEach((s) => m.set(s.serviceId, s))
    return m
  }, [dbServices])

  // Merge contract data + DB aggregates
  const views = useMemo((): ServiceView[] => {
    if (!serviceIds || !serviceResults) return []
    return serviceIds
      .map((id, i) => {
        const result = serviceResults[i]
        if (result?.status !== 'success' || !result.result) return null
        const service = result.result
        if (!service.active) return null
        const db = dbMap.get(id.toString())
        return {
          id,
          service,
          totalSubscribers: db?.totalSubscribers ?? 0,
          totalPeriodsSettled: db?.totalPeriodsSettled ?? 0,
          totalUsdcSettled: BigInt(db?.totalUsdcSettled ?? '0'),
        }
      })
      .filter((v): v is ServiceView => v !== null)
  }, [serviceIds, serviceResults, dbMap])

  const isLoading = idsLoading || servicesLoading
  const isWrongChain = !!chainId && chainId !== TARGET_CHAIN_ID

  function handleClose() {
    setShowRegister(false)
    setSubscribeTarget(null)
    // force re-read service IDs from chain
    setRefreshKey((k) => k + 1)
    void refetchIds()
  }

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
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card p-5 animate-pulse">
              <div className="h-4 rounded w-2/3 mb-3" style={{ background: 'var(--surface-muted)' }} />
              <div className="h-3 rounded w-1/3 mb-4" style={{ background: 'var(--surface-muted)' }} />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-14 rounded-xl" style={{ background: 'var(--surface-muted)' }} />
                <div className="h-14 rounded-xl" style={{ background: 'var(--surface-muted)' }} />
              </div>
            </div>
          ))}
        </div>
      ) : views.length === 0 ? (
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
          {views.map((view) => (
            <ServiceCard
              key={view.id.toString()}
              view={view}
              onSubscribe={setSubscribeTarget}
            />
          ))}
        </div>
      )}

      {subscribeTarget && address && (
        <SubscribeSheet
          serviceId={subscribeTarget.id}
          service={subscribeTarget.service}
          onClose={handleClose}
        />
      )}

      {showRegister && address && (
        <RegisterServiceSheet onClose={handleClose} />
      )}
    </div>
  )
}
