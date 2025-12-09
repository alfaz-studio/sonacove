"use client"

import React from 'react';
import type { User } from '../../data/mock-dashboard';

import MeetingListCard from './overview/MeetingListCard';
import StartMeetingCard from './overview/StartMeetingCard';
import OverviewStats from './overview/OverviewStats';

interface OverviewViewProps {
  user: User;
}

const OverviewView: React.FC<OverviewViewProps> = ({ user }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
      {/* Left Column: Takes 2/5 width */}
      <div className="lg:col-span-2">
        <StartMeetingCard />
        
        <OverviewStats />
      </div>

      {/* Right Column: Takes 3/5 width */}
      <div className="lg:col-span-3">
        <MeetingListCard />
      </div>
    </div>
  );
};

export default OverviewView;
