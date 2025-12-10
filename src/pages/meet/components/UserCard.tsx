import React, { useState, useEffect} from 'react';
import Tabs from './Tabs';
import type { User } from '../types';
import UserInfo from './User.Info';
import UserPlanDetails from './UserPlanDetails';

interface UserCardProps extends User {
  token?: string;
  minutesUsed?: number;
  maxBookings: number;
  onMeetingDeleted: () => void;
  onMeetingBooked: () => void;
}

const UserCard: React.FC<UserCardProps> = ({ user, meetingsList, recordings, notes, minutesUsed, token, maxBookings, onMeetingDeleted, onMeetingBooked }) => {
  const [subscriptionUrl, setSubscriptionUrl] = useState('');

  // The token's validity is now determined entirely by the parent.
  // If we receive a token, we assume it's valid. If not, it's expired.
  const isExpired = !token;

  const authDomain =
    window.location.hostname === 'sonacove.com'
      ? 'auth.sonacove.com/auth'
      : 'staj.sonacove.com/auth';
  const manageAccountUrl = `https://${authDomain}/realms/jitsi/account`;

  useEffect(() => {
    const defaultUrl = `${window.location.origin}/onboarding#access_token=${token}`;
    setSubscriptionUrl(defaultUrl);

    if (user.plan === 'active') {
      fetch(`${window.location.origin}/api/paddle-customer-portal`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((response) => response.json())
        .then((data: unknown) => {
          const typedData = data as { url?: string };
          if (typedData.url) {
            setSubscriptionUrl(typedData.url);
          }
        })
        .catch((error) =>
          console.error('Error fetching subscription URL:', error),
        );
    }
  }, [user.plan, token]);

  const handleSubscriptionClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isExpired) {
      e.preventDefault();
      alert(
        'Your session has expired. Please log in again to manage your plan.',
      );
    }
  };

  const usedBookings = meetingsList.filter(
      (m) => m.status === 'Upcoming' || m.status === 'Expired',
    ).length;

  return (
    <div className='bg-white rounded-3xl p-6 border border-gray-200 shadow-sm lg:col-span-3'>
      <div className='flex flex-col sm:flex-row sm:items-start gap-6 mb-8'>
        <div className='flex-1 flex flex-col justify-center'>
          <UserInfo user={user} />
          <UserPlanDetails
            plan={user.plan}
            minutesUsed={minutesUsed ?? 0}
            usedBookings={usedBookings}
            maxBookings={maxBookings}
          />
        </div>

        {/* Buttons */}
        <div className='flex flex-col gap-2 mt-4 sm:mt-0 sm:ml-4 items-center sm:items-end'>
          <a
            href={manageAccountUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='px-7 py-3 border border-primary-500 text-primary-500 text-sm font-semibold rounded-full hover:bg-primary-50 w-full text-center'
          >
            Manage Account
          </a>
          <a
            href={subscriptionUrl}
            target='_blank'
            rel='noopener noreferrer'
            onClick={handleSubscriptionClick}
            className={`px-7 py-3 border border-black text-black text-sm font-semibold rounded-full w-full text-center transition-opacity ${
              isExpired ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'
            }`}
          >
            Manage Plan
          </a>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        meetingsList={meetingsList}
        recordings={recordings}
        notes={notes}
        token={token}
        onMeetingDeleted={onMeetingDeleted}
        onMeetingBooked={onMeetingBooked}
      />
    </div>
  );
};

export default UserCard;
