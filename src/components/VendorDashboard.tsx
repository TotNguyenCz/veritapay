/**
 * VendorDashboard — shows vendor services (on-chain), pending attestations queue
 * (contract reads), and full attestation history from the Postgres DB.
 */

import { useState } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { ShieldCheck, Database, ChevronDown, ChevronUp, ClipboardCheck, Clock } from 'lucide-react'
import { VERITAPAY_ADDRESS, VERITAPAY_ABI, TARGET_CHAIN_ID, USDC_FACT, formatScorePct, scoreColor } from '@/veritapay-config'
import { Amount } from '@/onchain-money'
import { StatePill } from '@/components/shared/StatePill'
import { AttestSheet } from '@/components/AttestSheet'
import { useApi } from '@/hooks/useApi'

function getVendorNowSec(): bigint { return BigInt(Math.floor(Date.now() / 1000)) }

// ── DB attestation shape ──────────────────────────────────────────────────────
interface DbAttestation {
  id: number
  txHash: string
  blockNumber: string
  subscriptionId: string
  periodIndex: number
  vendor: string
  uptimeBps: number
  latencyMs: number
  errorRateBps: number
  evidenceHash: string
  createdAt: string
}

function AttestationHistoryPanel({ vendor }: { vendor: string }) {
  const { data, loading } = useApi<DbAttestation[]>(
    `/vendor/${vendor}/attestations`,
    { refreshInterval: 20_000 },
  )

  if (loading && !data) return (
    <div className="animate-pulse space-y-2 mt-3">
      {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 rounded-xl bg-black/5" />)}
    </div>
  )

  if (!data || data.length === 0) return (
    <div className="text-xs text-center py-4" style={{ color: 'var(--muted)' }}>
      No attestations submitted yet — they'll appear here after your first attestation is indexed.
    </div>
  )

  return (
    <div className="glass-inner rounded-xl overflow-hidden mt-3">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b"
        style={{ borderColor: 'var(--border)', background: 'rgba(18,45,69,0.04)' }}>
        <Database className="size-3.5" style={{ color: 'var(--muted)' }} />
        <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
          Attestation history · {data.length} record{data.length !== 1 ? 's' : ''}
        </span>
      </div>
      {data.map((a) => (
        <div key={a.id}
          className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 border-b last:border-b-0"
          style={{ borderColor: 'var(--border)' }}>
          <div className="text-xs tabular-nums font-semibold" style={{ color: 'var(--ink)' }}>
            Sub #{a.subscriptionId} · P{a.periodIndex}
          </div>
          <div className="flex flex-wrap gap-3 text-xs" style={{ color: 'var(--muted)' }}>
            <span>{(a.uptimeBps / 100).toFixed(2)}% uptime</span>
            <span>{a.latencyMs}ms p99</span>
            <span>{(a.errorRateBps / 100).toFixed(2)}% err</span>
          </div>
          <a
            href={`https://explorer.testnet.arc.io/tx/${a.txHash}`}
            target="_blank" rel="noreferrer"
            className="mono text-xs hover:underline"
            style={{ color: 'var(--subtle)' }}
          >
            {a.txHash.slice(0, 8)}…
          </a>
        </div>
      ))}
    </div>
  )
}

// ── DB service shape ──────────────────────────────────────────────────────────
interface DbService {
  id: number
  serviceId: string
  vendor: string
  name: string
  pricePerPeriod: string
  periodDuration: number
  targetUptimeBps: number
  active: boolean
  totalSubscribers: number
  totalPeriodsSettled: number
  totalUsdcSettled: string
}

interface DbSubscription {
  id: number
  subscriptionId: string
  serviceId: string
  subscriber: string
  active: boolean
}

// ── Single service card with pending period queue ─────────────────────────────
function ServiceVendorCard({ serviceId }: { serviceId: bigint }) {
  const { data: service } = useReadContract({
    address: VERITAPAY_ADDRESS, abi: VERITAPAY_ABI, functionName: 'getServiceListing',
    args: [serviceId], chainId: TARGET_CHAIN_ID, query: { enabled: !!VERITAPAY_ADDRESS },
  })

  // All subscriptions for this service from DB
  const { data: dbSubs } = useApi<DbSubscription[]>(
    `/services/${serviceId.toString()}/subscriptions`,
    { refreshInterval: 15_000 },
  )
  const activeSubs = dbSubs?.filter((s) => s.active) ?? []

  const [showAttest, setShowAttest] = useState<bigint | null>(null)
  const [expanded, setExpanded] = useState(false)

  if (!service) return null

  const hasActiveSubs = activeSubs.length > 0
  const subsLabel = `${activeSubs.length} sub${activeSubs.length !== 1 ? 's' : ''}`

  const subsList = (expanded && hasActiveSubs) ? (
    <div className="space-y-2 mt-3">
      <div className="text-xs font-semibold mb-2" style={{ color: 'var(--muted)' }}>
        <ClipboardCheck className="size-3 inline mr-1" />
        Subscriptions — click Attest to submit performance data
      </div>
      {activeSubs.map((s) => (
        <PendingSubRow
          key={s.subscriptionId}
          subscriptionId={BigInt(s.subscriptionId)}
          serviceId={serviceId}
          onAttest={(pId) => setShowAttest(pId)}
        />
      ))}
    </div>
  ) : null

  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{service.name}</div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            {Amount.fromRaw(service.pricePerPeriod, USDC_FACT.decimals).toFixed(2)} USDC / period
            · {(service.targetUptimeBps / 100).toFixed(2)}% SLA
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${service.active ? 'badge-settled' : 'badge-missed'}`}>
            {service.active ? 'Active' : 'Inactive'}
          </div>
          {hasActiveSubs ? (
            <button
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold"
              style={{ background: 'rgba(18,45,69,0.08)', color: 'var(--accent)' }}
            >
              {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
              {subsLabel}
            </button>
          ) : null}
        </div>
      </div>

      {subsList}

      {showAttest != null ? (
        <AttestSheet periodId={showAttest} onClose={() => setShowAttest(null)} />
      ) : null}
    </div>
  )
}

function PendingSubRow({
  subscriptionId,
  serviceId: _serviceId,
  onAttest,
}: {
  subscriptionId: bigint
  serviceId: bigint
  onAttest: (periodId: bigint) => void
}) {
  const { data: sub } = useReadContract({
    address: VERITAPAY_ADDRESS, abi: VERITAPAY_ABI, functionName: 'getSubscription',
    args: [subscriptionId], chainId: TARGET_CHAIN_ID, query: { enabled: !!VERITAPAY_ADDRESS },
  })

  const { data: periodIds } = useReadContract({
    address: VERITAPAY_ADDRESS, abi: VERITAPAY_ABI, functionName: 'getSubscriptionPeriods',
    args: [subscriptionId], chainId: TARGET_CHAIN_ID, query: { enabled: !!VERITAPAY_ADDRESS, refetchInterval: 12000 },
  })

  if (!sub) return null

  const lastPeriodId = periodIds && periodIds.length > 0 ? periodIds[periodIds.length - 1] : null

  return (
    <PendingPeriodCard
      subscriptionId={subscriptionId}
      periodId={lastPeriodId}
      subscriber={sub.subscriber}
      onAttest={onAttest}
    />
  )
}

function PendingPeriodCard({
  subscriptionId,
  periodId,
  subscriber,
  onAttest,
}: {
  subscriptionId: bigint
  periodId: bigint | null
  subscriber: `0x${string}`
  onAttest: (pid: bigint) => void
}) {
  const { data: period } = useReadContract({
    address: VERITAPAY_ADDRESS, abi: VERITAPAY_ABI, functionName: 'getPeriod',
    args: [periodId ?? 0n], chainId: TARGET_CHAIN_ID,
    query: { enabled: !!periodId, refetchInterval: 10000 },
  })

  const nowSec = getVendorNowSec()
  const periodEnded = !!period && nowSec > period.periodEnd
  const canAttest = !!period && period.state === 0 && periodEnded

  const subStr = subscriber.slice(0, 8) + '…' + subscriber.slice(-6)
  const periodEnd = period ? new Date(Number(period.periodEnd) * 1000).toLocaleString('en', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }) : null

  return (
    <div className="glass-inner px-3 py-2.5 flex items-center justify-between gap-2">
      <div>
        <span className="mono text-xs" style={{ color: 'var(--ink)' }}>Sub #{subscriptionId.toString()}</span>
        <span className="ml-2 text-xs" style={{ color: 'var(--muted)' }}>{subStr}</span>
        {period && (
          <div className="flex items-center gap-2 mt-0.5">
            <StatePill state={period.state} />
            {periodEnd && (
              <span className="text-xs" style={{ color: 'var(--subtle)' }}>
                <Clock className="size-3 inline mr-0.5" />ended {periodEnd}
              </span>
            )}
          </div>
        )}
      </div>
      {canAttest && periodId != null ? (
        <button
          onClick={() => onAttest(periodId)}
          className="rounded-xl px-3 py-1.5 text-xs font-semibold text-white shrink-0"
          style={{ background: 'var(--accent)' }}
        >
          Attest
        </button>
      ) : null}
    </div>
  )
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export function VendorDashboard() {
  const { address } = useAccount()
  const [showHistory, setShowHistory] = useState(false)

  const { data: serviceIds } = useReadContract({
    address: VERITAPAY_ADDRESS, abi: VERITAPAY_ABI, functionName: 'getVendorServices',
    args: [address!], chainId: TARGET_CHAIN_ID,
    query: { enabled: !!address && !!VERITAPAY_ADDRESS, refetchInterval: 15000 },
  })

  const { data: reputation } = useReadContract({
    address: VERITAPAY_ADDRESS, abi: VERITAPAY_ABI, functionName: 'getVendorReputation',
    args: [address!], chainId: TARGET_CHAIN_ID,
    query: { enabled: !!address && !!VERITAPAY_ADDRESS, refetchInterval: 10000 },
  })

  // DB services for aggregate data
  const { data: dbServices } = useApi<DbService[]>(
    address ? `/vendor/${address.toLowerCase()}/services` : null,
    { refreshInterval: 20_000 },
  )

  if (!address) return (
    <div className="glass-card p-8 text-center">
      <div className="text-sm" style={{ color: 'var(--muted)' }}>Connect your wallet to access vendor tools.</div>
    </div>
  )

  const [score, honored, total] = reputation ?? [6666n, 0n, 0n, 0n]

  // Aggregate from DB
  const totalSettled = dbServices
    ? dbServices.reduce((sum, s) => sum + BigInt(s.totalUsdcSettled || '0'), 0n)
    : null
  const totalSubs = dbServices
    ? dbServices.reduce((sum, s) => sum + s.totalSubscribers, 0)
    : null

  return (
    <div>
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="flex-1">
          <h2 className="display text-2xl font-bold" style={{ color: 'var(--ink)' }}>Vendor Dashboard</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
            Submit attestations, track your SLA record
          </p>
        </div>

        {/* Reputation card */}
        <div className="glass-card px-5 py-4 text-center min-w-[140px]">
          <div className="display text-3xl font-bold tabular-nums mb-0.5"
            style={{ color: scoreColor(score) }}>
            {formatScorePct(score)}
          </div>
          <div className="text-xs mb-0.5" style={{ color: 'var(--muted)' }}>Reputation score</div>
          <div className="text-xs tabular-nums" style={{ color: 'var(--subtle)' }}>
            {honored.toString()}/{total.toString()} honored
          </div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>Bayesian · on-chain</div>
        </div>
      </div>

      {/* DB aggregate bar */}
      {(totalSettled !== null || totalSubs !== null) && (
        <div className="flex gap-3 mb-5 flex-wrap">
          {totalSubs !== null && (
            <div className="glass-inner flex items-center gap-2 px-3 py-1.5 rounded-full">
              <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Total subscribers</span>
              <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{totalSubs}</span>
            </div>
          )}
          {totalSettled !== null && (
            <div className="glass-inner flex items-center gap-2 px-3 py-1.5 rounded-full">
              <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>USDC earned</span>
              <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--success)' }}>
                {Amount.fromRaw(totalSettled, USDC_FACT.decimals).toFixed(2)} USDC
              </span>
            </div>
          )}
        </div>
      )}

      {(!serviceIds || serviceIds.length === 0) ? (
        <div className="glass-card p-10 text-center">
          <ShieldCheck className="size-8 mx-auto mb-3" style={{ color: 'var(--subtle)' }} />
          <div className="text-sm font-semibold mb-1" style={{ color: 'var(--ink)' }}>No services yet</div>
          <div className="text-xs" style={{ color: 'var(--muted)' }}>Go to the marketplace and list your first service.</div>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>Your services</h3>
          {serviceIds.map((id) => (
            <ServiceVendorCard key={id.toString()} serviceId={id} />
          ))}
        </div>
      )}

      {/* Attestation history toggle */}
      <div className="mt-6">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
          style={{ background: 'rgba(18,45,69,0.07)', color: 'var(--muted)' }}
        >
          <Database className="size-4" />
          {showHistory ? 'Hide' : 'Show'} attestation history
          {showHistory ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        </button>

        {showHistory && <AttestationHistoryPanel vendor={address.toLowerCase()} />}
      </div>

      {/* How-to guide */}
      <div className="mt-6 glass-card p-5">
        <div className="text-sm font-semibold mb-3" style={{ color: 'var(--ink)' }}>How to use VeritaPay as a vendor</div>
        <ol className="space-y-2">
          {[
            'Register a service on the Marketplace tab with your SLA terms and USDC price per period.',
            'Clients subscribe — they pre-approve USDC spending but no funds are escrowed.',
            'After each billing period ends, submit an attestation with your measured uptime % and evidence hash.',
            'If undisputed for the challenge window, payment auto-settles proportionally to your performance.',
            'Every period is counted on-chain, building your public reputation score.',
          ].map((step, i) => (
            <li key={i} className="flex gap-3 text-xs" style={{ color: 'var(--muted)' }}>
              <span className="size-5 shrink-0 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: 'rgba(18,45,69,0.1)', color: 'var(--accent)' }}>
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
