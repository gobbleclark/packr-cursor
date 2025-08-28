// Central API configuration
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
export const API_URL = `${API_BASE}/api`;

// Helper function to build API URLs
export const buildApiUrl = (path: string) => {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${API_URL}/${cleanPath}`;
};
