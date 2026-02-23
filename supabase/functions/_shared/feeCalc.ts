export interface GrossUpInput {
  courtAmountCents: number;
  platformFeeCents: number;
  stripePercent: number;
  stripeFixedCents: number;
}

export interface GrossUpResult {
  subtotalBeforeStripeCents: number;
  grossTotalCents: number;
  estimatedStripeFeeCents: number;
  serviceFeeCents: number;
  totalChargeCents: number;
}

export function calculateGrossUp(input: GrossUpInput): GrossUpResult {
  const { courtAmountCents, platformFeeCents, stripePercent, stripeFixedCents } = input;

  const subtotalBeforeStripeCents = courtAmountCents + platformFeeCents;
  const grossTotalCents = Math.ceil(
    (subtotalBeforeStripeCents + stripeFixedCents) / (1 - stripePercent)
  );
  const estimatedStripeFeeCents = grossTotalCents - subtotalBeforeStripeCents;
  const serviceFeeCents = platformFeeCents + estimatedStripeFeeCents;
  const totalChargeCents = courtAmountCents + serviceFeeCents;

  return {
    subtotalBeforeStripeCents,
    grossTotalCents,
    estimatedStripeFeeCents,
    serviceFeeCents,
    totalChargeCents,
  };
}
