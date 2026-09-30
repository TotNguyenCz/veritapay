import { PERIOD_STATE_LABELS, PERIOD_STATE_CLASS } from '@/veritapay-config'

interface Props {
  state: number
}

export function StatePill({ state }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${PERIOD_STATE_CLASS[state] ?? 'badge-pending'}`}
    >
      {PERIOD_STATE_LABELS[state] ?? 'Unknown'}
    </span>
  )
}
