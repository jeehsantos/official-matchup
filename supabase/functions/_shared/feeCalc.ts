export interface GrossUpInput {
  courtAmountCents: number;
  platformFeeCents: number;
  stripePercent: number;
  stripeFixedCents: number;
}

export interface GrossUpResult {
  /** recipientCents + platformFeeCents before Stripe gross-up */
  subtotalBeforeStripeCents: number;
  /** Total after gross-up: ceil((subtotal + stripeFixed) / (1 - stripePercent)) */
  grossTotalCents: number;
  /** serviceFeeTotalCents = grossTotalCents - courtAmountCents */
  serviceFeeTotalCents: number;
  /** stripeFeeCoverageCents = serviceFeeTotalCents - platformFeeCents */
  stripeFeeCoverageCents: number;
  /** Alias for grossTotalCents (what customer is charged) */
  totalChargeCents: number;

  // Legacy aliases kept for backward compat
  estimatedStripeFeeCents: number;
  serviceFeeCents: number;
}

/**
 * Gross-up formula (all integer cents, always rounds UP):
 *
 * T = ceil( (recipientCents + platformFeeCents + stripeFixedCents) / (1 − stripePercent) )
 *
 * serviceFeeTotalCents = T − recipientCents
 * stripeFeeCoverageCents = serviceFeeTotalCents − platformFeeCents
 */
export function calculateGrossUp(input: GrossUpInput): GrossUpResult {
  const { courtAmountCents, platformFeeCents, stripePercent, stripeFixedCents } = input;

  const subtotalBeforeStripeCents = courtAmountCents + platformFeeCents;
  const grossTotalCents = Math.ceil(
    (subtotalBeforeStripeCents + stripeFixedCents) / (1 - stripePercent)
  );

  const serviceFeeTotalCents = grossTotalCents - courtAmountCents;
  const stripeFeeCoverageCents = serviceFeeTotalCents - platformFeeCents;
  const totalChargeCents = grossTotalCents; // same value, explicit alias

  return {
    subtotalBeforeStripeCents,
    grossTotalCents,
    serviceFeeTotalCents,
    stripeFeeCoverageCents,
    totalChargeCents,

    // Legacy aliases
    estimatedStripeFeeCents: stripeFeeCoverageCents,
    serviceFeeCents: serviceFeeTotalCents,
  };
}
