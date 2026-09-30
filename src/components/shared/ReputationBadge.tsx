import { ShieldCheck } from 'lucide-react'
import { formatScorePct, scoreColor } from '@/veritapay-config'
import { useReadContract } from 'wagmi'
import { VERITAPAY_ADDRESS, VERITAPAY_ABI, TARGET_CHAIN_ID } from '@/veritapay-config'

interface Props {
  vendor: `0x${string}`
  size?: 'sm' | 'md'
}

export function ReputationBadge({ vendor, size = 'md' }: Props) {
  const { data } = useReadContract({
    address: VERITAPAY_ADDRESS,
    abi: VERITAPAY_ABI,
    functionName: 'getVendorReputation',
    args: [vendor],
    chainId: TARGET_CHAIN_ID,
    query: { enabled: !!VERITAPAY_ADDRESS && !!vendor },
  })

  if (!data) return null
  const [score] = data
  const color = scoreColor(score)
  const isSm = size === 'sm'

  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold tabular-nums rounded-full ${isSm ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'}`}
      style={{ background: `${color}18`, color }}
    >
      <ShieldCheck className={isSm ? 'size-3' : 'size-3.5'} />
      {formatScorePct(score)}
    </span>
  )
}
