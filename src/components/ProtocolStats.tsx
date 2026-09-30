/**
 * ProtocolStats — a compact protocol-wide statistics bar fetched from the backend DB.
 * Used in the header of each dashboard tab.
 */

import { useApi } from '@/hooks/useApi'
import { Amount } from '@/onchain-money'
import { USDC_FACT } from '@/veritapay-config'

interface Stats {
  totalServices: number
  totalSubscriptions: number
  periodsSettled: number
  periodsDisputed: number
  periodsMissed: number
  totalUsdcSettled: string
}

export function ProtocolStats() {
  const { data } = useApi<Stats>('/stats', { refreshInterval: 20_000 })

  if (!data) return null

  const settled = Amount.fromRaw(BigInt(data.totalUsdcSettled || '0'), USDC_FACT.decimals).toFixed(2)

  const items = [
    { label: 'Services', value: data.totalServices.toString() },
    { label: 'Subscriptions', value: data.totalSubscriptions.toString() },
    { label: 'Periods settled', value: data.periodsSettled.toString() },
    { label: 'USDC settled', value: `${settled} USDC` },
    { label: 'Disputes', value: data.periodsDisputed.toString() },
  ]

  return (
    <div className="flex flex-wrap gap-3 mb-6">
      {items.map((item) => (
        <div key={item.label} className="glass-inner flex items-center gap-2 px-3 py-1.5 rounded-full">
          <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{item.label}</span>
          <span className="text-xs font-bold tabular-nums display" style={{ color: 'var(--ink)' }}>{item.value}</span>
        </div>
      ))}
    </div>
  )
}
