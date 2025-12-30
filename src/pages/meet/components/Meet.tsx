import { useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import StartMeeting from './StartMeeting';
import UserCard from './UserCard';
import Header from '../../../components/Header';
import Popup from '../../../components/Popup';

import { useAuth } from '../../../hooks/useAuth';
import { usePopup } from '../../../hooks/usePopup';
import { getGravatarUrl } from '../../../utils/gravatar';
import { showPopup } from '../../../utils/popupService';

import type { AppUser } from '../types';
import meet_background from '../../../assets/meet-background.png';

function MeetContent() {
  const { isLoggedIn, dbUser, user: oidcUser, meetings: meetingsList, refetchMeetings } = useAuth();

  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const { popup, hidePopup } = usePopup();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'login_failed') {

      showPopup('Authentication failed. Please try logging in again.', 'error');

      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn && oidcUser) {
      const { name, email, context, picture } = oidcUser.profile;
      const minutesUsed = dbUser?.user.totalHostMinutes ?? 0;

      setAppUser({
        name: name ?? 'User',
        email: email ?? '',
        plan: (context as any)?.user?.subscription_status ?? 'trialing',
        avatarUrl: picture ?? getGravatarUrl(email || '', 200),
        minutesUsed: minutesUsed,
        token: oidcUser.access_token,
      });
    } else {
      setAppUser(null);
    }
  }, [isLoggedIn, oidcUser, dbUser]);

    const usedBookings = meetingsList.filter((m) => m.status === 'Upcoming' || m.status === 'Expired').length;
    const maxBookings = dbUser?.user.maxBookings ?? 1;

    const isBookingLimitReached = usedBookings >= maxBookings;

  return (
    <div className='bg-gradient-to-b from-[#F3F3F3] to-[#FAFAFA] min-h-screen p-4 overflow-x-hidden'>
      <Popup
        message={popup.message}
        type={popup.type}
        duration={popup.duration}
        onClose={hidePopup}
      />

      <div className='w-full max-w-[1700px] mx-auto px-8'>
        <Header pageType='welcome' user={appUser ?? undefined} />

        {/* MAIN */}
        <main className='grid grid-cols-1 lg:grid-cols-5 gap-16 lg:gap-[5vw] items-start pt-4 lg:pt-8 mt-4'>
          <div className='lg:col-span-2'>

            {/* Left Column */}
            <StartMeeting
              isLoggedIn={isLoggedIn}
              onMeetingBooked={refetchMeetings}
              isBookingLimitReached={isBookingLimitReached}
            />
          </div>

          {/* Right Column */}
          {appUser ? (
            <UserCard
              user={appUser}
              meetingsList={meetingsList}
              recordings={[]}
              notes={[]}
              minutesUsed={appUser.minutesUsed}
              token={appUser.token}
              maxBookings={dbUser?.user.maxBookings ?? 1}
              onMeetingDeleted={refetchMeetings}
              onMeetingBooked={refetchMeetings}
            />
          ) : (
            <div className='relative lg:col-span-3 w-full h-full mt-12 lg:mt-0'>
              <img
                src={meet_background.src}
                alt='Illustration'
                className='w-full h-full object-contain'
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function Meet() {
  return (
    <QueryClientProvider client={queryClient}>
      <MeetContent />
    </QueryClientProvider>
  );
}