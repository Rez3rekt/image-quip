import { useState, useEffect } from 'react';

/**
 * A hook that detects if the current device is a mobile device
 * @returns {Object} Object containing isMobile boolean and device type info
 */
export default function useDeviceDetect() {
  const [deviceInfo, setDeviceInfo] = useState({
    isMobile: false,
    isTablet: false,
    isIOS: false,
    isAndroid: false,
    hasTouchScreen: false,
  });

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;

      // Check if mobile based on userAgent
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
        userAgent.toLowerCase(),
      );

      // More specific device checks
      const isIOS = /iphone|ipad|ipod/i.test(userAgent.toLowerCase());
      const isAndroid = /android/i.test(userAgent.toLowerCase());

      // Check for tablet - typical tablets are minimum 768px wide
      const isTablet = isMobileDevice && Math.min(window.innerWidth, window.innerHeight) > 767;

      // Check for touchscreen capability
      const hasTouchScreen =
        'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;

      setDeviceInfo({
        isMobile: isMobileDevice && !isTablet, // Phone but not tablet
        isTablet,
        isIOS,
        isAndroid,
        hasTouchScreen,
      });
    };

    // Initial check
    checkMobile();

    // Optional: Re-check on resize for orientation changes
    const handleResize = () => {
      checkMobile();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return deviceInfo;
}
