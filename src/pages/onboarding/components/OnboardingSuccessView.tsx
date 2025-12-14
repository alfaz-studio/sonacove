import React from 'react';
import type { User as OidcUser } from 'oidc-client-ts';
import { CircleCheck } from 'lucide-react';
import Button from '../../../components/Button';

interface OnboardingSuccessViewProps {
  user: OidcUser;
  onOpenCheckout: () => void;
}

const OnboardingSuccessView: React.FC<OnboardingSuccessViewProps> = ({ user, onOpenCheckout }) => {
  const isTrialing =
    (user.profile.context as any)?.user?.subscription_status !== 'active';
  const firstName = user.profile.name?.split(' ')[0] ?? 'there';

  return (
    <div className='text-center'>
      <CircleCheck className='w-16 h-16 mx-auto text-green-500' />
      <h1 className='text-4xl font-bold text-gray-900 mt-6 mb-2'>
        Welcome aboard, {firstName}!
      </h1>

      {isTrialing ? (
        <>
          <p className='text-lg text-gray-600'>
            You're now on our unlimited free trial.
          </p>
          <div className='bg-gray-50 rounded-xl p-6 my-8 text-left space-y-2 border'>
            <p className='font-semibold text-gray-800'>Your Account:</p>
            <p className='text-gray-600'>
              <strong>Email:</strong> {user.profile.email}
            </p>
            <p className='text-gray-600'>
              <strong>Status:</strong> Free Trial
            </p>
          </div>
          <div className='space-y-4 flex flex-col'>
            <Button
              onClick={onOpenCheckout}
              variant='primary'
              className='w-full'
            >
              Subscribe Now for Full Access
            </Button>
            <a href='/dashboard'>
              <Button variant='secondary' className='w-full'>
                Continue with Trial
              </Button>
            </a>
          </div>
        </>
      ) : (
        <>
          <p className='text-lg text-gray-600'>
            Your account is fully activated.
          </p>
          <div className='bg-gray-50 rounded-xl p-6 my-8 text-left space-y-2 border'>
            <p className='font-semibold text-gray-800'>Your Account:</p>
            <p className='text-gray-600'>
              <strong>Email:</strong> {user.profile.email}
            </p>
            <p className='text-gray-600'>
              <strong>Status:</strong> Active
            </p>
          </div>
          <a href='/dashboard'>
            <Button variant='primary' className='w-full'>
              Go to Sonacove Meets
            </Button>
          </a>
        </>
      )}
    </div>
  );
};

export default OnboardingSuccessView;
