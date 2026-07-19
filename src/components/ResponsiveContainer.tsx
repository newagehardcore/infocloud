import React, { useState, useEffect } from 'react';
import { detectDeviceCapabilities } from '../utils/performance';
import './ResponsiveContainer.css';

interface ResponsiveContainerProps {
  mobileComponent: React.ReactNode;
  desktopComponent: React.ReactNode;
  breakpoint?: number;
}

/**
 * A container component that renders different content based on screen size
 * This helps optimize the experience for different devices
 */
const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  mobileComponent,
  desktopComponent,
  breakpoint = 768
}) => {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkDevice = () => {
      const capabilities = detectDeviceCapabilities();
      setIsMobile(capabilities.screenWidth < breakpoint);
    };
    
    // Check on initial render
    checkDevice();
    
    // Add resize listener
    window.addEventListener('resize', checkDevice);
    
    return () => {
      window.removeEventListener('resize', checkDevice);
    };
  }, [breakpoint]);
  
  return (
    <div className="responsive-container">
      {isMobile ? mobileComponent : desktopComponent}
    </div>
  );
};

export default ResponsiveContainer;
