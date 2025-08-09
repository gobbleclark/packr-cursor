/**
 * Decode the pagination token to understand how Trackstar pagination works
 * This will help us implement proper pagination to get ALL orders
 */

const nextToken = "eyJpZCI6ICJUM0prWlhJNk5qSTVOelk1TWpnNCIsICJjb25uZWN0aW9uX2lkIjogImUyMmU2YmM2MzhiZjRkNWY5MGQ0OWYxZWI3M2M2OWMzIn0=";

console.log('🔍 Decoding Trackstar pagination token...');

try {
  // Decode base64
  const decoded = Buffer.from(nextToken, 'base64').toString('utf-8');
  console.log('\n📊 Decoded token:', decoded);
  
  // Parse JSON if possible
  const tokenData = JSON.parse(decoded);
  console.log('\n🔍 Token structure:');
  Object.entries(tokenData).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
  });
  
  // Decode the ID if it's base64
  if (tokenData.id) {
    try {
      const decodedId = Buffer.from(tokenData.id, 'base64').toString('utf-8');
      console.log(`\n📋 Decoded ID: ${decodedId}`);
    } catch (e) {
      console.log(`\n📋 ID appears to be plain text: ${tokenData.id}`);
    }
  }
  
  console.log('\n💡 ANALYSIS:');
  console.log('This token contains:');
  console.log(`- Connection ID: ${tokenData.connection_id}`);
  console.log(`- Last record ID: ${tokenData.id}`);
  console.log('\nThis suggests Trackstar uses cursor-based pagination where:');
  console.log('- We need to send this token in headers, not query params');
  console.log('- Or use a different HTTP method (POST with body)'); 
  console.log('- Or use a different endpoint that accepts tokens');
  
} catch (error) {
  console.error('❌ Failed to decode token:', error.message);
}

console.log('\n🎯 NEXT STEPS:');
console.log('1. Test sending next_token in headers instead of query params');
console.log('2. Test POST request with token in body');
console.log('3. Test different endpoints that might accept tokens');
console.log('4. Check Trackstar API docs for correct pagination usage');