'use client'

import { useState, useCallback } from 'react'
import { CustomerVehicleForm } from './CustomerVehicleForm'
import { OpenOrdersList } from './OpenOrdersList'
import { ServiceOrderPanel } from './ServiceOrderPanel'
import { ServicePaymentModal } from './ServicePaymentModal'
import { ServiceHistoryView } from './ServiceHistoryView'
import { ReceivablesView } from './ReceivablesView'
import { ReceiptModal } from '@/components/pos/ReceiptModal'
import type { ReceiptData } from '@/lib/receipt/encoder'

type TabId = 'new-order' | 'open-orders' | 'history' | 'receivables'
type Step = 'select-customer' | 'manage-order'

interface ServiceOrder {
  id: string
  orderNumber: string
  vehicleId: string
  complaint: string | null
  workStatus: string
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'new-order', label: 'Order Baru' },
  { id: 'open-orders', label: 'Order Aktif' },
  { id: 'history', label: 'Riwayat' },
  { id: 'receivables', label: 'Piutang' },
]

export function ServiceFlow({ compact, onTransactionComplete }: { compact?: boolean; onTransactionComplete?: () => void } = {}) {
  const [activeTab, setActiveTab] = useState<TabId>('new-order')
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('select-customer')

  const [openOrdersSelectedId, setOpenOrdersSelectedId] = useState<string | null>(null)

  // Payment modal state
  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean
    orderId: string
    orderTotal: number
    existingPaymentsTotal: number
  }>({ isOpen: false, orderId: '', orderTotal: 0, existingPaymentsTotal: 0 })

  // Receipt modal state (same as retail)
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)

  const handleOrderCreated = useCallback((order: ServiceOrder) => {
    setActiveOrderId(order.id)
    setStep('manage-order')
  }, [])

  const handleNewOrder = useCallback(() => {
    setActiveOrderId(null)
    setStep('select-customer')
    setActiveTab('new-order')
  }, [])

  const handleOpenOrderSelect = useCallback((orderId: string) => {
    setOpenOrdersSelectedId(orderId)
  }, [])

  const handleBackToOpenOrders = useCallback(() => {
    setOpenOrdersSelectedId(null)
  }, [])

  const handleBackToCustomerForm = useCallback(() => {
    setActiveOrderId(null)
    setStep('select-customer')
  }, [])

  const handleRequestPayment = useCallback((orderId: string, total: number, paid: number) => {
    setPaymentModal({ isOpen: true, orderId, orderTotal: total, existingPaymentsTotal: paid })
  }, [])

  const handlePaymentSuccess = useCallback((data: ReceiptData) => {
    setPaymentModal(prev => ({ ...prev, isOpen: false }))
    setReceiptData(data)
    onTransactionComplete?.()
  }, [onTransactionComplete])

  const handlePaymentClose = useCallback(() => {
    setPaymentModal(prev => ({ ...prev, isOpen: false }))
  }, [])

  const handleOrderUpdated = useCallback(() => {}, [])

  const renderTabContent = () => {
    switch (activeTab) {
      case 'new-order':
        if (step === 'select-customer') {
          return <CustomerVehicleForm onOrderCreated={handleOrderCreated} />
        }
        return activeOrderId ? (
          <ServiceOrderPanel
            orderId={activeOrderId}
            onBack={handleBackToCustomerForm}
            onOrderUpdated={handleOrderUpdated}
            onRequestPayment={handleRequestPayment}
          />
        ) : null

      case 'open-orders':
        if (openOrdersSelectedId) {
          return (
            <ServiceOrderPanel
              orderId={openOrdersSelectedId}
              onBack={handleBackToOpenOrders}
              onOrderUpdated={handleOrderUpdated}
              onRequestPayment={handleRequestPayment}
            />
          )
        }
        return <OpenOrdersList onSelectOrder={handleOpenOrderSelect} />

      case 'history':
        return <ServiceHistoryView />
      case 'receivables':
        return <ReceivablesView onRequestPayment={handleRequestPayment} />
    }
  }

  return (
    <div data-testid="service-flow" className="flex flex-col h-full bg-surface">
      {/* Tab bar */}
      <div className={`flex items-center gap-1 shrink-0 overflow-x-auto no-scrollbar ${compact ? 'px-3 py-1.5' : 'px-4 py-3 gap-1.5'}`}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id)
              if (tab.id !== 'open-orders') {
                setOpenOrdersSelectedId(null)
              }
            }}
            className={`flex items-center shrink-0 transition-colors ${
              compact
                ? `rounded-lg py-1 px-2.5 ${activeTab === tab.id ? 'bg-brand text-white' : 'bg-surface-subtle border border-border text-ink-secondary hover:bg-surface-raised hover:text-ink'}`
                : `rounded-[20px] py-[7px] px-4 ${activeTab === tab.id ? 'bg-brand text-white' : 'bg-surface-subtle border border-border text-ink-secondary hover:bg-surface-raised hover:text-ink'}`
            }`}
          >
            <span className={`font-medium leading-4 ${compact ? 'text-[11px]' : 'text-[13px]'}`}>{tab.label}</span>
          </button>
        ))}

        {activeTab !== 'new-order' || step !== 'select-customer' ? (
          <button
            onClick={handleNewOrder}
            className={`ml-auto text-brand hover:text-brand-hover font-medium transition-colors shrink-0 ${compact ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-[13px]'}`}
          >
            + Order Baru
          </button>
        ) : null}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {renderTabContent()}
      </div>

      {/* Payment modal */}
      <ServicePaymentModal
        isOpen={paymentModal.isOpen}
        orderId={paymentModal.orderId}
        orderTotal={paymentModal.orderTotal}
        existingPaymentsTotal={paymentModal.existingPaymentsTotal}
        onSuccess={handlePaymentSuccess}
        onClose={handlePaymentClose}
      />

      {/* Receipt modal — same component as retail */}
      <ReceiptModal
        isOpen={receiptData !== null}
        receiptData={receiptData}
        onClose={() => setReceiptData(null)}
      />
    </div>
  )
}
