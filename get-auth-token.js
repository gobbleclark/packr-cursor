const axios = require('axios');

async function getAuthToken() {
  try {
    // You'll need to replace these with actual credentials
    const response = await axios.post('http://localhost:4000/api/auth/login', {
      email: 'gavin@boxioship.com', // Replace with your email
      password: 'your-password-here' // Replace with your password
    });

    if (response.data.success) {
      console.log('🔑 Auth token:', response.data.token);
      console.log('\n📋 Use this token in the curl commands:');
      console.log(`\n# Sync for Mabe`);
      console.log(`curl -X POST "http://localhost:4000/api/brands/cmelv3utw0002jb3yhtrxscnq/integrations/trackstar/sync" \\`);
      console.log(`  -H "Authorization: Bearer ${response.data.token}" \\`);
      console.log(`  -H "Content-Type: application/json" \\`);
      console.log(`  -d '{"functions": ["get_inbound_shipments"]}'`);
      
      console.log(`\n# Sync for Clean Monday Meals`);
      console.log(`curl -X POST "http://localhost:4000/api/brands/cmensk9iu03a613vw6ymd1xzn/integrations/trackstar/sync" \\`);
      console.log(`  -H "Authorization: Bearer ${response.data.token}" \\`);
      console.log(`  -H "Content-Type: application/json" \\`);
      console.log(`  -d '{"functions": ["get_inbound_shipments"]}'`);
      
      return response.data.token;
    } else {
      console.error('❌ Login failed:', response.data.message);
    }
  } catch (error) {
    console.error('❌ Error getting auth token:', error.response?.data || error.message);
    console.log('\n💡 Alternative: Get token from browser:');
    console.log('1. Go to http://localhost:3000 (or 3001)');
    console.log('2. Log in');
    console.log('3. Open browser dev tools → Console');
    console.log('4. Run: localStorage.getItem("token")');
  }
}

getAuthToken();
