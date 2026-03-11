import { useState, useEffect } from 'react';

const DEVICE_BREAKPOINT = 1024; // pixels
const DEBOUNCE_DELAY = 300; // milliseconds

export type DeviceType = 'mobile' | 'desktop';

export function useDeviceType(): DeviceType {
  const [deviceType, setDeviceType] = useState<DeviceType>(() => {
    return window.innerWidth < DEVICE_BREAKPOINT ? 'mobile' : 'desktop';
  });

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handleResize = () => {
      // Clear existing timeout
      clearTimeout(timeoutId);
      
      // Set new timeout for debouncing
      timeoutId = setTimeout(() => {
        const newDeviceType = window.innerWidth < DEVICE_BREAKPOINT ? 'mobile' : 'desktop';
        setDeviceType(newDeviceType);
      }, DEBOUNCE_DELAY);
    };

    window.addEventListener('resize', handleResize);
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return deviceType;
}
