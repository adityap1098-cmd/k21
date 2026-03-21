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
      className="flex items-center gap-1 bg-gray-100 rounded-lg p-1"
    >
      <button
        onClick={() => onTypeChange('RETAIL')}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          activeType === 'RETAIL'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
        }`}
      >
        <span>🛒</span>
        <span>Retail</span>
      </button>
      <button
        onClick={() => onTypeChange('SERVICE')}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          activeType === 'SERVICE'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
        }`}
      >
        <span>🔧</span>
        <span>Service</span>
      </button>
    </div>
  )
}
