import React, { useState, useEffect, useRef } from 'react';
import { animatePlaceholder, generatePlaceholderWords, isRoomNameValid } from '../../utils/placeholder';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Info, Loader2, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import CopyIcon from '../CopyIcon';
import type { User } from '../../data/mock-dashboard';

interface OverviewViewProps {
  user: User;
}

// Simplified room availability hook for demo
const useRoomAvailability = (roomName: string, isInvalid: boolean) => {
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomName.trim() || isInvalid) {
      setIsAvailable(null);
      setIsChecking(false);
      setError(null);
      return;
    }

    setIsChecking(true);
    setError(null);
    
    // Simulate API call
    const timer = setTimeout(() => {
      // For demo purposes, assume room is available if it's not empty
      setIsAvailable(true);
      setIsChecking(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [roomName, isInvalid]);

  return { isChecking, isAvailable, error };
};

const RoomAvailabilityStatus: React.FC<{
  isInvalid: boolean;
  isChecking: boolean;
  isAvailable: boolean | null;
  error: string | null;
}> = ({ isInvalid, isChecking, isAvailable, error }) => {
  if (isInvalid) {
    return (
      <div className='mt-2 mb-4 flex items-center gap-2 text-sm text-red-600'>
        <AlertCircle size={14} />
        <span>Room name cannot contain special characters.</span>
      </div>
    );
  }
  if (isChecking) {
    return (
      <div className='mt-2 mb-4 flex items-center gap-2 text-sm text-muted-foreground'>
        <Loader2 size={14} className='animate-spin' />
        <span>Checking availability...</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className='mt-2 mb-4 flex items-center gap-2 text-sm text-red-600'>
        <XCircle size={14} />
        <span>{error}</span>
      </div>
    );
  }
  if (isAvailable === true) {
    return (
      <div className='mt-2 mb-4 flex items-center gap-2 text-sm text-green-600'>
        <CheckCircle2 size={14} />
        <span>Room name is available!</span>
      </div>
    );
  }
  if (isAvailable === false) {
    return (
      <div className='mt-2 mb-4 flex items-center gap-2 text-sm text-red-600'>
        <XCircle size={14} />
        <span>This room name is already booked.</span>
      </div>
    );
  }
  return null;
};

const OverviewView: React.FC<OverviewViewProps> = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [roomName, setRoomName] = useState('');
  const [placeholder, setPlaceholder] = useState('');
  const [isRoomNameInvalid, setIsRoomNameInvalid] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  
  const { isChecking, isAvailable, error: availabilityError } = useRoomAvailability(roomName, isRoomNameInvalid);

  const placeholderWords = generatePlaceholderWords(10);

  useEffect(() => {
    setPlaceholder(placeholderWords[0]);
    if (!inputRef.current) return;

    const cleanup = animatePlaceholder(
      inputRef.current,
      placeholderWords,
      100,
      50,
      1500,
      setPlaceholder,
    );

    return cleanup;
  }, []);

  const handleRoomNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newRoomName = e.target.value;
    setRoomName(newRoomName);
    setIsRoomNameInvalid(isRoomNameValid(newRoomName));
  };

  const handleJoinClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isRoomNameInvalid) {
      e.preventDefault();
      // Could show a toast here
    }
  };

  const handleBookMeetingClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    const finalRoomName = roomName.trim() || placeholder;

    if (isRoomNameValid(finalRoomName)) {
      // Could show error toast here
      return;
    }

    if (!finalRoomName) {
      // Could show error toast here
      return;
    }

    setIsBooking(true);

    // Simulate booking API call
    setTimeout(() => {
      setIsBooking(false);
      setRoomName('');
      // Could show success toast here
    }, 1000);
  };

  const finalRoomName = roomName.trim() || placeholder;
  const fullMeetingUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/meet/${finalRoomName}`;

  const showCopyIcon = !isRoomNameInvalid && !isChecking && isAvailable && !availabilityError;

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl font-bold">Secure and high quality meetings</CardTitle>
          <CardDescription className="text-base">
            The only online meeting platform that adapts to your teaching style,
            not the other way around.
          </CardDescription>
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
                className="flex h-14 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xl sm:text-2xl shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 pr-12"
              />

              {showCopyIcon && (
                <div className="absolute top-1/2 -translate-y-1/2 right-3">
                  <CopyIcon
                    textToCopy={fullMeetingUrl}
                    size={20}
                    className="text-muted-foreground hover:text-primary transition-colors"
                    aria-label="Copy meeting URL"
                    type="button"
                  />
                </div>
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
                <p className="text-sm text-muted-foreground">
                  Enter subject or Meeting ID to get started
                </p>
              )}

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <a
                href={`/meet/${finalRoomName}`}
                className="flex-1"
                onClick={handleJoinClick}
                role="button"
              >
                <Button
                  type="button"
                  variant="default"
                  className="w-full h-12 text-base"
                >
                  Join meeting
                </Button>
              </a>

              <Button
                onClick={handleBookMeetingClick}
                variant="secondary"
                className="flex-1 h-12 text-base"
                disabled={isBooking}
              >
                {isBooking ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Booking...
                  </>
                ) : (
                  'Book meeting'
                )}
              </Button>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
              <Info size={14} />
              <span>You can join meetings instantly or book them for later.</span>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default OverviewView;
