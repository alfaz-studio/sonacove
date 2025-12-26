import {
  PUBLIC_PADDLE_INDIVIDUAL_MONTHLY_PRICE_ID,
  PUBLIC_PADDLE_INDIVIDUAL_ANNUAL_PRICE_ID,
  PUBLIC_PADDLE_ORG_MONTHLY_SEAT_PRICE_ID,
  PUBLIC_PADDLE_ORG_ANNUAL_SEAT_PRICE_ID,
} from 'astro:env/client';

export type PlanType = 'individual' | 'org';
export type BillingInterval = 'month' | 'year';

/**
 * Resolves the Paddle price ID based on plan type and billing interval
 */
export function resolvePriceId(
  planType: PlanType,
  billingInterval: BillingInterval,
): string | undefined {
  if (planType === 'individual') {
    return billingInterval === 'month'
      ? PUBLIC_PADDLE_INDIVIDUAL_MONTHLY_PRICE_ID
      : PUBLIC_PADDLE_INDIVIDUAL_ANNUAL_PRICE_ID;
  }
  return billingInterval === 'month'
    ? PUBLIC_PADDLE_ORG_MONTHLY_SEAT_PRICE_ID
    : PUBLIC_PADDLE_ORG_ANNUAL_SEAT_PRICE_ID;
}

