import React, { useState, useEffect, useRef } from 'react';
import { animatePlaceholder, generatePlaceholderWords, isRoomNameValid } from '../../../utils/placeholder.ts';
import { getAuthService } from '../../../utils/AuthService';
import { showPopup } from '../../../utils/popupService.ts';

import BookingModal from './BookingModal';
import Button from '../../../components/Button';
import PageHeader from '../../../components/PageHeader';
import { Info, Loader2, Lock } from 'lucide-react';
import { addYears } from 'date-fns';
import { bookMeeting } from '../../../utils/api.ts';
import { useAuth } from '../../../hooks/useAuth.ts';
import { useRoomAvailability } from '../../../hooks/useRoomAvailability.ts';
import RoomAvailabilityStatus from './RoomAvailabilityStatus.tsx';
import CopyIcon from '../../../components/CopyIcon.tsx';

interface Props {
  isLoggedIn: boolean;
  onMeetingBooked: () => void;
  isBookingLimitReached: boolean;
}

const StartMeeting: React.FC<Props> = ({ isLoggedIn, onMeetingBooked, isBookingLimitReached }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [placeholder, setPlaceholder] = useState('');
  const [isRoomNameInvalid, setIsRoomNameInvalid] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  
  const { getAccessToken } = useAuth()
  const { isChecking, isAvailable, error: availabilityError } = useRoomAvailability(roomName, isRoomNameInvalid);

  const placeholderWords = generatePlaceholderWords(10); // generate random room names

  useEffect(() => {
    setPlaceholder(placeholderWords[0]);
    if (!inputRef.current) return;

    const cleanup = animatePlaceholder(
      inputRef.current,
      placeholderWords, // array of words to animate
      100, // typing speed
      50, // erasing speed
      1500, // pause after typing
      setPlaceholder,
    );

    return cleanup;
  }, []);

  /**
   * Handles changes to the room name input and validates its content.
   */
  const handleRoomNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newRoomName = e.target.value;
    setRoomName(newRoomName);

    // Check room name for invalid characters
    setIsRoomNameInvalid(isRoomNameValid(newRoomName));
  };

  /**
   * Navigates the user to the meeting room if the room name is valid.
   */
  const handleJoinClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isRoomNameInvalid) {
      e.preventDefault(); // Stop the link from navigating
      showPopup('Room name contains invalid characters.', 'error', 2500);
    }
  };

  const handleBookMeetingClick = async (
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    e.preventDefault();

    if (isLoggedIn) {
      if (isBookingLimitReached) {
        showPopup('You have reached your booking limit.', 'error');
        return;
      }

      const finalRoomName = roomName.trim() || placeholder;

      if (isRoomNameValid(finalRoomName)) {
        showPopup('Room name contains invalid characters.', 'error');
        return;
      }

      if (!finalRoomName) {
        showPopup('Please enter a meeting name to book.', 'error');
        return;
      }

      const token = getAccessToken();
      if (!token) {
        showPopup('Authentication error. Please log in again.', 'error');
        return;
      }

      setIsBooking(true); // Start loading

      try {
        const currentDate = new Date();
        const futureDate = addYears(currentDate, 1); // 1 Year from the current date

        const result = await bookMeeting(finalRoomName, futureDate, token);

        onMeetingBooked();
        setRoomName('');
      } catch (error) {
        console.error('Booking failed:', error);
        const errorMessage =
          error instanceof Error ? error.message : 'An unknown error occurred.';
        showPopup(`Error: ${errorMessage}`, 'error');
      } finally {
        setIsBooking(false); // Stop loading
      }
    } else {
      const authService = getAuthService();
      if (authService) {
        showPopup('Please log in to book a meeting.', 'error', 2500);
      } else {
        alert(
          'Authentication service is currently unavailable. Please try again later.',
        );
      }
    }
  };

  const handleCopyClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (isCopied) {
      return;
    }

    const finalRoomName = roomName.trim() || placeholder;
    navigator.clipboard.writeText(finalRoomName).then(() => {
      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
      }, 2000); // Reset icon after 2 seconds
    });
  };

  const finalRoomName = roomName.trim() || placeholder;

  const isBookButtonDisabled = (isLoggedIn && isBookingLimitReached) || isBooking;

  const showCopyIcon = !isRoomNameInvalid && !isChecking && isAvailable && !availabilityError;

  /**
   * Renders a contextual message below the action buttons based on auth state.
   */
  const renderBookingStatusMessage = () => {
    if (isLoggedIn && isBookingLimitReached) {
      return (
        <div className='mt-4 flex items-center justify-center gap-2 text-sm text-gray-600 p-2 rounded-lg'>
          <Info size={14} />
          <span>Booking limit reached.</span>
        </div>
      );
    }

    if (!isLoggedIn) {
      return (
        <div className='mt-4 flex items-center justify-center gap-2 text-sm text-gray-500 p-2 rounded-lg'>
          <Lock size={14} className='text-gray-500 text-bold' />
          <span>Login required to book a meeting.</span>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      <div>
        <PageHeader
          title='Secure and high quality meetings'
          className='text-left'
        >
          The only online meeting platform that adapts to your teaching style,
          not the other way around.
        </PageHeader>

        <form id='room-form' className='max-w-lg'>
          <div className='relative w-full'>
            <input
              ref={inputRef}
              id='room-input'
              type='text'
              value={roomName}
              onChange={handleRoomNameChange}
              placeholder='Enter meeting name'
              className='w-full bg-transparent border-0 border-b border-gray-300 py-3 pl-3 pr-12 text-2xl sm:text-3xl font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-0 focus:border-primary-500 transition-colors'
            />

            {showCopyIcon && (
              <button
                onClick={handleCopyClick}
                className='group absolute top-1/2 -translate-y-1/2 right-2 p-2 text-gray-400 hover:text-primary-500 rounded-full transition-colors'
                aria-label='Copy meeting name'
                type='button'
              >
                <CopyIcon
                  isCopied={isCopied}
                  size={20}
                  className='text-gray-400 group-hover:text-primary-500'
                />
              </button>
            )}
          </div>

          <RoomAvailabilityStatus
            isInvalid={isRoomNameInvalid}
            isChecking={isChecking}
            isAvailable={isAvailable}
            error={availabilityError}
          />

          {!isChecking &&
            isAvailable === null &&
            !availabilityError &&
            !isRoomNameInvalid && (
              <p className='mt-3 mb-8 text-sm text-gray-500'>
                Enter subject or Meeting ID to get started
              </p>
            )}

          <div className='flex max-[450px]:flex-col items-center gap-4'>
            <a
              href={`/meet/${finalRoomName}`}
              className='w-full'
              onClick={handleJoinClick}
              role='button'
            >
              <Button
                type='button'
                variant='primary'
                className='w-full max-[445px]:w-full shadow-sm transition-transform hover:scale-105 will-change-transform'
              >
                Join meeting
              </Button>
            </a>

            <Button
              onClick={handleBookMeetingClick}
              variant='secondary'
              className='w-full max-[445px]:w-full shadow-sm transition-transform hover:scale-105 will-change-transform disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100'
              disabled={isBookButtonDisabled}
            >
              {isBooking ? (
                <>
                  <Loader2 className='mx-auto h-5 w-5 animate-spin' />
                </>
              ) : (
                'Book meeting'
              )}
            </Button>
          </div>

          {renderBookingStatusMessage()}
        </form>
      </div>

      {isLoggedIn && (
        <BookingModal
          roomName={finalRoomName}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onBookingSuccess={onMeetingBooked}
        />
      )}
    </>
  );
};

export default StartMeeting;
