"use client"

import React, { useState } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Mail, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  generateGoogleCalendarLink,
  generateMicrosoftCalendarLink,
  downloadICSFile,
  parseGuestEmails,
  type CalendarEvent,
} from '@/utils/calendar';
import { showPopup } from '@/utils/popupService';

interface ScheduleMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomName: string;
  meetingUrl: string;
}

const ScheduleMeetingDialog: React.FC<ScheduleMeetingDialogProps> = ({
  open,
  onOpenChange,
  roomName,
  meetingUrl,
}) => {
  // Default to next day at 10:00 AM
  const getDefaultDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  };

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(getDefaultDate());
  const [startTime, setStartTime] = useState('10:00');
  const [duration, setDuration] = useState('60'); // minutes
  const [guestEmails, setGuestEmails] = useState('');

  const handleGoogleCalendar = () => {
    if (!selectedDate) {
      showPopup('Please select a date', 'error');
      return;
    }

    const [hours, minutes] = startTime.split(':').map(Number);
    const startDate = new Date(selectedDate);
    startDate.setHours(hours, minutes, 0, 0);

    const endDate = new Date(startDate);
    endDate.setMinutes(endDate.getMinutes() + Number(duration));

    const guests = parseGuestEmails(guestEmails);
    if (guestEmails && guests.length === 0) {
      showPopup('Please enter valid email addresses', 'error');
      return;
    }

    const event: CalendarEvent = {
      title: roomName,
      description: `Join the meeting: ${meetingUrl}`,
      location: meetingUrl,
      startDate,
      endDate,
      guests: guests.length > 0 ? guests : undefined,
    };

    const url = generateGoogleCalendarLink(event);
    window.open(url, '_blank');
    showPopup('Opening Google Calendar...', 'success');
  };

  const handleMicrosoftCalendar = () => {
    if (!selectedDate) {
      showPopup('Please select a date', 'error');
      return;
    }

    const [hours, minutes] = startTime.split(':').map(Number);
    const startDate = new Date(selectedDate);
    startDate.setHours(hours, minutes, 0, 0);

    const endDate = new Date(startDate);
    endDate.setMinutes(endDate.getMinutes() + Number(duration));

    const guests = parseGuestEmails(guestEmails);
    if (guestEmails && guests.length === 0) {
      showPopup('Please enter valid email addresses', 'error');
      return;
    }

    const event: CalendarEvent = {
      title: roomName,
      description: `Join the meeting: ${meetingUrl}`,
      location: meetingUrl,
      startDate,
      endDate,
      guests: guests.length > 0 ? guests : undefined,
    };

    const url = generateMicrosoftCalendarLink(event);
    window.open(url, '_blank');
    showPopup('Opening Microsoft Calendar...', 'success');
  };

  const handleDownloadICS = () => {
    if (!selectedDate) {
      showPopup('Please select a date', 'error');
      return;
    }

    const [hours, minutes] = startTime.split(':').map(Number);
    const startDate = new Date(selectedDate);
    startDate.setHours(hours, minutes, 0, 0);

    const endDate = new Date(startDate);
    endDate.setMinutes(endDate.getMinutes() + Number(duration));

    const guests = parseGuestEmails(guestEmails);
    if (guestEmails && guests.length === 0) {
      showPopup('Please enter valid email addresses', 'error');
      return;
    }

    const event: CalendarEvent = {
      title: roomName,
      description: `Join the meeting: ${meetingUrl}`,
      location: meetingUrl,
      startDate,
      endDate,
      guests: guests.length > 0 ? guests : undefined,
    };

    downloadICSFile(event);
    showPopup('ICS file downloaded', 'success');
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset form when closing
    setSelectedDate(getDefaultDate());
    setStartTime('10:00');
    setDuration('60');
    setGuestEmails('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule Meeting</DialogTitle>
          <DialogDescription>
            Add this meeting to your calendar. You can schedule multiple meetings for this reserved room.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-visible">
          {/* Meeting Title - Read-only */}
          <div className="space-y-2">
            <Label htmlFor="title">Meeting Room</Label>
            <Input
              id="title"
              value={roomName}
              readOnly
              disabled
              className="bg-gray-50 cursor-not-allowed"
            />
          </div>

          {/* Date Picker */}
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, 'PPP') : 'Select a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time and Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-time">Start Time</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min="15"
                step="15"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="60"
              />
            </div>
          </div>

          {/* Guest Emails */}
          <div className="space-y-2">
            <Label htmlFor="guests">
              <Mail className="inline mr-2 h-4 w-4" />
              Guest Emails (comma-separated)
            </Label>
            <Input
              id="guests"
              type="text"
              value={guestEmails}
              onChange={(e) => setGuestEmails(e.target.value)}
              placeholder="guest1@example.com, guest2@example.com"
            />
            <p className="text-sm text-muted-foreground">
              Optional: Add email addresses to invite guests
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <Button
              variant="outline"
              onClick={handleDownloadICS}
              className="flex-1"
            >
              Download ICS File
            </Button>
            <Button
              variant="outline"
              onClick={handleMicrosoftCalendar}
              className="flex-1"
            >
              Microsoft Calendar
            </Button>
            <Button
              variant="outline"
              onClick={handleGoogleCalendar}
              className="flex-1"
            >
              Google Calendar
            </Button>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Click the button that matches your calendar app to add this meeting.
          </p>
          <Button
            onClick={handleClose}
            className="w-full bg-primary-500 hover:bg-primary-600 text-white"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduleMeetingDialog;

