'use client';

import React from 'react';
import { ViewOrderModal } from './ViewOrderModal';
import { ChatEditAddressModal } from './ChatEditAddressModal';
import { ChatEditCarrierModal } from './ChatEditCarrierModal';
import { ChatEditItemsModal } from './ChatEditItemsModal';
import { ChatTrackOrderModal } from './ChatTrackOrderModal';

/**
 * Central modal manager that renders all modals
 * Only the active modal will be displayed
 */
export function ModalManager() {
  return (
    <>
      <ViewOrderModal />
      <ChatEditAddressModal />
      <ChatEditCarrierModal />
      <ChatEditItemsModal />
      <ChatTrackOrderModal />
    </>
  );
}
