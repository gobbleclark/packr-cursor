import { Router } from 'express';

const router = Router();

// Get Trackstar integration information including logos
router.get('/integrations/:integrationType', async (req, res) => {
  try {
    const { integrationType } = req.params;
    
    const trackstarApiKey = process.env.TRACKSTAR_API_KEY;
    if (!trackstarApiKey) {
      return res.status(500).json({ message: 'Trackstar API key not configured' });
    }

    console.log(`📋 Fetching ${integrationType} integrations from Trackstar...`);
    
    const response = await fetch(`https://production.trackstarhq.com/integrations/${integrationType}`, {
      method: 'GET',
      headers: {
        'x-trackstar-api-key': trackstarApiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed to fetch integrations: ${errorText}`);
      return res.status(response.status).json({ 
        message: 'Failed to fetch integrations',
        error: errorText 
      });
    }

    const data = await response.json();
    console.log(`✅ Retrieved ${data.data?.length || 0} ${integrationType} integrations`);
    
    res.json(data);
    
  } catch (error) {
    console.error(`❌ Error fetching integrations: ${(error as Error).message}`);
    res.status(500).json({
      message: 'Failed to fetch integrations',
      error: (error as Error).message
    });
  }
});

// Get specific integration information including logo
router.get('/integrations/:integrationType/:integrationName', async (req, res) => {
  try {
    const { integrationType, integrationName } = req.params;
    
    const trackstarApiKey = process.env.TRACKSTAR_API_KEY;
    if (!trackstarApiKey) {
      return res.status(500).json({ message: 'Trackstar API key not configured' });
    }

    console.log(`🏷️ Fetching ${integrationName} integration info from Trackstar...`);
    
    const response = await fetch(`https://production.trackstarhq.com/integrations/${integrationType}/${integrationName}`, {
      method: 'GET',
      headers: {
        'x-trackstar-api-key': trackstarApiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed to fetch integration ${integrationName}: ${errorText}`);
      return res.status(response.status).json({ 
        message: `Failed to fetch ${integrationName} integration`,
        error: errorText 
      });
    }

    const data = await response.json();
    console.log(`✅ Retrieved ${integrationName} integration:`, {
      display_name: data.data?.[0]?.display_name,
      logo_url: data.data?.[0]?.logo_url,
      available_actions: data.data?.[0]?.available_actions?.length
    });
    
    res.json(data);
    
  } catch (error) {
    console.error(`❌ Error fetching integration: ${(error as Error).message}`);
    res.status(500).json({
      message: 'Failed to fetch integration',
      error: (error as Error).message
    });
  }
});

export default router;