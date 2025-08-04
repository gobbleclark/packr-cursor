/**
 * Debug script to fetch and analyze specific ShipHero order 650411765
 * that should be on hold but isn't showing in our dashboard
 */

const brandCredentials = {
  'dce4813e-aeb7-41fe-bb00-a36e314288f3': { // Mabē brand ID
    username: 'gavin+mabe@boxioship.com',
    password: 'Packr1234!'
  }
};

async function getShipHeroToken(username, password) {
  const response = await fetch('https://public-api.shiphero.com/auth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username,
      password,
      grant_type: 'client_credentials'
    })
  });

  if (!response.ok) {
    throw new Error(`Token request failed: ${response.status}`);
  }

  return await response.json();
}

async function fetchSpecificOrder(accessToken, legacyId) {
  const query = `
    query getOrder($legacyId: String!) {
      order(legacy_id: $legacyId) {
        id
        legacy_id
        order_number
        shop_name
        order_date
        fulfillment_status
        subtotal
        total_price
        total_tax
        total_shipping
        total_discounts
        email
        profile
        hold_until_date
        required_ship_date
        priority_flag
        tags
        shipping_address {
          first_name
          last_name
          address1
          address2
          city
          state
          country
          zip
          phone
        }
        line_items {
          edges {
            node {
              id
              sku
              title
              quantity
              quantity_allocated
              quantity_shipped
              backorder_quantity
              price
              fulfillment_status
            }
          }
        }
      }
    }
  `;

  const response = await fetch('https://public-api.shiphero.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables: { legacyId: legacyId.toString() }
    })
  });

  return await response.json();
}

async function debugSpecificOrder() {
  try {
    console.log('🔍 Debugging ShipHero order 650411765...');
    
    const credentials = brandCredentials['dce4813e-aeb7-41fe-bb00-a36e314288f3'];
    const tokenResponse = await getShipHeroToken(credentials.username, credentials.password);
    
    console.log('✅ Got ShipHero token');
    
    const orderResponse = await fetchSpecificOrder(tokenResponse.access_token, 650411765);
    
    if (orderResponse.errors) {
      console.error('❌ GraphQL errors:', orderResponse.errors);
      return;
    }
    
    const order = orderResponse.data?.order;
    
    if (!order) {
      console.log('❌ Order 650411765 not found in ShipHero');
      return;
    }
    
    console.log('\n📦 ORDER DETAILS:');
    console.log('ID:', order.id);
    console.log('Legacy ID:', order.legacy_id);
    console.log('Order Number:', order.order_number);
    console.log('Fulfillment Status:', order.fulfillment_status);
    console.log('Hold Until Date:', order.hold_until_date);
    console.log('Priority Flag:', order.priority_flag);
    console.log('Tags:', order.tags);
    console.log('Order Date:', order.order_date);
    
    console.log('\n🔍 HOLD ANALYSIS:');
    console.log('Has hold_until_date:', order.hold_until_date ? 'YES' : 'NO');
    console.log('Fulfillment status indicates hold:', order.fulfillment_status?.includes('hold') ? 'YES' : 'NO');
    console.log('Priority flag set:', order.priority_flag ? 'YES' : 'NO');
    console.log('Hold-related tags:', order.tags?.filter(tag => tag.toLowerCase().includes('hold')) || []);
    
    // Check if this order should be considered "on hold"
    const isOnHold = order.hold_until_date || 
                     order.fulfillment_status?.toLowerCase().includes('hold') ||
                     order.tags?.some(tag => tag.toLowerCase().includes('hold'));
                     
    console.log('\n🎯 CONCLUSION:');
    console.log('Should be on hold:', isOnHold ? 'YES' : 'NO');
    console.log('Current fulfillment status:', order.fulfillment_status);
    
    if (isOnHold) {
      console.log('\n⚠️ This order should appear in "Orders on Hold" section of dashboard');
      console.log('Reason: Hold condition detected');
    } else {
      console.log('\n✅ This order does not have hold conditions');
    }
    
  } catch (error) {
    console.error('❌ Error debugging order:', error);
  }
}

// Run the debug
debugSpecificOrder();