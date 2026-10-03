import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { useRefreshAll } from '@/hooks/useRefreshAll'
import { erc20Abi } from 'viem'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { VERITAPAY_ADDRESS, VERITAPAY_ABI, TARGET_CHAIN_ID, USDC_FACT } from '@/veritapay-config'
import { parseAmount, Amount } from '@/onchain-money'
import { TxButton } from '@/components/shared/TxButton'

interface ServiceListing {
  vendor: `0x${string}`
  name: string
  pricePerPeriod: bigint
  periodDuration: number
  challengeWindow: number
  targetUptimeBps: number
}

interface Props {
  serviceId: bigint
  service: ServiceListing
  onClose: () => void
}

const DURATION_OPTIONS = [
  { label: 'Open-ended', value: 0 },
  { label: '1 month', value: 30 * 86400 },
  { label: '3 months', value: 90 * 86400 },
  { label: '6 months', value: 180 * 86400 },
  { label: '1 year', value: 365 * 86400 },
]

export function SubscribeSheet({ serviceId, service, onClose }: Props) {
  const { address } = useAccount()
  const refreshAll = useRefreshAll()
  const defaultBudget = Amount.fromRaw(service.pricePerPeriod, USDC_FACT.decimals).toFixed(2)

  const [budget, setBudget] = useState(defaultBudget)
  const [duration, setDuration] = useState(0)

  // Read current allowance
  const { data: allowance } = useReadContract({
    address: USDC_FACT.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [address!, VERITAPAY_ADDRESS],
    chainId: TARGET_CHAIN_ID,
    query: { enabled: !!address && !!VERITAPAY_ADDRESS },
  })

  // Approve USDC
  const { writeContract: approve, data: approveHash, isPending: approvePending } = useWriteContract()
  const { isLoading: approveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash })

  // Subscribe
  const { writeContract: subscribeFn, data: subHash, isPending: subPending } = useWriteContract()
  const { isLoading: subConfirming, isSuccess: subSuccess } = useWaitForTransactionReceipt({ hash: subHash })

  const budgetRaw = (() => {
    try { return parseAmount(TARGET_CHAIN_ID, budget).raw } catch { return 0n }
  })()

  // Check if approval covers at least budgetPerPeriod
  const needsApproval = !allowance || allowance < budgetRaw

  const handleApprove = () => {
    if (!address) return
    // Approve a large amount so user doesn't need to re-approve for every period
    const maxApproval = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
    approve({
      address: USDC_FACT.address as `0x${string}`,
      abi: erc20Abi,
      functionName: 'approve',
      args: [VERITAPAY_ADDRESS, maxApproval],
      chainId: TARGET_CHAIN_ID,
    }, {
      onSuccess: () => { toast.success('USDC spending approved'); refreshAll() },
      onError: (e) => toast.error('Approval failed: ' + e.message.slice(0, 80)),
    })
  }

  const handleSubscribe = () => {
    subscribeFn({
      address: VERITAPAY_ADDRESS,
      abi: VERITAPAY_ABI,
      functionName: 'subscribe',
      args: [serviceId, budgetRaw, BigInt(duration)],
      chainId: TARGET_CHAIN_ID,
    }, {
      onSuccess: () => { toast.success('Subscribed!'); refreshAll(); setTimeout(onClose, 1800) },
      onError: (e) => toast.error('Subscribe failed: ' + e.message.slice(0, 100)),
    })
  }

  const budgetNum = parseFloat(budget || '0')
  const priceNum = parseFloat(Amount.fromRaw(service.pricePerPeriod, USDC_FACT.decimals).toFixed(2))
  const budgetValid = budgetNum > 0 && budgetNum <= priceNum * 2

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" />
        <motion.section
          className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl"
          style={{ background: 'var(--surface-strong)', backdropFilter: 'blur(40px) saturate(200%)', WebkitBackdropFilter: 'blur(40px) saturate(200%)', border: '1px solid var(--border)' }}
          initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* spectral strip */}
          <div className="h-1 rounded-t-2xl" style={{ background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)' }} />
          <div className="px-6 pb-8 pt-3">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="font-bold text-base" style={{ color: 'var(--ink)' }}>Subscribe to {service.name}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>USDC auto-settles proportionally after each period</div>
              </div>
              <button onClick={onClose} className="rounded-full p-1.5 hover:bg-black/5">
                <X className="size-4" style={{ color: 'var(--muted)' }} />
              </button>
            </div>

            {/* Budget input */}
            <div className="glass-inner p-4 mb-4">
              <div className="text-xs font-semibold mb-2" style={{ color: 'var(--muted)' }}>Max budget per period</div>
              <div className="flex items-center gap-2">
                <input
                  inputMode="decimal"
                  value={budget}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9.]/g, '')
                    if (v === '' || /^\d*\.?\d*$/.test(v)) setBudget(v)
                  }}
                  placeholder="0.00"
                  className="display flex-1 bg-transparent text-3xl font-bold tabular-nums outline-none placeholder:text-slate-300"
                  style={{ color: 'var(--ink)' }}
                />
                <span className="text-base font-semibold" style={{ color: 'var(--subtle)' }}>USDC</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs" style={{ color: 'var(--subtle)' }}>Vendor asks {Amount.fromRaw(service.pricePerPeriod, USDC_FACT.decimals).toFixed(2)} USDC</span>
                <button
                  onClick={() => setBudget(defaultBudget)}
                  className="text-xs font-semibold"
                  style={{ color: 'var(--accent-hover)' }}
                >
                  Use ask price
                </button>
              </div>
            </div>

            {!budgetValid && budget !== '' && (
              <div className="text-xs mb-3" style={{ color: 'var(--danger)' }}>
                Budget must be between 0.01 and {Amount.fromRaw(service.pricePerPeriod * 2n, USDC_FACT.decimals).toFixed(2)} USDC
              </div>
            )}

            {/* Duration */}
            <div className="glass-inner p-3 mb-5">
              <div className="text-xs font-semibold mb-2" style={{ color: 'var(--muted)' }}>Subscription duration</div>
              <div className="flex gap-2 flex-wrap">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setDuration(opt.value)}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                    style={{
                      background: duration === opt.value ? 'var(--accent)' : 'rgba(18,45,69,0.07)',
                      color: duration === opt.value ? '#fff' : 'var(--accent)',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Flow: approve then subscribe */}
            {needsApproval && !approveSuccess ? (
              <div className="space-y-3">
                <div className="text-xs rounded-xl px-3 py-2.5" style={{ background: 'rgba(59,130,246,0.08)', color: '#2563eb' }}>
                  Step 1 of 2: Allow VeritaPay to collect USDC at settlement time
                </div>
                <TxButton
                  onClick={handleApprove}
                  isPending={approvePending}
                  isConfirming={approveConfirming}
                  disabled={!budgetValid}
                  label="Allow USDC spending"
                  fullWidth
                />
              </div>
            ) : (
              <div className="space-y-3">
                {needsApproval && approveSuccess && (
                  <div className="text-xs rounded-xl px-3 py-2.5" style={{ background: 'rgba(22,163,74,0.08)', color: 'var(--success)' }}>
                    Approval confirmed. Now subscribe.
                  </div>
                )}
                <TxButton
                  onClick={handleSubscribe}
                  isPending={subPending}
                  isConfirming={subConfirming}
                  isSuccess={subSuccess}
                  disabled={!budgetValid}
                  label="Subscribe now"
                  fullWidth
                />
              </div>
            )}
          </div>
        </motion.section>
      </motion.div>
    </AnimatePresence>
  )
}
