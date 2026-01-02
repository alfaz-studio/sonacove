import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { showPopup } from '../../utils/popupService';
import { initializePaddle, type Paddle, CheckoutEventNames, type PricePreviewResponse } from '@paddle/paddle-js';
import {
  PUBLIC_CF_ENV,
  PUBLIC_PADDLE_CLIENT_TOKEN,
} from 'astro:env/client';
import { resolvePriceId, type BillingInterval, type PlanType } from '@/utils/paddle';
import { floorPrice, applyDiscount } from '@/pages/landing/utils';
import { Button } from '../ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { ExternalLink, School, Smile, UsersRound, Loader2 } from 'lucide-react';

interface SubscriptionSummary {
  individualSubscription: {
    status: string;
    quantity: number;
    billingInterval: string | null;
    billingFrequency: number | null;
    nextBilledAt: string | null;
    subscriptionId: string;
  } | null;
  orgSubscription: {
    status: string;
    quantity: number;
    billingInterval: string | null;
    billingFrequency: number | null;
    seatsUsed: number | null;
    seatsTotal: number | null;
    seatsAvailable: number | null;
    subscriptionId: string;
  } | null;
}

type BillingCurrency = 'auto' | 'USD' | 'EUR' | 'INR' | 'TRY';

type DashboardPlanKey = 'free' | 'individual' | 'org';

const PlanView: React.FC = () => {
  const { getAccessToken, user } = useAuth();
  const [summary, setSummary] = useState<SubscriptionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('month');
  const [currency, setCurrency] = useState<BillingCurrency>('auto');
  const [seatQuantity, setSeatQuantity] = useState<number>(5);
  const [paddleError, setPaddleError] = useState<string | null>(null);
  const [pricePreview, setPricePreview] = useState<PricePreviewResponse | null>(null);
  const [isPriceLoading, setIsPriceLoading] = useState(false);
  const [seatUpdateLoading, setSeatUpdateLoading] = useState(false);
  const paddleRef = useRef<Paddle | undefined>(undefined);
  const [paddleReady, setPaddleReady] = useState(false);

  useEffect(() => {
    const loadSummary = async () => {
      const token = getAccessToken?.();
      if (!token) return;
      setIsLoading(true);
      try {
        const res = await fetch('/api/subscriptions/summary', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          throw new Error(await res.text());
        }
        const data = (await res.json()) as SubscriptionSummary;
        setSummary(data);
      } catch (e) {
        console.error(e);
        showPopup('Failed to load subscription details', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    loadSummary();
  }, [getAccessToken]);

  // Derive current active plan for highlighting
  const currentPlan: DashboardPlanKey = useMemo(() => {
    if (!summary) return 'free';
    if (summary.orgSubscription && summary.orgSubscription.status === 'active') {
      return 'org';
    }
    if (summary.individualSubscription && summary.individualSubscription.status === 'active') {
      return 'individual';
    }
    return 'free';
  }, [summary]);

  // Sync billing interval from active subscription
  useEffect(() => {
    if (!summary) return;
    
    // Check org subscription first (takes precedence)
    if (summary.orgSubscription && summary.orgSubscription.status === 'active' && summary.orgSubscription.billingInterval) {
      const interval = summary.orgSubscription.billingInterval.toLowerCase();
      if (interval === 'month' || interval === 'year') {
        setBillingInterval(interval as BillingInterval);
        return;
      }
    }
    
    // Check individual subscription
    if (summary.individualSubscription && summary.individualSubscription.status === 'active' && summary.individualSubscription.billingInterval) {
      const interval = summary.individualSubscription.billingInterval.toLowerCase();
      if (interval === 'month' || interval === 'year') {
        setBillingInterval(interval as BillingInterval);
        return;
      }
    }
  }, [summary]);

  // Initialize Paddle once
  useEffect(() => {
    if (paddleReady || paddleRef.current) return;

    const token = PUBLIC_PADDLE_CLIENT_TOKEN;
    if (!token) {
      setPaddleError('Paddle is not configured.');
      return;
    }

    const environment =
      (PUBLIC_CF_ENV as 'staging' | 'production') === 'production'
        ? 'production'
        : 'sandbox';

    initializePaddle({
      token,
      environment,
      eventCallback: (event) => {
        if (event.name === CheckoutEventNames.CHECKOUT_COMPLETED) {
          // Refresh subscription summary after successful checkout
          setTimeout(() => {
            void (async () => {
              const accessToken = getAccessToken?.();
              if (!accessToken) return;
              try {
                const res = await fetch('/api/subscriptions/summary', {
                  headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (res.ok) {
                  const data = (await res.json()) as SubscriptionSummary;
                  setSummary(data);
                }
              } catch (e) {
                console.error(e);
              }
            })();
          }, 0);
          showPopup('Your subscription has been updated.', 'success');
        }
        if (event.name === CheckoutEventNames.CHECKOUT_ERROR) {
          console.error('Paddle checkout error', event);
          showPopup('There was a problem with the payment process.', 'error');
        }
      },
    })
      .then((p) => {
        if (p) {
          paddleRef.current = p;
          setPaddleReady(true);
        }
      })
      .catch((err) => {
        console.error('Error initializing Paddle:', err);
        setPaddleError(
          err instanceof Error ? err.message : 'Failed to initialize billing.',
        );
      });
  }, [getAccessToken, paddleReady]);

  // Load initial seat quantity from org subscription if available
  useEffect(() => {
    if (summary?.orgSubscription?.seatsTotal && summary.orgSubscription.seatsTotal > 0) {
      setSeatQuantity(summary.orgSubscription.seatsTotal);
    }
  }, [summary]);

  // Fetch price preview when billing interval or currency changes
  useEffect(() => {
    if (!paddleReady || !paddleRef.current) return;

    const fetchPreview = async () => {
      try {
        setIsPriceLoading(true);
        setPaddleError(null);

        const items = [
          {
            priceId: resolvePriceId('individual', billingInterval),
            quantity: 1,
          },
          {
            priceId: resolvePriceId('org', billingInterval),
            quantity: 1,
          },
        ].filter((i) => i.priceId) as { priceId: string; quantity: number }[];

        if (!items.length) {
          throw new Error('Pricing configuration is missing.');
        }

        const preview = await paddleRef.current!.PricePreview({
          items,
          ...(currency !== 'auto' && { currencyCode: currency }),
        });
        setPricePreview(preview);
      } catch (err) {
        console.error('Error fetching price preview:', err);
        setPaddleError(
          err instanceof Error ? err.message : 'Failed to load pricing information.',
        );
      } finally {
        setIsPriceLoading(false);
      }
    };

    void fetchPreview();
  }, [billingInterval, currency, paddleReady]);

  const handleCheckout = async (plan: DashboardPlanKey) => {
    // If switching to free plan and user has an active subscription, open portal
    if (plan === 'free') {
      if (currentPlan !== 'free') {
        await openPortal();
        return;
      }
      showPopup('You are on the Free plan. Paid upgrades are available below.', 'info');
      return;
    }

    // For org plan with existing active subscription, update seats via API instead of checkout
    if (plan === 'org' && summary?.orgSubscription && summary.orgSubscription.status === 'active') {
      const token = getAccessToken?.();
      if (!token) {
        showPopup('You must be logged in to update your subscription', 'error');
        return;
      }

      const newQuantity = Math.max(1, seatQuantity);
      const currentQuantity = summary.orgSubscription.quantity;

      // Don't update if quantity hasn't changed
      if (newQuantity === currentQuantity) {
        showPopup('Seat quantity is already set to this value.', 'info');
        return;
      }

      setSeatUpdateLoading(true);
      try {
        const res = await fetch('/api/subscriptions/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            subscriptionId: summary.orgSubscription.subscriptionId,
            quantity: newQuantity,
            // Automatically choose proration mode: immediate for increases, next period for decreases
            prorationBillingMode: newQuantity > currentQuantity 
              ? 'prorated_immediately' 
              : 'prorated_next_billing_period',
          }),
        });

        if (!res.ok) {
          const errorData = (await res.json().catch(() => ({ error: 'Unknown error' }))) as {
            error?: string;
          };
          throw new Error(errorData.error || `Failed to update subscription: ${res.status}`);
        }

        // Refresh subscription summary
        const summaryRes = await fetch('/api/subscriptions/summary', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (summaryRes.ok) {
          const data = (await summaryRes.json()) as SubscriptionSummary;
          setSummary(data);
        }

        const change = newQuantity > currentQuantity ? 'increased' : 'decreased';
        showPopup(
          `Seats ${change} from ${currentQuantity} to ${newQuantity}. Your subscription has been updated.`,
          'success',
        );
      } catch (err) {
        console.error('Error updating subscription:', err);
        showPopup(
          err instanceof Error
            ? err.message
            : 'Failed to update subscription. Please try again.',
          'error',
        );
      } finally {
        setSeatUpdateLoading(false);
      }
      return;
    }

    // For new subscriptions or individual plan, use checkout
    if (!paddleRef.current) {
      showPopup('Billing is not ready yet. Please try again in a moment.', 'error');
      return;
    }

    const planType: PlanType = plan === 'org' ? 'org' : 'individual';
    const priceId = resolvePriceId(planType, billingInterval);
    if (!priceId) {
      showPopup('Pricing is not configured for this plan yet.', 'error');
      return;
    }

    const quantity = planType === 'org' ? Math.max(1, seatQuantity) : 1;

    try {
      await paddleRef.current.Checkout.open({
        items: [{ priceId, quantity }],
        ...(user?.profile?.email && {
          customer: {
            email: user.profile.email,
          },
        }),
        settings: {
          displayMode: 'overlay',
          theme: 'light',
          successUrl: `${window.location.origin}/dashboard?subscription=success`,
          // Try to skip to payment page if customer data is pre-filled
          ...(user?.profile?.email && {
            // Paddle will automatically skip to payment if customer email is provided
            // and matches an existing customer with saved payment methods
          }),
        },
      });
    } catch (err) {
      console.error('Error opening Paddle checkout:', err);
      showPopup(
        err instanceof Error
          ? err.message
          : 'The subscription service is currently unavailable.',
        'error',
      );
    }
  };

  const renderPrice = (
    plan: DashboardPlanKey,
  ): { main: string; withDiscount?: string; discountPercent?: number; monthlyEquivalent?: string } => {
    if (!pricePreview) {
      return { main: plan === 'free' ? '$0.00' : '—' };
    }

    const lineItems = pricePreview.data.details.lineItems;
    // lineItems[0] => individual, lineItems[1] => org based on items order
    if (plan === 'free') {
      const base = lineItems[0]?.formattedUnitTotals.total ?? '$0.00';
      const parsed = floorPrice(base);
      return {
        main: `${parsed.currencySymbol}0.00`,
        monthlyEquivalent: `${parsed.currencySymbol}0.00`,
      };
    }

    const idx = plan === 'individual' ? 0 : 1;
    const item = lineItems[idx];
    if (!item) return { main: '—' };

    const base = floorPrice(item.formattedUnitTotals.total);
    const discountPercent =
      Number(item.price.customData?.discount ?? 0) || 0;
    
    // Calculate monthly equivalent for annual plans
    let monthlyEquivalent: string | undefined;
    if (billingInterval === 'year') {
      const monthlyValue = base.numeric / 12;
      monthlyEquivalent = `${base.currencySymbol}${monthlyValue.toFixed(2)}`;
    } else {
      monthlyEquivalent = base.formatted;
    }
    
    if (discountPercent > 0) {
      const discounted = applyDiscount(base.numeric, discountPercent);
      const formattedDiscounted = `${base.currencySymbol}${discounted.toFixed(2)}`;
      // For annual with discount, calculate monthly equivalent from discounted price
      if (billingInterval === 'year') {
        monthlyEquivalent = `${base.currencySymbol}${(discounted / 12).toFixed(2)}`;
      } else {
        monthlyEquivalent = formattedDiscounted;
      }
      return {
        main: base.formatted,
        withDiscount: formattedDiscounted,
        discountPercent,
        monthlyEquivalent,
      };
    }

    return { main: base.formatted, monthlyEquivalent };
  };

  const openPortal = async () => {
    const token = getAccessToken?.();
    if (!token) {
      showPopup('You must be logged in to manage your plan', 'error');
      return;
    }
    setPortalLoading(true);
    try {
      const res = await fetch('/api/subscriptions/portal-link', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = (await res.json()) as { url?: string };
      if (data.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      } else {
        showPopup('No portal link available', 'error');
      }
    } catch (e) {
      console.error(e);
      showPopup('Failed to open billing portal', 'error');
    } finally {
      setPortalLoading(false);
    }
  };

  if (isLoading || !summary) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3" />
        <div className="h-24 bg-gray-200 rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Plan & Billing</h2>
          <p className="text-base text-muted-foreground">
            View your subscription details and manage billing in Paddle.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={openPortal}
          disabled={portalLoading}
        >
          {portalLoading ? 'Opening…' : 'Manage in Paddle'}
          <ExternalLink className="ml-2 h-4 w-4" />
        </Button>
      </div>

      {/* Current subscription overview */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Current subscription</CardTitle>
            <CardDescription>
              You are currently on the{' '}
              {currentPlan === 'free'
                ? 'Free'
                : currentPlan === 'individual'
                ? 'Individual'
                : 'Organization'}{' '}
              plan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-base text-muted-foreground">
            {summary.individualSubscription && (
              <>
                <p>
                  Individual status: {summary.individualSubscription.status}
                </p>
                {summary.individualSubscription.billingInterval && (
                  <p>
                    Billing interval: {summary.individualSubscription.billingInterval === 'month' ? 'Monthly' : summary.individualSubscription.billingInterval === 'year' ? 'Annual' : summary.individualSubscription.billingInterval}
                  </p>
                )}
              </>
            )}
            {summary.orgSubscription && (
              <>
                <p>Organization status: {summary.orgSubscription.status}</p>
                {summary.orgSubscription.billingInterval && (
                  <p>
                    Billing interval: {summary.orgSubscription.billingInterval === 'month' ? 'Monthly' : summary.orgSubscription.billingInterval === 'year' ? 'Annual' : summary.orgSubscription.billingInterval}
                  </p>
                )}
                {summary.orgSubscription.seatsTotal !== null && (
                  <p>
                    Seats: {summary.orgSubscription.seatsUsed ?? 0} /{' '}
                    {summary.orgSubscription.seatsTotal} (
                    {summary.orgSubscription.seatsAvailable ?? 0} available)
                  </p>
                )}
              </>
            )}
            {!summary.individualSubscription && !summary.orgSubscription && (
              <p>
                You don&apos;t have an active subscription yet. You are using the
                Free plan.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Controls: billing interval & currency */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base font-medium">Billing interval:</span>
          <div className="inline-flex rounded-md border bg-white p-1 text-sm">
            <button
              type="button"
              onClick={() => setBillingInterval('month')}
              className={`px-3 py-1 rounded-md ${
                billingInterval === 'month'
                  ? 'bg-primary text-white'
                  : 'text-muted-foreground hover:bg-gray-100'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingInterval('year')}
              className={`px-3 py-1 rounded-md ${
                billingInterval === 'year'
                  ? 'bg-primary text-white'
                  : 'text-muted-foreground hover:bg-gray-100'
              }`}
            >
              Annual
              <span className="ml-1 text-xs opacity-90">(15% less)</span>
            </button>
          </div>
        </div>

        <div className="w-full md:w-64">
          <label className="mb-1 block text-base font-medium">
            Currency
          </label>
          <Select
            value={currency}
            onValueChange={(value: BillingCurrency) => setCurrency(value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto (based on location)</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
              <SelectItem value="INR">INR</SelectItem>
              <SelectItem value="TRY">TRY</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {paddleError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {paddleError}
        </div>
      )}

      {/* Pricing grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Free plan */}
        <Card
          className={
            currentPlan === 'free'
              ? 'border-primary shadow-md ring-1 ring-primary/30'
              : ''
          }
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Smile className="h-5 w-5 text-primary" />
                Free plan
              </CardTitle>
              {currentPlan === 'free' && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Current
                </span>
              )}
            </div>
            <CardDescription>
              Get started with core meeting features at no cost.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-3xl font-semibold">
              {renderPrice('free').monthlyEquivalent ?? renderPrice('free').main}
              <span className="ml-1 text-base font-normal text-muted-foreground">
                /month
              </span>
            </div>
            <ul className="space-y-2 text-base text-muted-foreground">
              <li>Up to 1000 total meeting minutes</li>
              <li>Up to 100 guests per meeting</li>
              <li>End-to-end encryption</li>
              <li>Screen sharing</li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleCheckout('free')}
              disabled={currentPlan === 'free' || isPriceLoading || !!paddleError || !paddleReady}
            >
              {currentPlan === 'free' ? "You're on the Free plan" : 'Switch to Free plan'}
            </Button>
          </CardFooter>
        </Card>

        {/* Individual plan */}
        <Card
          className={
            currentPlan === 'individual'
              ? 'border-primary shadow-md ring-1 ring-primary/30'
              : ''
          }
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <UsersRound className="h-5 w-5 text-primary" />
                Individual plan
              </CardTitle>
              {currentPlan === 'individual' && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Current
                </span>
              )}
            </div>
            <CardDescription>
              For educators and professionals who need more flexibility.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <div className="text-3xl font-semibold">
                {isPriceLoading ? '…' : renderPrice('individual').monthlyEquivalent ?? (renderPrice('individual').withDiscount ?? renderPrice('individual').main)}
                <span className="ml-1 text-base font-normal text-muted-foreground">
                  /month
                </span>
              </div>
              {!isPriceLoading && renderPrice('individual').withDiscount && (
                <div className="text-sm text-muted-foreground">
                  <span className="line-through mr-1">
                    {renderPrice('individual').main}
                  </span>
                  <span className="font-medium text-green-700">
                    Save {Math.round((renderPrice('individual').discountPercent ?? 0) * 100)}%
                  </span>
                </div>
              )}
            </div>
            <ul className="space-y-2 text-base text-muted-foreground">
              <li>Unlimited meeting duration</li>
              <li>Up to 100 guests per meeting</li>
              <li>End-to-end encryption</li>
              <li>Screen sharing & live recording</li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              onClick={() => handleCheckout('individual')}
              disabled={(currentPlan === 'individual') || isPriceLoading || !!paddleError || !paddleReady}
            >
              {isPriceLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {currentPlan === 'free' ? 'Upgrade to Individual' : currentPlan === 'individual' ? "You're on the Individual plan" : 'Switch to Individual plan'}
            </Button>
          </CardFooter>
        </Card>

        {/* Organization plan */}
        <Card
          className={
            currentPlan === 'org'
              ? 'border-primary shadow-md ring-1 ring-primary/30'
              : ''
          }
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <School className="h-5 w-5 text-primary" />
                Organization plan
              </CardTitle>
              {currentPlan === 'org' && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Current
                </span>
              )}
            </div>
            <CardDescription>
              For schools and teams. Billing is per seat, paid by the org owner.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <div className="text-3xl font-semibold">
                {isPriceLoading ? '…' : renderPrice('org').monthlyEquivalent ?? (renderPrice('org').withDiscount ?? renderPrice('org').main)}
                <span className="ml-1 text-base font-normal text-muted-foreground">
                  /seat/month
                </span>
              </div>
              {!isPriceLoading && renderPrice('org').withDiscount && (
                <div className="text-sm text-muted-foreground">
                  <span className="line-through mr-1">
                    {renderPrice('org').main}
                  </span>
                  <span className="font-medium text-green-700">
                    Save {Math.round((renderPrice('org').discountPercent ?? 0) * 100)}%
                  </span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <label className="block text-base font-medium">
                Number of seats
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={seatQuantity}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  setSeatQuantity(Number.isNaN(value) ? 1 : Math.max(1, value));
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <p className="text-sm text-muted-foreground">
                Each seat gives one team member access. Billing is handled by the
                organization owner.
              </p>
            </div>
            <ul className="space-y-2 text-base text-muted-foreground">
              <li>All Individual features</li>
              <li>Up to 1000 guests per meeting</li>
              <li>Custom authentication & org management</li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              onClick={() => handleCheckout('org')}
              disabled={
                seatUpdateLoading ||
                (currentPlan === 'org' && summary?.orgSubscription?.status === 'active'
                  ? false // For existing org subscriptions, only disable if updating
                  : isPriceLoading || !!paddleError || !paddleReady) // For new subscriptions, need Paddle ready
              }
            >
              {(isPriceLoading || seatUpdateLoading) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {currentPlan === 'org'
                ? seatUpdateLoading
                  ? 'Updating seats...'
                  : 'Update Seats'
                : 'Upgrade to Organization'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default PlanView;


