import { useState } from 'react'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { toast } from 'sonner'
import { X, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { VERITAPAY_ADDRESS, VERITAPAY_ABI, TARGET_CHAIN_ID } from '@/veritapay-config'
import { TxButton } from '@/components/shared/TxButton'

interface Props { periodId: bigint; onClose: () => void }

export function DisputeSheet({ periodId, onClose }: Props) {
  const [reason, setReason] = useState('')
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const handleDispute = () => {
    writeContract({
      address: VERITAPAY_ADDRESS, abi: VERITAPAY_ABI, functionName: 'disputePeriod',
      args: [periodId, reason.trim()], chainId: TARGET_CHAIN_ID,
    }, {
      onSuccess: () => { toast.success('Dispute submitted'); setTimeout(onClose, 1800) },
      onError: (e) => toast.error('Failed: ' + e.message.slice(0, 100)),
    })
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
        <motion.div
          className="relative w-full max-w-md rounded-3xl p-6"
          style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(30px)' }}
          initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2" style={{ color: 'var(--danger)' }}>
              <AlertTriangle className="size-5" />
              <span className="font-bold text-sm">Dispute this period</span>
            </div>
            <button onClick={onClose} className="rounded-full p-1.5 hover:bg-black/5">
              <X className="size-4" style={{ color: 'var(--muted)' }} />
            </button>
          </div>

          <div className="text-xs mb-4 rounded-xl px-3 py-2.5" style={{ background: 'rgba(220,38,38,0.06)', color: 'var(--danger)' }}>
            If the vendor doesn't respond within 7 days of dispute, you win automatically and no payment is sent.
          </div>

          <label className="block mb-4">
            <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>Reason for dispute</div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the SLA breach — e.g. service was down from 14:00–16:30 UTC on Sep 28"
              rows={3}
              className="glass-inner w-full px-3.5 py-2.5 text-sm outline-none resize-none"
              style={{ color: 'var(--ink)' }}
            />
          </label>

          <TxButton
            onClick={handleDispute}
            isPending={isPending} isConfirming={isConfirming} isSuccess={isSuccess}
            disabled={reason.trim().length < 10}
            label="Submit dispute"
            variant="danger" fullWidth
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
