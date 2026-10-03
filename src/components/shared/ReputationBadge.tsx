import { ShieldCheck, Sparkles } from 'lucide-react'
import { formatScorePct, scoreColor } from '@/veritapay-config'
import { useReadContract } from 'wagmi'
import { VERITAPAY_ADDRESS, VERITAPAY_ABI, TARGET_CHAIN_ID } from '@/veritapay-config'

interface Props {
  vendor: `0x${string}`
  size?: 'sm' | 'md'
}

export function ReputationBadge({ vendor, size = 'md' }: Props) {
  const { data, isLoading } = useReadContract({
    address: VERITAPAY_ADDRESS,
    abi: VERITAPAY_ABI,
    functionName: 'getVendorReputation',
    args: [vendor],
    chainId: TARGET_CHAIN_ID,
    query: { enabled: !!VERITAPAY_ADDRESS && !!vendor },
  })

  const isSm = size === 'sm'
  const baseClass = `inline-flex items-center gap-1 font-semibold tabular-nums rounded-full ${isSm ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'}`

  // Still loading — show skeleton
  if (isLoading || !data) {
    return (
      <span className={`${baseClass} animate-pulse`}
        style={{ background: 'var(--surface-muted)', color: 'transparent', minWidth: isSm ? 48 : 64 }}>
        ——
      </span>
    )
  }

  const [score, , total] = data

  // No history yet — show "New" badge instead of misleading 66.66%
  if (total === 0n) {
    return (
      <span className={baseClass}
        style={{ background: 'rgba(99,102,241,0.10)', color: 'rgb(99,102,241)' }}
        title="New vendor — reputation builds after the first billing period">
        <Sparkles className={isSm ? 'size-3' : 'size-3.5'} />
        New
      </span>
    )
  }

  const color = scoreColor(score)
  return (
    <span className={baseClass}
      style={{ background: `${color}18`, color }}
      title={`Bayesian reputation: ${Number(data[1])} honored / ${Number(total)} total periods`}>
      <ShieldCheck className={isSm ? 'size-3' : 'size-3.5'} />
      {formatScorePct(score)}
    </span>
  )
}
