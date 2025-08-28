'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export type ModalType = 'view_order' | 'edit_address' | 'edit_carrier' | 'edit_items' | 'track_order';

interface ModalData {
  orderNumber?: string;
  orderId?: string;
  orderData?: any;
}

interface ModalContextType {
  activeModal: ModalType | null;
  modalData: ModalData | null;
  openModal: (type: ModalType, data?: ModalData) => void;
  closeModal: () => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [activeModal, setActiveModal] = useState<ModalType | null>(null);
  const [modalData, setModalData] = useState<ModalData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const openModal = (type: ModalType, data?: ModalData) => {
    setActiveModal(type);
    setModalData(data || null);
  };

  const closeModal = () => {
    setActiveModal(null);
    setModalData(null);
    setIsLoading(false);
  };

  return (
    <ModalContext.Provider value={{
      activeModal,
      modalData,
      openModal,
      closeModal,
      isLoading,
      setIsLoading
    }}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}
