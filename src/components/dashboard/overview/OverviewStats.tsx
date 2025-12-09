"use client"

import React, { useMemo } from 'react';
import { Clock, Users, Calendar, TrendingUp } from 'lucide-react';
import { isAfter, isThisMonth } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { sampleMeetings } from '@/data/sample-meetings';

const OverviewStats = () => {
  const stats = useMemo(() => {
    const now = new Date();
    
    const upcomingCount = sampleMeetings.filter(m => 
      isAfter(new Date(m.timestamp), now)
    ).length;

    // Filter meetings for the current month
    const thisMonthMeetings = sampleMeetings.filter(m => 
      isThisMonth(new Date(m.timestamp))
    );

    const minutesThisMonth = thisMonthMeetings.reduce((acc, curr) => acc + curr.duration, 0);
    const participantsThisMonth = thisMonthMeetings.reduce((acc, curr) => acc + curr.participantCount, 0);

    return {
      upcoming: upcomingCount,
      minutes: Math.round(minutesThisMonth),
      participants: participantsThisMonth
    };
  }, []);

  return (
    <div className="grid grid-cols-2 gap-4 mt-6">
      <Card className="bg-primary-50 border-primary-100 shadow-none">
        <CardContent className="p-4 flex flex-col justify-between h-full">
          <div className="flex items-center gap-2 text-primary-600 mb-2">
            <Calendar className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Upcoming</span>
          </div>
          <div>
            <span className="text-2xl font-bold text-primary-900">{stats.upcoming}</span>
            <p className="text-xs text-primary-700 mt-1">Scheduled meetings</p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border-gray-200 shadow-sm">
        <CardContent className="p-4 flex flex-col justify-between h-full">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">This Month</span>
          </div>
          <div>
            <span className="text-2xl font-bold text-gray-900">{stats.minutes}m</span>
            <p className="text-xs text-gray-500 mt-1">Total time spent</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OverviewStats;
