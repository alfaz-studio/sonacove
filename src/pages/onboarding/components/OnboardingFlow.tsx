import React, { useState, useEffect, useRef } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import { initializePaddle, type Paddle } from '@paddle/paddle-js';

import { getAuthService } from '../../../utils/AuthService';
import { useAuth } from '../../../hooks/useAuth';

import {
  PUBLIC_CF_ENV,
  PUBLIC_PADDLE_CLIENT_TOKEN,
  PUBLIC_PADDLE_PRICE_ID,
} from 'astro:env/client';

import Header from '../../../components/Header';
import OnboardingInitialView from './OnboardingInitialView';
import OnboardingSuccessView from './OnboardingSuccessView';
import OnboardingErrorView from './OnboardingErrorView';

const OnboardingFlow: React.FC = () => {
  const authService = getAuthService()

  const { isLoggedIn, user, login, isAuthReady} = useAuth();
  const [currentView, setCurrentView] = useState<'initial' | 'success' | 'error'>('initial');

  const [discountCode, setDiscountCode] = useState('');
  const [userFriendlyError, setUserFriendlyError] = useState('We encountered an unexpected issue.');
  const [detailedErrorMessage, setDetailedErrorMessage] = useState<string | null>(null);

  const paddle = useRef<Paddle | undefined>(undefined);

  const handleError = (userMessage: string, errorObj: any = null) => {
    console.error('User-facing error triggered:', userMessage, errorObj || '');
    setUserFriendlyError(userMessage || 'An unexpected error occurred.');
    if (errorObj) {
      if (errorObj instanceof Error)
        setDetailedErrorMessage(`${errorObj.name}: ${errorObj.message}`);
      else if (typeof errorObj === 'string') setDetailedErrorMessage(errorObj);
      else if (errorObj.message) setDetailedErrorMessage(errorObj.message);
      else
        setDetailedErrorMessage(
          'Additional error information has been logged to the console.',
        );
    } else {
      setDetailedErrorMessage(null);
    }
    setCurrentView('error');
  };

  const setupPaddleCheckout = async () => {
    try {
      if (!paddle.current) {
        const environment =
            (PUBLIC_CF_ENV as 'staging' | 'production') === 'production' ? 'production' : 'sandbox';
        const clientToken = PUBLIC_PADDLE_CLIENT_TOKEN;
        if (!clientToken)
          throw new Error('Paddle client token is not configured');

        paddle.current = await initializePaddle({
          environment,
          token: clientToken,
          eventCallback: (data) => {
            if (data.name === 'checkout.completed') {
              window.location.href = '/dashboard?subscription=success';
            } else if (data.name === 'checkout.error') {
              handleError(
                'There was a problem with the payment process.',
                data.error,
              );
            }
          },
        });
      }
    } catch (error) {
      console.error('Error setting up Paddle checkout:', error);
      throw error;
    }
  };

  const openPaddleCheckout = async () => {
    try {
      if (!paddle.current) await setupPaddleCheckout();
      await paddle.current?.Checkout.open({
        items: [{ priceId: PUBLIC_PADDLE_PRICE_ID, quantity: 1 }],
        ...(discountCode && { discountCode }),
        settings: { displayMode: 'overlay' },
        ...(user?.profile.email && { customer: { email: user.profile.email } }),
      });
    } catch (error) {
      handleError('The subscription service is currently unavailable.', error);
    }
  };

  // --- LIFECYCLE ---
  useEffect(() => {
    if (!isAuthReady) return;

    if (isLoggedIn) {
      setCurrentView('success');
      setupPaddleCheckout().catch((error) => {
        handleError('Could not initialize the subscription service.', error);
      });
    } else {
      setCurrentView('initial');
    }
  }, [isAuthReady, isLoggedIn]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const discountFromQuery = urlParams.get('discount');
    if (discountFromQuery) setDiscountCode(discountFromQuery);
  }, []);

  const renderCurrentView = () => {
    if (!isAuthReady) {
      return (
        <div className='animate-pulse space-y-4'>
          <div className='h-6 bg-gray-200 rounded w-1/2 mx-auto'></div>
          <div className='h-4 bg-gray-200 rounded w-3/4 mx-auto'></div>
          <div className='h-10 bg-gray-200 rounded'></div>
          <div className='h-10 bg-gray-200 rounded'></div>
        </div>
      );
    }

    switch (currentView) {
      case 'success':
        return (
          user && (
            <OnboardingSuccessView user={user} onOpenCheckout={openPaddleCheckout} />
          )
        );
      case 'error':
        return (
          <OnboardingErrorView
            userFriendlyError={userFriendlyError}
            detailedErrorMessage={detailedErrorMessage}
            onTryAgain={() => setCurrentView('initial')}
          />
        );
      case 'initial':
      default:
        return <OnboardingInitialView onLogin={login} onSignup={() => authService.signup()} />;
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <Header pageType='landing' />

      <div className='container mx-auto px-4 py-12'>
        <div className='max-w-lg mx-auto bg-white rounded-2xl shadow-lg border border-gray-200 p-8 md:p-12'>
          {renderCurrentView()}
        </div>
      </div>
    </QueryClientProvider>
  );
};

export default OnboardingFlow;
