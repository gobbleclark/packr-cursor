'use client';

import React from 'react';
import { ViewOrderModal } from './ViewOrderModal';
// Import other modals as we create them
// import { EditAddressModal } from './EditAddressModal';
// import { EditCarrierModal } from './EditCarrierModal';
// import { EditItemsModal } from './EditItemsModal';
// import { TrackOrderModal } from './TrackOrderModal';

/**
 * Central modal manager that renders all modals
 * Only the active modal will be displayed
 */
export function ModalManager() {
  return (
    <>
      <ViewOrderModal />
      {/* Add other modals here as we create them */}
      {/* <EditAddressModal />
      <EditCarrierModal />
      <EditItemsModal />
      <TrackOrderModal /> */}
    </>
  );
}
