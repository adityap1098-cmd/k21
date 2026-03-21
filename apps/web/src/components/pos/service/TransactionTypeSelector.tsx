'use client'

type TransactionType = 'RETAIL' | 'SERVICE'

interface Props {
  activeType: TransactionType
  onTypeChange: (type: TransactionType) => void
}

export function TransactionTypeSelector({ activeType, onTypeChange }: Props) {
  return (
    <div
      data-testid="transaction-type-selector"
      className="flex items-center gap-1.5 bg-surface-subtle rounded-xl p-1"
    >
      <button
        onClick={() => onTypeChange('RETAIL')}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${
          activeType === 'RETAIL'
            ? 'bg-brand text-white shadow-sm'
            : 'text-ink-secondary hover:text-ink hover:bg-surface-raised'
        }`}
      >
        <span>🛒</span>
        <span>Retail</span>
      </button>
      <button
        onClick={() => onTypeChange('SERVICE')}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${
          activeType === 'SERVICE'
            ? 'bg-brand text-white shadow-sm'
            : 'text-ink-secondary hover:text-ink hover:bg-surface-raised'
        }`}
      >
        <span>🔧</span>
        <span>Service</span>
      </button>
    </div>
  )
}
