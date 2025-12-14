import React, { useMemo } from 'react';
import { Clock, BookmarkCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { isAfter } from 'date-fns';

import type { Meeting } from './MeetingListCard';

interface OverviewStatsProps {
  meetings: Meeting[];
  totalMinutes: number;
  maxBookings: number;
}

const OverviewStats: React.FC<OverviewStatsProps> = ({ meetings, totalMinutes, maxBookings }) => {
  const stats = useMemo(() => {
    const bookedCount = meetings.filter(m => isAfter(new Date(m.timestamp), new Date())).length;
    const minutesUsed = totalMinutes || 0;

    return {
      booked: bookedCount,
      minutes: minutesUsed
    };
  }, [meetings, totalMinutes]);

  return (
    <div className="grid grid-cols-2 gap-4 mt-6">
      <Card className="bg-primary-50 border-primary-100 shadow-none">
        <CardContent className="p-4 flex flex-col justify-between h-full">
          <div className="flex items-center gap-2 text-primary-600 mb-2">
            <BookmarkCheck className="h-4 w-4" />
            <span className="text-base font-semibold uppercase tracking-wider">Bookings</span>
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-primary-900">{stats.booked}</span>
              <span className="text-base font-medium text-primary-600">/ {maxBookings}</span>
            </div>
            <p className="text-base text-primary-700 mt-1">Slots used</p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border-gray-200 shadow-sm">
        <CardContent className="p-4 flex flex-col justify-between h-full">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <Clock className="h-4 w-4" />
            <span className="text-base font-semibold uppercase tracking-wider">Total Hosted</span>
          </div>
          <div>
            <span className="text-3xl font-bold text-gray-900">{stats.minutes}</span>
            <p className="text-base text-gray-500 mt-1">Minutes used</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OverviewStats;
