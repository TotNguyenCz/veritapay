import { useState } from 'react'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useRefreshAll } from '@/hooks/useRefreshAll'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { VERITAPAY_ADDRESS, VERITAPAY_ABI, TARGET_CHAIN_ID } from '@/veritapay-config'
import { parseAmount } from '@/onchain-money'
import { TxButton } from '@/components/shared/TxButton'

interface Props { onClose: () => void }

const DURATION_OPTS = [
  { label: '1 week', value: 7 * 86400 },
  { label: '1 month', value: 30 * 86400 },
  { label: '3 months', value: 90 * 86400 },
]

const CHALLENGE_OPTS = [
  { label: '24h', value: 86400 },
  { label: '48h', value: 48 * 3600 },
  { label: '7 days', value: 7 * 86400 },
]

const GRACE_OPTS = [
  { label: '12h', value: 12 * 3600 },
  { label: '24h', value: 86400 },
  { label: '3 days', value: 3 * 86400 },
]

export function RegisterServiceSheet({ onClose }: Props) {
  const refreshAll = useRefreshAll()
  const [name, setName] = useState('')
  const [metadataUri, setMetadataUri] = useState('')
  const [price, setPrice] = useState('')
  const [period, setPeriod] = useState(DURATION_OPTS[1].value)
  const [challengeWindow, setChallengeWindow] = useState(CHALLENGE_OPTS[1].value)
  const [gracePeriod, setGracePeriod] = useState(GRACE_OPTS[1].value)
  const [targetUptime, setTargetUptime] = useState('99.9')

  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const targetUptimeBps = Math.round(parseFloat(targetUptime || '0') * 100)
  const priceRaw = (() => {
    try { return parseAmount(TARGET_CHAIN_ID, price).raw } catch { return 0n }
  })()

  const valid = name.trim().length > 0 && priceRaw > 0n && targetUptimeBps > 0 && targetUptimeBps <= 10000

  const handleRegister = () => {
    writeContract({
      address: VERITAPAY_ADDRESS,
      abi: VERITAPAY_ABI,
      functionName: 'registerService',
      args: [name.trim(), metadataUri.trim(), priceRaw, period, challengeWindow, gracePeriod, targetUptimeBps],
      chainId: TARGET_CHAIN_ID,
    }, {
      onSuccess: () => { toast.success('Service registered!'); refreshAll(); setTimeout(onClose, 1800) },
      onError: (e) => toast.error('Registration failed: ' + e.message.slice(0, 100)),
    })
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <div className="absolute inset-0 backdrop-blur-sm" style={{ background: 'var(--overlay)' }} />
        <motion.section
          className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl"
          style={{ background: 'var(--surface-strong)', backdropFilter: 'blur(40px) saturate(200%)', WebkitBackdropFilter: 'blur(40px) saturate(200%)', border: '1px solid var(--border)' }}
          initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-1" style={{ background: 'linear-gradient(90deg, var(--accent), var(--accent-hover))' }} />
          <div className="flex justify-center pt-3 pb-1">
            <div className="h-1 w-10 rounded-full" style={{ background: 'var(--border-strong)' }} />
          </div>
          <div className="px-6 pb-8 pt-3 overflow-y-auto max-h-[85vh]">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="font-bold text-base" style={{ color: 'var(--ink)' }}>List a Service</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Commit to SLA terms — your reputation is on-chain</div>
              </div>
              <button onClick={onClose} className="rounded-full p-1.5 transition-colors" style={{ background: 'transparent' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-muted)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}><X className="size-4" style={{ color: 'var(--muted)' }} /></button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>Service name</div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Data Indexer Pro"
                  className="glass-inner w-full px-3.5 py-2.5 text-sm outline-none"
                  style={{ color: 'var(--ink)' }}
                />
              </label>

              <label className="block">
                <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>Docs / metadata URI (optional)</div>
                <input
                  value={metadataUri}
                  onChange={(e) => setMetadataUri(e.target.value)}
                  placeholder="https://..."
                  className="glass-inner w-full px-3.5 py-2.5 text-sm outline-none"
                  style={{ color: 'var(--ink)' }}
                />
              </label>

              <label className="block">
                <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>Price per period (USDC)</div>
                <input
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9.]/g, '')
                    if (v === '' || /^\d*\.?\d*$/.test(v)) setPrice(v)
                  }}
                  placeholder="0.00"
                  className="glass-inner w-full px-3.5 py-2.5 text-sm outline-none tabular-nums"
                  style={{ color: 'var(--ink)' }}
                />
              </label>

              <div>
                <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>Billing period</div>
                <div className="flex gap-2">
                  {DURATION_OPTS.map((o) => (
                    <button key={o.value} onClick={() => setPeriod(o.value)}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                      style={{ background: period === o.value ? 'var(--accent)' : 'var(--surface-muted)', color: period === o.value ? 'var(--accent-fg)' : 'var(--accent)' }}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>Challenge window (subscriber dispute time)</div>
                <div className="flex gap-2">
                  {CHALLENGE_OPTS.map((o) => (
                    <button key={o.value} onClick={() => setChallengeWindow(o.value)}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                      style={{ background: challengeWindow === o.value ? 'var(--accent)' : 'var(--surface-muted)', color: challengeWindow === o.value ? 'var(--accent-fg)' : 'var(--accent)' }}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>Attestation grace period (time to submit after period ends)</div>
                <div className="flex gap-2">
                  {GRACE_OPTS.map((o) => (
                    <button key={o.value} onClick={() => setGracePeriod(o.value)}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                      style={{ background: gracePeriod === o.value ? 'var(--accent)' : 'rgba(18,45,69,0.07)', color: gracePeriod === o.value ? '#fff' : 'var(--accent)' }}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>Target uptime SLA (%)</div>
                <input
                  inputMode="decimal"
                  value={targetUptime}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9.]/g, '')
                    if (v === '' || /^\d*\.?\d*$/.test(v)) setTargetUptime(v)
                  }}
                  placeholder="99.9"
                  className="glass-inner w-full px-3.5 py-2.5 text-sm outline-none tabular-nums"
                  style={{ color: 'var(--ink)' }}
                />
                <div className="text-xs mt-1" style={{ color: 'var(--subtle)' }}>
                  = {targetUptimeBps} bps. Payment = budget × (reported / target).
                </div>
              </label>

              <TxButton
                onClick={handleRegister}
                isPending={isPending}
                isConfirming={isConfirming}
                isSuccess={isSuccess}
                disabled={!valid}
                label="Register service"
                fullWidth
              />
            </div>
          </div>
        </motion.section>
      </motion.div>
    </AnimatePresence>
  )
}
