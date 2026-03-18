import { ProductPanel } from '@/components/pos/ProductPanel'
import { CartPanel } from '@/components/pos/CartPanel'

export default function PosPage() {
  return (
    <div className="flex h-screen bg-gray-50">
      <div className="flex-1 overflow-hidden">
        <ProductPanel />
      </div>
      <div className="w-96 border-l border-gray-200 bg-white flex flex-col">
        <CartPanel />
      </div>
    </div>
  )
}
