import React, { useEffect, useState } from 'react';
import { initializePaddle } from '@paddle/paddle-js';
import { applyDiscount, floorPrice } from '../utils';
import type { Plan } from '../types';

import { School, Smile, UsersRound } from 'lucide-react';
import SectionHeader from '../../../components/SectionHeader';
import ToggleSwitch from '../../../components/ToggleSwitch';
import PricingCard from './PricingCard';

import {
  PUBLIC_CF_ENV,
  PUBLIC_PADDLE_CLIENT_TOKEN,
  PUBLIC_PADDLE_INDIVIDUAL_MONTHLY_PRICE_ID,
  PUBLIC_PADDLE_INDIVIDUAL_ANNUAL_PRICE_ID,
  PUBLIC_PADDLE_ORG_MONTHLY_SEAT_PRICE_ID,
  PUBLIC_PADDLE_ORG_ANNUAL_SEAT_PRICE_ID,
} from 'astro:env/client';

// initial static plan data
const initialPlans: Plan[] = [
  {
    title: 'Free Plan',
    price: '$0.0',
    billingInfo: 'Per user/month, billed annually',
    icon: <Smile />,
    features: [
      'Up to 1000 total meeting minutes',
      'Up to 100 guests per meeting',
      'End-to-end encryption',
      'Screen sharing',
      'Live Recording',
      'Breakout rooms',
    ],
    highlighted: false,
    button: { text: 'Try It Free', link: '/onboarding' },
  },
  {
    title: 'Premium Plan',
    price: '$10.0',
    billingInfo: 'Per user/month, billed annually',
    icon: <UsersRound />,
    features: [
      'Unlimited meeting duration',
      'Up to 100 guests per meeting',
      'End-to-end encryption',
      'Screen sharing',
      'Live Recording',
      'Breakout rooms',
    ],
    highlighted: true,
    button: { text: 'Try It Free', link: '/onboarding' },
  },
  {
    title: 'Organization Plan',
    price: '$20.0',
    billingInfo: 'Per user/month, billed annually',
    icon: <School />,
    features: [
      'All Premium features',
      'Up to 1000 guests',
      'Custom Authentication',
    ],
    highlighted: false,
    button: { text: 'Contact Us', link: 'mailto:support@sonacove.com' },
  },
];

export default function PricingSection() {
  const [plans, setPlans] = useState(initialPlans);
  const [billingCycle, setBillingCycle] = useState('Monthly billing');

  const billingOptions = [
    { 
      label: 'Monthly', 
      value: 'Monthly billing' 
    },
    { 
      label: 'Annual', 
      value: 'Annual billing', 
      badge: '15% less'
    },
  ];

  useEffect(() => {
    async function initPaddle() {
      try {
        const environment =
            (PUBLIC_CF_ENV as 'staging' | 'production') === 'production' ? 'production' : 'sandbox';
        const clientToken = PUBLIC_PADDLE_CLIENT_TOKEN;
        if (!clientToken) return console.error('Missing Paddle client token');

        const paddle = await initializePaddle({
          environment,
          token: clientToken,
        });

        if (!paddle) {
          console.error("Failed to initialize Paddle. Check your token or network.");
          return;
        }

        const result = await paddle.PricePreview({
          items: [
            { priceId: billingCycle === 'Monthly billing' ? PUBLIC_PADDLE_INDIVIDUAL_MONTHLY_PRICE_ID : PUBLIC_PADDLE_INDIVIDUAL_ANNUAL_PRICE_ID, quantity: 1 },
            { priceId: billingCycle === 'Monthly billing' ? PUBLIC_PADDLE_ORG_MONTHLY_SEAT_PRICE_ID : PUBLIC_PADDLE_ORG_ANNUAL_SEAT_PRICE_ID, quantity: 1 },
          ],
        });

        const prices = result.data.details.lineItems;
        const premiumData = floorPrice(prices[0].formattedUnitTotals.total);
        const orgData = floorPrice(prices[1].formattedUnitTotals.total);
        const freeData = {
          numeric: 0,
          currencySymbol: premiumData.currencySymbol,
          formatted: `${premiumData.currencySymbol}0`,
        };

        const premiumDiscount =
          Number(prices[0].price.customData?.discount) || 0;
        const orgDiscount = Number(prices[1].price.customData?.discount) || 0;

        const premiumDiscounted = applyDiscount(
          premiumData.numeric,
          premiumDiscount,
        );
        const orgDiscounted = applyDiscount(orgData.numeric, orgDiscount);

        const premiumDiscountedFormatted = `${
          premiumData.currencySymbol
        }${premiumDiscounted.toFixed(2)}`;
        const orgDiscountedFormatted = `${
          orgData.currencySymbol
        }${orgDiscounted.toFixed(2)}`;

        // update state with new prices
        setPlans((prev) =>
          prev.map((plan) => {
            if (plan.title === 'Free Plan') {
              return { ...plan, price: freeData.formatted };
            }
            if (plan.title === 'Premium Plan') {
              return {
                ...plan,
                price: premiumData.formatted,
                discount: premiumDiscount,
                priceWithDiscount:
                  premiumDiscount > 0 ? premiumDiscountedFormatted : null,
              };
            }
            if (plan.title === 'Organization Plan') {
              return {
                ...plan,
                price: orgData.formatted,
                discount: orgDiscount,
                priceWithDiscount:
                  orgDiscount > 0 ? orgDiscountedFormatted : null,
              };
            }
            return plan;
          }),
        );
      } catch (err) {
        console.error('Error initializing Paddle or fetching prices:', err);
      }
    }

    initPaddle();
  }, [ billingCycle ]);

    return (
      <section className='py-20 md:py-28 bg-[#F9FAFB]' id='pricing'>
        <div className='container mx-auto px-4'>
          {/* Section Header */}
          <div className='text-center max-w-4xl mx-auto'>
            <SectionHeader tagline='Pricing' className='mb-8'>
              Plans designed for educators
            </SectionHeader>

            <ToggleSwitch
              options={billingOptions}
              activeOption={billingCycle}
              onOptionChange={setBillingCycle}
            />
          </div>

          <div className='mt-16 w-full mx-auto lg:max-w-7xl lg:grid lg:grid-cols-3 lg:gap-8 lg:items-stretch'>
            {plans.map((plan) => (
              <PricingCard key={plan.title} plan={plan} />
            ))}
          </div>
        </div>
      </section>
    );
}
