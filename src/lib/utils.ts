import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * @deprecated Fee calculations must happen on the backend only.
 * This function is retained temporarily for backward compatibility but returns 0.
 */
export function estimateServiceFee(_courtAmountDollars: number, _platformFeeDollars: number): number {
  return 0;
}
