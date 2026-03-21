'use client'

import { useState, useCallback } from 'react'
import { CustomerVehicleForm } from './CustomerVehicleForm'
import { OpenOrdersList } from './OpenOrdersList'
import { ServiceOrderPanel } from './ServiceOrderPanel'
import { ServicePaymentModal } from './ServicePaymentModal'
import { ServiceHistoryView } from './ServiceHistoryView'
import { ReceivablesView } from './ReceivablesView'

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

export function ServiceFlow() {
  const [activeTab, setActiveTab] = useState<TabId>('new-order')
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('select-customer')

  // View state for open-orders tab: list or detail
  const [openOrdersSelectedId, setOpenOrdersSelectedId] = useState<string | null>(null)

  // Payment modal state
  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean
    orderId: string
    orderTotal: number
    existingPaymentsTotal: number
  }>({ isOpen: false, orderId: '', orderTotal: 0, existingPaymentsTotal: 0 })

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

  const handlePaymentSuccess = useCallback(() => {
    setPaymentModal(prev => ({ ...prev, isOpen: false }))
    // The order panel will refresh via its own onOrderUpdated
  }, [])

  const handlePaymentClose = useCallback(() => {
    setPaymentModal(prev => ({ ...prev, isOpen: false }))
  }, [])

  // Noop for order update notifications (open orders list will refresh on next visit)
  const handleOrderUpdated = useCallback(() => {}, [])

  // Derive tab content based on activeTab and step
  const renderTabContent = () => {
    switch (activeTab) {
      case 'new-order':
        if (step === 'select-customer') {
          return <CustomerVehicleForm onOrderCreated={handleOrderCreated} />
        }
        // manage-order step — show ServiceOrderPanel for newly created order
        return activeOrderId ? (
          <ServiceOrderPanel
            orderId={activeOrderId}
            onBack={handleBackToCustomerForm}
            onOrderUpdated={handleOrderUpdated}
            onRequestPayment={handleRequestPayment}
          />
        ) : null

      case 'open-orders':
        // If an order is selected from the list, show its detail panel
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
        // Otherwise show the list
        return <OpenOrdersList onSelectOrder={handleOpenOrderSelect} />

      case 'history':
        return <ServiceHistoryView />
      case 'receivables':
        return <ReceivablesView />
    }
  }

  return (
    <div data-testid="service-flow" className="flex flex-col h-full bg-surface">
      {/* Tab bar */}
      <div className="flex items-center gap-1.5 px-4 py-3 shrink-0 overflow-x-auto no-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id)
              // Reset open-orders selection when switching tabs
              if (tab.id !== 'open-orders') {
                setOpenOrdersSelectedId(null)
              }
            }}
            className={`flex items-center rounded-[20px] py-[7px] px-4 shrink-0 transition-colors ${
              activeTab === tab.id
                ? 'bg-ink text-white'
                : 'bg-surface-raised border border-border text-ink hover:bg-surface-subtle'
            }`}
          >
            <span className="font-medium text-[13px] leading-4">{tab.label}</span>
          </button>
        ))}

        {/* Quick action: new order shortcut */}
        {activeTab !== 'new-order' || step !== 'select-customer' ? (
          <button
            onClick={handleNewOrder}
            className="ml-auto px-3 py-1.5 text-[13px] text-brand hover:text-brand-hover font-medium transition-colors shrink-0"
          >
            + Order Baru
          </button>
        ) : null}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {renderTabContent()}
      </div>

      {/* Payment modal — rendered at ServiceFlow level */}
      <ServicePaymentModal
        isOpen={paymentModal.isOpen}
        orderId={paymentModal.orderId}
        orderTotal={paymentModal.orderTotal}
        existingPaymentsTotal={paymentModal.existingPaymentsTotal}
        onSuccess={handlePaymentSuccess}
        onClose={handlePaymentClose}
      />
    </div>
  )
}
