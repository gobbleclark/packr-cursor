import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface WMSLogoProps {
  integrationName: string;
  className?: string;
  showName?: boolean;
}

const WMS_LOGO_CACHE = new Map<string, string>();

const WMS_DISPLAY_NAMES: { [key: string]: string } = {
  'shiphero': 'ShipHero',
  'shipbob': 'ShipBob', 
  'fulfillmentworks': 'Fulfillment Works',
  'deliverr': 'Deliverr',
  'shipwire': 'Shipwire',
  'whiplash': 'Whiplash',
  'shipmonk': 'ShipMonk',
  'extensiv': 'Extensiv'
};

export function WMSProviderLogo({ integrationName, className = "w-6 h-6", showName = false }: WMSLogoProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogo = async () => {
      if (!integrationName) {
        setLoading(false);
        return;
      }

      // Check cache first
      if (WMS_LOGO_CACHE.has(integrationName)) {
        setLogoUrl(WMS_LOGO_CACHE.get(integrationName)!);
        setLoading(false);
        return;
      }

      try {
        const response = await apiRequest('GET', `/api/trackstar-info/integrations/wms/${integrationName.toLowerCase()}`);
        
        if (response.ok) {
          const data = await response.json();
          const logoUrl = data.data?.[0]?.logo_url;
          
          if (logoUrl) {
            WMS_LOGO_CACHE.set(integrationName, logoUrl);
            setLogoUrl(logoUrl);
          }
        }
      } catch (error) {
        console.log(`Could not fetch logo for ${integrationName}`);
      }
      
      setLoading(false);
    };

    fetchLogo();
  }, [integrationName]);

  const displayName = WMS_DISPLAY_NAMES[integrationName?.toLowerCase()] || integrationName;

  if (loading) {
    return (
      <div className={`${className} bg-gray-200 animate-pulse rounded flex items-center justify-center`}>
        <div className="w-3 h-3 bg-gray-400 rounded"></div>
      </div>
    );
  }

  if (logoUrl) {
    return (
      <div className="flex items-center gap-2">
        <img 
          src={logoUrl} 
          alt={`${displayName} logo`}
          className={`${className} object-contain`}
          onError={() => setLogoUrl(null)}
        />
        {showName && (
          <span className="text-sm font-medium">{displayName}</span>
        )}
      </div>
    );
  }

  // Fallback: Show text with colored background for known providers
  const getProviderColors = (provider: string) => {
    const colors: { [key: string]: { bg: string; text: string } } = {
      'shiphero': { bg: 'bg-blue-100', text: 'text-blue-800' },
      'shipbob': { bg: 'bg-purple-100', text: 'text-purple-800' },
      'fulfillmentworks': { bg: 'bg-green-100', text: 'text-green-800' },
      'shipmonk': { bg: 'bg-orange-100', text: 'text-orange-800' },
      'extensiv': { bg: 'bg-teal-100', text: 'text-teal-800' },
      'default': { bg: 'bg-gray-100', text: 'text-gray-800' }
    };
    
    return colors[provider.toLowerCase()] || colors.default;
  };

  const { bg, text } = getProviderColors(integrationName);

  return (
    <div className="flex items-center gap-2">
      <div className={`${className} ${bg} ${text} rounded flex items-center justify-center text-xs font-bold`}>
        {displayName.substring(0, 2).toUpperCase()}
      </div>
      {showName && (
        <span className="text-sm font-medium">{displayName}</span>
      )}
    </div>
  );
}