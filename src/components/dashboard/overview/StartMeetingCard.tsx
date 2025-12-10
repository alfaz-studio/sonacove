"use client"

import React, { useState, useEffect, useRef } from 'react';
import { 
  Info, 
  Loader2, 
  Copy,
  Check,
  Lock,
  AlertCircle
} from 'lucide-react';
import { addYears } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { animatePlaceholder, generatePlaceholderWords, isRoomNameValid } from '@/utils/placeholder';
import { useRoomAvailability } from '@/hooks/useRoomAvailability';
import { useAuth } from '@/hooks/useAuth';
import { bookMeeting } from '@/utils/api';
import { showPopup } from '@/utils/popupService';

import RoomAvailabilityStatus from '@/pages/meet/components/RoomAvailabilityStatus';

interface StartMeetingCardProps {
  onMeetingBooked?: () => void;
  bookedMeetingsCount?: number;
}

const InputCopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="p-2 rounded-full hover:bg-gray-100 transition-colors focus:outline-none focus:bg-gray-100"
      aria-label="Copy meeting link"
      title="Copy meeting link"
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <Copy className="h-4 w-4 text-gray-400 hover:text-primary-500" />
      )}
    </button>
  );
};

const StartMeetingCard: React.FC<StartMeetingCardProps> = ({ onMeetingBooked, bookedMeetingsCount }) => {
  const [roomName, setRoomName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [placeholder, setPlaceholder] = useState('');
  const [isRoomNameInvalid, setIsRoomNameInvalid] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  
  const { isLoggedIn, getAccessToken, dbUser, refetchMeetings } = useAuth();

  const { isChecking, isAvailable, error: availabilityError } = useRoomAvailability(roomName, isRoomNameInvalid);

  const usedBookings = bookedMeetingsCount ?? dbUser?.bookedRooms?.length ?? 0;
  const maxBookings = dbUser?.user.maxBookings ?? 1;
  const isBookingLimitReached = usedBookings >= maxBookings;

  useEffect(() => {
    const words = generatePlaceholderWords(10);
    setPlaceholder(words[0]);
    if (inputRef.current) {
      return animatePlaceholder(inputRef.current, words, 100, 50, 1500, setPlaceholder);
    }
  }, []);

  const handleRoomNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRoomName(e.target.value);
    setIsRoomNameInvalid(isRoomNameValid(e.target.value));
  };

  const handleBookMeetingClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    if (!isLoggedIn) {
      showPopup('Please log in to book a meeting.', 'error');
      return;
    }

    if (isBookingLimitReached) {
      showPopup('You have reached your booking limit.', 'error');
      return;
    }

    const finalRoomName = roomName.trim() || placeholder;

    if (isRoomNameValid(finalRoomName) || !finalRoomName) {
      showPopup('Invalid room name.', 'error');
      return;
    }

    const token = getAccessToken();
    if (!token) {
      showPopup('Authentication error. Please log in again.', 'error');
      return;
    }

    setIsBooking(true);

    try {
      const futureDate = addYears(new Date(), 1);
      await bookMeeting(finalRoomName, futureDate, token);
      
      // Trigger parent update
      if (onMeetingBooked) onMeetingBooked();
      
      // Also update local state
      if (refetchMeetings) refetchMeetings();

      showPopup('Meeting booked successfully!', 'success');
      setRoomName('');
    } catch (error) {
      console.error('Booking failed:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      showPopup(`Error: ${msg}`, 'error');
    } finally {
      setIsBooking(false);
    }
  };

  const finalRoomName = roomName.trim() || placeholder;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const fullMeetingUrl = `${origin}/meet/${finalRoomName}`;
  
  const showCopyIcon = !isRoomNameInvalid && !isChecking && isAvailable && !availabilityError && finalRoomName;
  const isBookButtonDisabled = (isLoggedIn && isBookingLimitReached) || isBooking;

  return (
    <Card className={`border-border shadow-sm bg-white ${!isLoggedIn ? 'h-full' : 'h-fit'}`}>
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-gray-900">Start a Meeting</CardTitle>
        <CardDescription>Create a secure room instantly or schedule for later.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4">
          <div className="relative w-full">
            <input
              ref={inputRef}
              type="text"
              value={roomName}
              onChange={handleRoomNameChange}
              autoFocus={true}
              placeholder={placeholder || 'Enter meeting name'}
              className="flex h-12 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-lg shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50 pr-12"
            />
            {showCopyIcon && (
              <div className="absolute top-1/2 -translate-y-1/2 right-2">
                <InputCopyButton text={fullMeetingUrl} />
              </div>
            )}
          </div>

          <RoomAvailabilityStatus
            isInvalid={isRoomNameInvalid}
            isChecking={isChecking}
            isAvailable={isAvailable}
            error={availabilityError}
          />

          <div className="grid grid-cols-2 gap-3 pt-2">
            <a href={`/meet/${finalRoomName}`} role="button" className="w-full">
              <Button type="button" className="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold shadow-sm h-10">
                Join Now
              </Button>
            </a>
            <Button
              onClick={handleBookMeetingClick}
              variant="outline"
              className="w-full border-gray-200 hover:bg-gray-50 text-gray-700 shadow-sm h-10 disabled:opacity-70"
              disabled={isBookButtonDisabled}
            >
              {isBooking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Book for Later'}
            </Button>
          </div>

          {/* Warnings */}
          {isLoggedIn && isBookingLimitReached && (
            <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded-md">
              <AlertCircle size={14} />
              <span>Booking limit reached ({maxBookings}/{maxBookings}).</span>
            </div>
          )}
          {!isLoggedIn && (
            <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 p-2 rounded-md">
              <Lock size={14} />
              <span>Login required to book meetings.</span>
            </div>
          )}

          <div className="flex items-start gap-2 text-xs text-muted-foreground pt-1">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Meetings adapts to your teaching style using AI-driven features.</span>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default StartMeetingCard;
