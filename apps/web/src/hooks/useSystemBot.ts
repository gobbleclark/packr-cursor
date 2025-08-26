import { useState, useCallback, useEffect } from 'react';
import { parseMessage, generateSystemResponse } from '../lib/message-parser';
import { orderService } from '../lib/order-service';

interface SystemBotResponse {
  id: string;
  messageId: string; // ID of the message this bot response is tied to
  messageContent?: string; // Content of the triggering message for matching
  message: string;
  actionCards: Array<{
    action: string;
    label: string;
    icon: string;
    primary?: boolean;
    disabled?: boolean;
    disabledReason?: string;
  }>;
  orderNumber?: string;
  customerName?: string;
  threeplName?: string;
  timestamp: Date;
  loading?: boolean; // For when we're fetching order status
}

export function useSystemBot() {
  const [botResponses, setBotResponses] = useState<SystemBotResponse[]>(() => {
    // Load bot responses from localStorage on initialization
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('systemBotResponses');
        if (saved) {
          const parsed = JSON.parse(saved);
          // Filter out responses older than 24 hours
          const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
          return parsed.filter((response: SystemBotResponse) => 
            new Date(response.timestamp).getTime() > oneDayAgo
          );
        }
      } catch (error) {
        console.error('Error loading bot responses from localStorage:', error);
      }
    }
    return [];
  });

  // Save bot responses to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined' && botResponses.length > 0) {
      try {
        localStorage.setItem('systemBotResponses', JSON.stringify(botResponses));
      } catch (error) {
        console.error('Error saving bot responses to localStorage:', error);
      }
    }
  }, [botResponses]);

  const processMessage = useCallback(async (content: string, messageId: string, currentUser?: any, room?: any) => {
    console.log('🤖 Processing message:', content, 'messageId:', messageId);
    
    // Parse the message for entities
    const parsedMessage = parseMessage(content);
    console.log('📝 Parsed message:', parsedMessage);
    
    // Generate system response if needed
    const systemResponse = generateSystemResponse(parsedMessage);
    console.log('🎯 System response:', systemResponse);
    
    if (systemResponse.shouldRespond && systemResponse.orderNumber) {
      const botResponseId = `bot_${messageId}_${Date.now()}`;
      
      // Get 3PL name from current user or room
      const threeplName = currentUser?.companyName || room?.threeplName || 'Support';
      
      // Create initial bot response with loading state
      const initialBotResponse: SystemBotResponse = {
        id: botResponseId,
        messageId,
        messageContent: content, // Store the triggering message content
        message: systemResponse.response,
        actionCards: systemResponse.actionCards,
        orderNumber: systemResponse.orderNumber,
        threeplName,
        timestamp: new Date(),
        loading: true
      };
      
      setBotResponses(prev => [...prev, initialBotResponse]);
      
      // Fetch contextual actions based on order status
      try {
        const contextualActions = await orderService.getContextualActions(
          systemResponse.orderNumber,
          systemResponse.actionCards
        );
        
        // Get order status for customer name and updated message
        const orderStatus = await orderService.getOrderStatus(systemResponse.orderNumber);
        console.log('📦 Order status:', orderStatus);
        
        // Create updated message with customer name if available
        const updatedMessage = orderStatus?.customerName 
          ? `I can help you with order #${systemResponse.orderNumber} for ${orderStatus.customerName}! What would you like to do?`
          : `I can help you with order #${systemResponse.orderNumber}! What would you like to do?`;
        
        // Update bot response with contextual actions and customer info
        setBotResponses(prev => prev.map(response => 
          response.id === botResponseId 
            ? { 
                ...response, 
                message: updatedMessage,
                actionCards: contextualActions, 
                customerName: orderStatus?.customerName,
                loading: false 
              }
            : response
        ));
      } catch (error) {
        console.error('Error fetching contextual actions:', error);
        // Remove loading state even if there's an error
        setBotResponses(prev => prev.map(response => 
          response.id === botResponseId 
            ? { ...response, loading: false }
            : response
        ));
      }
      
      return initialBotResponse;
    }
    
    return null;
  }, []);

  const dismissBotResponse = useCallback((botResponseId: string) => {
    setBotResponses(prev => {
      const updated = prev.filter(response => response.id !== botResponseId);
      // Update localStorage immediately when dismissing
      if (typeof window !== 'undefined') {
        try {
          if (updated.length === 0) {
            localStorage.removeItem('systemBotResponses');
          } else {
            localStorage.setItem('systemBotResponses', JSON.stringify(updated));
          }
        } catch (error) {
          console.error('Error updating localStorage after dismiss:', error);
        }
      }
      return updated;
    });
  }, []);

  const clearAllBotResponses = useCallback(() => {
    setBotResponses([]);
    // Clear localStorage when clearing all responses
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('systemBotResponses');
      } catch (error) {
        console.error('Error clearing localStorage:', error);
      }
    }
  }, []);

  const handleBotAction = useCallback((action: string, orderNumber?: string) => {
    console.log('Bot action triggered:', { action, orderNumber });
    
    // Here we'll implement the actual action handling
    switch (action) {
      case 'view_order':
        // Navigate to order details or show order modal
        console.log(`Viewing order ${orderNumber}`);
        // TODO: Navigate to order detail page or open modal
        break;
        
      case 'edit_address':
        // Show address update modal
        console.log(`Editing shipping address for order ${orderNumber}`);
        // TODO: Open address edit modal
        break;
        
      case 'edit_carrier':
        // Show carrier selection modal
        console.log(`Editing shipping carrier for order ${orderNumber}`);
        // TODO: Open carrier selection modal
        break;
        
      case 'track_order':
        // Show tracking information
        console.log(`Tracking order ${orderNumber}`);
        // TODO: Open tracking modal or navigate to tracking page
        break;
        
      case 'edit_items':
        // Show item modification interface
        console.log(`Editing line items for order ${orderNumber}`);
        // TODO: Open line items edit modal
        break;
        
      default:
        console.log(`Unknown action: ${action}`);
    }
  }, []);

  // Function to update temp bot responses with real message IDs
  const updateBotResponseMessageIds = useCallback((messages: any[]) => {
    setBotResponses(prev => {
      let updated = false;
      const newResponses = prev.map(response => {
        if (response.messageId.startsWith('temp_') && response.messageContent) {
          // Find a message that matches the content and was sent around the same time
          const matchingMessage = messages.find(msg => 
            msg.content === response.messageContent &&
            Math.abs(new Date(msg.createdAt).getTime() - new Date(response.timestamp).getTime()) < 30000 // 30 seconds
          );
          
          if (matchingMessage) {
            updated = true;
            return { ...response, messageId: matchingMessage.id };
          }
        }
        return response;
      });
      
      // Update localStorage if we made changes
      if (updated && typeof window !== 'undefined') {
        try {
          localStorage.setItem('systemBotResponses', JSON.stringify(newResponses));
        } catch (error) {
          console.error('Error updating localStorage with real message IDs:', error);
        }
      }
      
      return updated ? newResponses : prev;
    });
  }, []);

  return {
    botResponses,
    processMessage,
    dismissBotResponse,
    clearAllBotResponses,
    handleBotAction,
    updateBotResponseMessageIds
  };
}
