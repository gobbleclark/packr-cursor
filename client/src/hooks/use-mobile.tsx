import { useState, useEffect } from 'react';

export function useMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      // Check screen size
      const screenMobile = window.innerWidth < 768;
      
      // Check user agent for mobile devices
      const userAgentMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
      
      // Check for touch capability
      const touchMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      setIsMobile(screenMobile || (userAgentMobile && touchMobile));
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return { isMobile };
}