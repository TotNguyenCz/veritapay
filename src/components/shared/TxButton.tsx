import { Loader2 } from 'lucide-react'

interface Props {
  onClick: () => void
  disabled?: boolean
  isPending?: boolean
  isConfirming?: boolean
  isSuccess?: boolean
  label: string
  variant?: 'primary' | 'danger' | 'ghost'
  className?: string
  fullWidth?: boolean
}

export function TxButton({
  onClick, disabled, isPending, isConfirming, isSuccess, label, variant = 'primary', className = '', fullWidth = false,
}: Props) {
  const base = `${fullWidth ? 'w-full' : ''} inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 ${className}`

  const styles: Record<string, React.CSSProperties> = {
    primary: { background: 'var(--accent)', color: '#fff' },
    danger: { background: 'var(--danger)', color: '#fff' },
    ghost: { background: 'rgba(18,45,69,0.08)', color: 'var(--accent)' },
  }

  const isBusy = isPending || isConfirming
  const content = isBusy
    ? (<><Loader2 className="size-4 animate-spin" />{isPending ? 'Confirm in wallet...' : 'Confirming...'}</>)
    : isSuccess ? 'Done' : label

  return (
    <button
      onClick={onClick}
      disabled={disabled || isBusy}
      className={base}
      style={styles[variant]}
    >
      {content}
    </button>
  )
}
