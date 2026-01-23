import { useDeviceType } from './useDeviceType';

const PAGINATION_THRESHOLDS = {
  MOBILE: 14,
  DESKTOP: 30,
} as const;

export function usePaginationThreshold(): number {
  const deviceType = useDeviceType();
  
  return deviceType === 'mobile' 
    ? PAGINATION_THRESHOLDS.MOBILE 
    : PAGINATION_THRESHOLDS.DESKTOP;
}
