interface MobileRedirectProps {
  children: React.ReactNode;
}

export function MobileRedirect({ children }: MobileRedirectProps) {
  // No longer redirecting to mobile - just render the desktop version optimized for mobile
  return <>{children}</>;
}