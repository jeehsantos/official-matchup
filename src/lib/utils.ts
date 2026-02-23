import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Estimate the total service fee (platform fee + Stripe processing fee)
 * using the same gross-up formula as the backend.
 * This is for display purposes only — the backend is authoritative.
 */
export function estimateServiceFee(courtAmountDollars: number, platformFeeDollars: number): number {
  const STRIPE_PERCENT = 0.029;
  const STRIPE_FIXED = 0.30;

  const subtotal = courtAmountDollars + platformFeeDollars;
  if (subtotal <= 0) return 0;

  const grossTotal = (subtotal + STRIPE_FIXED) / (1 - STRIPE_PERCENT);
  const serviceFee = grossTotal - courtAmountDollars;

  return Math.ceil(serviceFee * 100) / 100; // round up to nearest cent
}
