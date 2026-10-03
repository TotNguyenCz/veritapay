import { useState } from 'react'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { keccak256 } from 'viem'
import { VERITAPAY_ADDRESS, VERITAPAY_ABI, TARGET_CHAIN_ID } from '@/veritapay-config'
import { TxButton } from '@/components/shared/TxButton'

interface Props { periodId: bigint; onClose: () => void }

export function AttestSheet({ periodId, onClose }: Props) {
  const [uptime, setUptime] = useState('99.9')
  const [latency, setLatency] = useState('120')
  const [errorRate, setErrorRate] = useState('0.1')
  const [evidenceUrl, setEvidenceUrl] = useState('')

  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const uptimeBps = Math.min(10000, Math.round(parseFloat(uptime || '0') * 100))
  const errorRateBps = Math.min(10000, Math.round(parseFloat(errorRate || '0') * 100))
  const latencyMs = Math.round(parseFloat(latency || '0'))

  // Derive evidence hash from URL (keccak256 of bytes)
  const evidenceHash: `0x${string}` = evidenceUrl.trim()
    ? keccak256(new TextEncoder().encode(evidenceUrl.trim()) as Uint8Array)
    : '0x0000000000000000000000000000000000000000000000000000000000000000'

  const valid = uptimeBps > 0 && latencyMs >= 0

  const handleAttest = () => {
    writeContract({
      address: VERITAPAY_ADDRESS, abi: VERITAPAY_ABI, functionName: 'submitAttestation',
      args: [periodId, uptimeBps, latencyMs, errorRateBps, evidenceHash],
      chainId: TARGET_CHAIN_ID,
    }, {
      onSuccess: () => { toast.success('Attestation submitted'); setTimeout(onClose, 1800) },
      onError: (e) => toast.error('Attestation failed: ' + e.message.slice(0, 100)),
    })
  }

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
          <div className="h-1 rounded-t-2xl" style={{ background: 'linear-gradient(90deg, #16a34a, #22c55e)' }} />
          <div className="px-6 pb-8 pt-3">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="font-bold text-base" style={{ color: 'var(--ink)' }}>Submit attestation</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Period #{periodId.toString().slice(0, 8)}…</div>
              </div>
              <button onClick={onClose} className="rounded-full p-1.5 hover:bg-black/5">
                <X className="size-4" style={{ color: 'var(--muted)' }} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>Uptime (%)</div>
                  <input
                    inputMode="decimal" value={uptime}
                    onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ''); if (v === '' || /^\d*\.?\d*$/.test(v)) setUptime(v) }}
                    className="glass-inner w-full px-3 py-2.5 text-sm tabular-nums outline-none"
                    style={{ color: 'var(--ink)' }}
                  />
                </label>
                <label className="block">
                  <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>Latency p99 (ms)</div>
                  <input
                    inputMode="numeric" value={latency}
                    onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ''); setLatency(v) }}
                    className="glass-inner w-full px-3 py-2.5 text-sm tabular-nums outline-none"
                    style={{ color: 'var(--ink)' }}
                  />
                </label>
                <label className="block">
                  <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>Error rate (%)</div>
                  <input
                    inputMode="decimal" value={errorRate}
                    onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ''); if (v === '' || /^\d*\.?\d*$/.test(v)) setErrorRate(v) }}
                    className="glass-inner w-full px-3 py-2.5 text-sm tabular-nums outline-none"
                    style={{ color: 'var(--ink)' }}
                  />
                </label>
              </div>

              <label className="block">
                <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>Evidence URL (optional — hashed onchain)</div>
                <input
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                  placeholder="https://statuspage.example.com/report/..."
                  className="glass-inner w-full px-3.5 py-2.5 text-sm outline-none"
                  style={{ color: 'var(--ink)' }}
                />
              </label>

              {/* Preview */}
              <div className="glass-inner p-3.5 flex items-center gap-4">
                <div>
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>Perf. score</div>
                  <div className="font-bold tabular-nums text-sm" style={{ color: 'var(--ink)' }}>
                    {uptimeBps} bps
                  </div>
                </div>
                <div>
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>Evidence hash</div>
                  <div className="mono text-xs truncate max-w-[160px]" style={{ color: 'var(--subtle)' }}>
                    {evidenceHash.slice(0, 18)}…
                  </div>
                </div>
              </div>

              <TxButton
                onClick={handleAttest}
                isPending={isPending} isConfirming={isConfirming} isSuccess={isSuccess}
                disabled={!valid}
                label="Submit attestation"
                fullWidth
              />
            </div>
          </div>
        </motion.section>
      </motion.div>
    </AnimatePresence>
  )
}
