/**
 * SubscriberDashboard — shows active subscriptions (on-chain) + full period history (DB).
 * Period rows for live state-machine actions (settle, dispute, mark missed) still read
 * the contract; the DB panel shows the complete paginated history.
 */

import { useState, useEffect } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useRefreshAll } from '@/hooks/useRefreshAll'
import { erc20Abi } from 'viem'
import { toast } from 'sonner'
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Database } from 'lucide-react'
import { VERITAPAY_ADDRESS, VERITAPAY_ABI, TARGET_CHAIN_ID, USDC_FACT, formatScorePct, scoreColor } from '@/veritapay-config'
import { Amount } from '@/onchain-money'
import { StatePill } from '@/components/shared/StatePill'
import { TxButton } from '@/components/shared/TxButton'
import { DisputeSheet } from '@/components/DisputeSheet'
import { useApi } from '@/hooks/useApi'

function getNowSec(): bigint { return BigInt(Math.floor(Date.now() / 1000)) }

// ── DB period row shape ───────────────────────────────────────────────────────
interface DbPeriod {
  id: number
  subscriptionId: string
  periodIndex: number
  periodStart: string
  periodEnd: string
  state: number
  attestedUptimeBps: number | null
  attestedLatencyMs: number | null
  attestedErrorRateBps: number | null
  attestedEvidenceHash: string | null
  attestedAt: string | null
  settledAmount: string | null
  settledAt: string | null
  disputedAt: string | null
  resolvedAt: string | null
  syncedAt: string
}

function DbPeriodRow({ p }: { p: DbPeriod }) {
  const start = new Date(Number(p.periodStart) * 1000).toLocaleDateString('en', { month: 'short', day: 'numeric' })
  const end   = new Date(Number(p.periodEnd)   * 1000).toLocaleDateString('en', { month: 'short', day: 'numeric' })
  const settled = p.settledAmount
    ? Amount.fromRaw(BigInt(p.settledAmount), USDC_FACT.decimals).toFixed(2)
    : null

  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-4 py-3 border-b last:border-b-0"
      style={{ borderColor: 'var(--border)' }}>
      <div>
        <span className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>Period #{p.periodIndex}</span>
        <span className="text-xs ml-2" style={{ color: 'var(--muted)' }}>{start} – {end}</span>
      </div>
      <StatePill state={p.state} />
      {p.attestedUptimeBps != null && (
        <div className="text-xs tabular-nums font-medium" style={{ color: 'var(--ink)' }}>
          {(p.attestedUptimeBps / 100).toFixed(2)}% uptime
        </div>
      )}
      {settled ? (
        <div className="text-xs tabular-nums font-semibold" style={{ color: 'var(--success)' }}>
          +{settled} USDC
        </div>
      ) : <div />}
    </div>
  )
}

// ── Live contract period row (settle / dispute actions) ───────────────────────
function LivePeriodRow({ periodId, serviceId }: { periodId: bigint; serviceId: bigint }) {
  const refreshAll = useRefreshAll()
  const { data: period } = useReadContract({
    address: VERITAPAY_ADDRESS, abi: VERITAPAY_ABI, functionName: 'getPeriod',
    args: [periodId], chainId: TARGET_CHAIN_ID,
    query: { enabled: !!VERITAPAY_ADDRESS, refetchInterval: 8000 },
  })

  const { data: service } = useReadContract({
    address: VERITAPAY_ADDRESS, abi: VERITAPAY_ABI, functionName: 'getServiceListing',
    args: [serviceId], chainId: TARGET_CHAIN_ID, query: { enabled: !!VERITAPAY_ADDRESS },
  })

  const { writeContract: triggerSettle, data: settleHash, isPending: settlePending } = useWriteContract()
  const { isLoading: settleConfirming, isSuccess: settleConfirmed } = useWaitForTransactionReceipt({ hash: settleHash })

  const { writeContract: markMissed, data: missedHash, isPending: missedPending } = useWriteContract()
  const { isLoading: missedConfirming, isSuccess: missedConfirmed } = useWaitForTransactionReceipt({ hash: missedHash })

  useEffect(() => { if (settleConfirmed) refreshAll() }, [settleConfirmed]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (missedConfirmed) refreshAll() }, [missedConfirmed]) // eslint-disable-line react-hooks/exhaustive-deps

  const [showDispute, setShowDispute] = useState(false)

  if (!period || !service) return (
    <div className="glass-inner p-3 animate-pulse">
      <div className="h-3 bg-black/5 rounded w-1/2" />
    </div>
  )

  const nowSec = getNowSec()
  const challengeWindowOver = period.state === 1 && nowSec > period.attestedAt + BigInt(service.challengeWindow)
  const gracePeriodOver = period.state === 0 && nowSec > period.periodEnd + BigInt(service.gracePeriod)
  const canDispute = period.state === 1 && nowSec <= period.attestedAt + BigInt(service.challengeWindow)

  const periodStart = new Date(Number(period.periodStart) * 1000).toLocaleDateString('en', { month: 'short', day: 'numeric' })
  const periodEnd   = new Date(Number(period.periodEnd)   * 1000).toLocaleDateString('en', { month: 'short', day: 'numeric' })

  return (
    <div className="glass-inner p-4">
      <div className="flex items-center justify-between mb-2.5">
        <div className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
          Period #{Number(period.periodIndex)} · {periodStart} – {periodEnd}
        </div>
        <StatePill state={period.state} />
      </div>

      {period.state >= 1 && period.performanceScore > 0n && (
        <div className="flex items-center gap-4 mb-3">
          <div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>Performance</div>
            <div className="display font-bold tabular-nums" style={{ color: scoreColor(period.performanceScore) }}>
              {formatScorePct(period.performanceScore)}
            </div>
          </div>
          <div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>Uptime</div>
            <div className="text-sm font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
              {(Number(period.uptimeBps) / 100).toFixed(2)}%
            </div>
          </div>
          <div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>Settlement</div>
            <div className="text-sm font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
              {Amount.fromRaw(period.paymentAmount, USDC_FACT.decimals).toFixed(2)} USDC
            </div>
          </div>
        </div>
      )}

      {period.state === 3 && period.disputeReason && (
        <div className="text-xs rounded-lg px-2.5 py-2 mb-3"
          style={{ background: 'rgba(220,38,38,0.07)', color: 'var(--danger)' }}>
          Dispute: {period.disputeReason}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {challengeWindowOver && (
          <TxButton
            onClick={() => triggerSettle({ address: VERITAPAY_ADDRESS, abi: VERITAPAY_ABI, functionName: 'triggerAutoSettle', args: [periodId], chainId: TARGET_CHAIN_ID })}
            isPending={settlePending} isConfirming={settleConfirming}
            label="Settle now" variant="primary"
          />
        )}
        {gracePeriodOver && (
          <TxButton
            onClick={() => markMissed({ address: VERITAPAY_ADDRESS, abi: VERITAPAY_ABI, functionName: 'markMissed', args: [periodId], chainId: TARGET_CHAIN_ID })}
            isPending={missedPending} isConfirming={missedConfirming}
            label="Mark missed" variant="ghost"
          />
        )}
        {canDispute && (
          <button
            onClick={() => setShowDispute(true)}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold"
            style={{ background: 'rgba(220,38,38,0.09)', color: 'var(--danger)' }}
          >
            <AlertTriangle className="size-3" /> Dispute
          </button>
        )}
      </div>

      {showDispute && (
        <DisputeSheet periodId={periodId} onClose={() => setShowDispute(false)} />
      )}
    </div>
  )
}

// ── DB history panel ──────────────────────────────────────────────────────────
function PeriodHistoryPanel({ subscriptionId }: { subscriptionId: bigint }) {
  const { data, loading } = useApi<DbPeriod[]>(
    `/subscriptions/${subscriptionId.toString()}/periods`,
    { refreshInterval: 15_000 },
  )

  if (loading && !data) return (
    <div className="animate-pulse space-y-2 mt-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-10 rounded-xl bg-black/5" />
      ))}
    </div>
  )

  if (!data || data.length === 0) return (
    <div className="text-xs text-center py-4" style={{ color: 'var(--muted)' }}>
      No period history yet in the database — indexer will sync after the first period closes.
    </div>
  )

  return (
    <div className="glass-inner rounded-xl overflow-hidden mt-3">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: 'var(--border)', background: 'rgba(18,45,69,0.04)' }}>
        <Database className="size-3.5" style={{ color: 'var(--muted)' }} />
        <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
          Full period history · {data.length} period{data.length !== 1 ? 's' : ''}
        </span>
      </div>
      {data.map((p) => (
        <DbPeriodRow key={p.id} p={p} />
      ))}
    </div>
  )
}

// ── Subscription card ─────────────────────────────────────────────────────────
type ActiveView = 'live' | 'history'

function SubscriptionCard({ subscriptionId }: { subscriptionId: bigint }) {
  const { data: sub } = useReadContract({
    address: VERITAPAY_ADDRESS, abi: VERITAPAY_ABI, functionName: 'getSubscription',
    args: [subscriptionId], chainId: TARGET_CHAIN_ID,
    query: { enabled: !!VERITAPAY_ADDRESS, refetchInterval: 10000 },
  })

  const { data: service } = useReadContract({
    address: VERITAPAY_ADDRESS, abi: VERITAPAY_ABI, functionName: 'getServiceListing',
    args: [sub?.serviceId ?? 0n], chainId: TARGET_CHAIN_ID,
    query: { enabled: !!sub },
  })

  const { data: periodIds } = useReadContract({
    address: VERITAPAY_ADDRESS, abi: VERITAPAY_ABI, functionName: 'getSubscriptionPeriods',
    args: [subscriptionId], chainId: TARGET_CHAIN_ID,
    query: { enabled: !!VERITAPAY_ADDRESS, refetchInterval: 12000 },
  })

  const { writeContract: cancel, data: cancelHash } = useWriteContract()
  const { isSuccess: cancelConfirmed } = useWaitForTransactionReceipt({ hash: cancelHash })
  const refreshAll = useRefreshAll()
  const [activeView, setActiveView] = useState<ActiveView | null>(null)

  // Refresh list once cancel tx is confirmed on-chain
  useEffect(() => {
    if (cancelConfirmed) {
      toast.success('Subscription cancelled')
      refreshAll()
    }
  }, [cancelConfirmed]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!sub || !service) return (
    <div className="glass-card p-5 animate-pulse">
      <div className="h-4 bg-black/5 rounded w-2/3 mb-2" />
      <div className="h-3 bg-black/5 rounded w-1/3" />
    </div>
  )

  const toggleView = (v: ActiveView) => setActiveView((cur) => (cur === v ? null : v))

  return (
    <div className="glass-card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`size-2 rounded-full ${sub.active ? 'bg-green-500' : 'bg-gray-300'}`} />
          <div className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{service.name}</div>
        </div>
        <div className="flex items-center gap-2">
          {sub.active && (
            <button
              onClick={() => cancel(
                { address: VERITAPAY_ADDRESS, abi: VERITAPAY_ABI, functionName: 'cancelSubscription', args: [subscriptionId], chainId: TARGET_CHAIN_ID },
                { onSuccess: () => toast.success('Cancellation submitted — confirming...') },
              )}
              className="text-xs px-2.5 py-1 rounded-lg"
              style={{ background: 'rgba(220,38,38,0.08)', color: 'var(--danger)' }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="glass-inner p-2.5">
          <div className="text-xs mb-0.5" style={{ color: 'var(--muted)' }}>Budget / period</div>
          <div className="text-sm font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
            {Amount.fromRaw(sub.budgetPerPeriod, USDC_FACT.decimals).toFixed(2)}
            <span className="text-xs font-normal ml-1" style={{ color: 'var(--subtle)' }}>USDC</span>
          </div>
        </div>
        <div className="glass-inner p-2.5">
          <div className="text-xs mb-0.5" style={{ color: 'var(--muted)' }}>Total paid</div>
          <div className="text-sm font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
            {Amount.fromRaw(sub.totalPaid, USDC_FACT.decimals).toFixed(2)}
            <span className="text-xs font-normal ml-1" style={{ color: 'var(--subtle)' }}>USDC</span>
          </div>
        </div>
        <div className="glass-inner p-2.5">
          <div className="text-xs mb-0.5" style={{ color: 'var(--muted)' }}>Honest periods</div>
          <div className="text-sm font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
            {sub.honestPeriods.toString()}<span style={{ color: 'var(--subtle)' }}>/{sub.totalPeriods.toString()}</span>
          </div>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex gap-2 mb-1">
        <button
          onClick={() => toggleView('live')}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all"
          style={activeView === 'live'
            ? { background: 'var(--accent)', color: '#fff' }
            : { background: 'rgba(18,45,69,0.07)', color: 'var(--muted)' }}
        >
          {activeView === 'live' ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          Live periods
        </button>
        <button
          onClick={() => toggleView('history')}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all"
          style={activeView === 'history'
            ? { background: 'var(--accent)', color: '#fff' }
            : { background: 'rgba(18,45,69,0.07)', color: 'var(--muted)' }}
        >
          {activeView === 'history' ? <ChevronUp className="size-3" /> : <Database className="size-3" />}
          Full history
        </button>
      </div>

      {/* Live periods (last 6, contract reads) */}
      {activeView === 'live' && periodIds && periodIds.length > 0 && (
        <div className="space-y-2 mt-2">
          {[...periodIds].reverse().slice(0, 6).map((pid) => (
            <LivePeriodRow key={pid.toString()} periodId={pid} serviceId={sub.serviceId} />
          ))}
        </div>
      )}

      {/* Full history from DB */}
      {activeView === 'history' && (
        <PeriodHistoryPanel subscriptionId={subscriptionId} />
      )}
    </div>
  )
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export function SubscriberDashboard() {
  const { address } = useAccount()

  const { data: subscriptionIds } = useReadContract({
    address: VERITAPAY_ADDRESS, abi: VERITAPAY_ABI, functionName: 'getActiveSubscriptions',
    args: [address!], chainId: TARGET_CHAIN_ID,
    query: { enabled: !!address && !!VERITAPAY_ADDRESS, refetchInterval: 15000 },
  })

  const { data: usdcBalance } = useReadContract({
    address: USDC_FACT.address as `0x${string}`, abi: erc20Abi, functionName: 'balanceOf',
    args: [address!], chainId: TARGET_CHAIN_ID, query: { enabled: !!address },
  })

  if (!address) return (
    <div className="glass-card p-8 text-center">
      <div className="text-sm" style={{ color: 'var(--muted)' }}>Connect your wallet to view subscriptions.</div>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="display text-2xl font-bold" style={{ color: 'var(--ink)' }}>My Subscriptions</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
            Monitor SLA performance and settlement status
          </p>
        </div>
        {usdcBalance !== undefined && (
          <div className="glass-inner px-4 py-2.5 text-right">
            <div className="text-xs" style={{ color: 'var(--muted)' }}>USDC balance</div>
            <div className="display text-base font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
              {Amount.fromRaw(usdcBalance, USDC_FACT.decimals).toFixed(2)}
              <span className="text-xs font-normal ml-1" style={{ color: 'var(--subtle)' }}>USDC</span>
            </div>
          </div>
        )}
      </div>

      {!subscriptionIds || subscriptionIds.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <CheckCircle2 className="size-8 mx-auto mb-3" style={{ color: 'var(--subtle)' }} />
          <div className="text-sm font-semibold mb-1" style={{ color: 'var(--ink)' }}>No active subscriptions</div>
          <div className="text-xs" style={{ color: 'var(--muted)' }}>Browse the marketplace to find services.</div>
        </div>
      ) : (
        <div className="space-y-4">
          {subscriptionIds.map((id) => (
            <SubscriptionCard key={id.toString()} subscriptionId={id} />
          ))}
        </div>
      )}
    </div>
  )
}
