"use client"

import React, { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { deleteBooking } from '../../utils/api';
import { showPopup } from '../../utils/popupService';

import StartMeetingCard from './overview/StartMeetingCard';
import MeetingListCard, { type Meeting } from './overview/MeetingListCard';
import OverviewStats from './overview/OverviewStats';
import LoginRequired from './LoginRequired';

interface LocalStorageMeeting {
  conference: string;
  date: string;
  duration: number;
}

const OverviewView = () => {
  const { isLoggedIn, dbUser, refetchMeetings, getAccessToken, meetings: authMeetings } = useAuth();
  const [localPastMeetings, setLocalPastMeetings] = useState<Meeting[]>([]);
  

  useEffect(() => {
    try {
      const recentListJson = localStorage.getItem('features/recent-list');
      if (recentListJson) {
        const localData: LocalStorageMeeting[] = JSON.parse(recentListJson);
        
        const mappedHistory = localData.map((item, index) => {
          const urlParts = item.conference.split('/');
          const title = urlParts[urlParts.length - 1] || 'Untitled Meeting';
          const timestamp = new Date(item.date);

          return {
            id: `local-${title}-${index}`,
            title: title,
            timestamp: isNaN(timestamp.getTime()) ? new Date() : timestamp,
            duration: item.duration, 
            source: 'local' as const
          };
        });

        setLocalPastMeetings(mappedHistory);
      }
    } catch (error) {
      console.error('Failed to parse recent meetings from localStorage:', error);
    }
  }, []);

  const allMeetings: Meeting[] = useMemo(() => {
    const backendList = (authMeetings || []).map((m: any) => {
      let timestamp = new Date();
      if (m.date) {
        const parsed = new Date(m.date);
        if (!isNaN(parsed.getTime())) timestamp = parsed;
      }

      return {
        id: m.title,
        title: m.title,
        timestamp: timestamp, 
        duration: 0,
      };
    });

    const backendTitles = new Set(backendList.map(m => m.title));
    const uniqueLocalMeetings = localPastMeetings.filter(
      m => !backendTitles.has(m.title)
    );

    return [...backendList, ...uniqueLocalMeetings];
  }, [authMeetings, localPastMeetings]);

  const handleDeleteMeeting = async (meetingId: string) => {
    const isLocal = localPastMeetings.find(m => m.id === meetingId);

    if (isLocal) {
      try {
        const recentListJson = localStorage.getItem('features/recent-list');
        if (recentListJson) {
          const localData: LocalStorageMeeting[] = JSON.parse(recentListJson);
          const updatedData = localData.filter(item => !item.conference.includes(isLocal.title));
          
          localStorage.setItem('features/recent-list', JSON.stringify(updatedData));
          
          setLocalPastMeetings(prev => prev.filter(m => m.id !== meetingId));
          showPopup('Removed from history', 'success');
        }
      } catch (err) {
        console.error(err);
      }
      return;
    }

    const token = getAccessToken();
    if (!token) {
      showPopup('Authentication error', 'error');
      return;
    }

    try {
      await deleteBooking(meetingId, token);
      if (refetchMeetings) {
        await refetchMeetings();
      }
      showPopup('Meeting booking cancelled', 'success');
    } catch (error) {
      console.error('Failed to delete meeting:', error);
      showPopup('Failed to delete meeting', 'error');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
      {/* Left Column - Always visible */}
      <div className="lg:col-span-2">
        <StartMeetingCard 
          onMeetingBooked={refetchMeetings} 
          bookedMeetingsCount={dbUser?.bookedRooms.length} 
        />
        
        {isLoggedIn && (
          <OverviewStats 
            meetings={allMeetings} 
            totalMinutes={dbUser?.user.totalHostMinutes ?? 0}
            maxBookings={dbUser?.user.maxBookings ?? 1}
          />
        )}
      </div>

      {/* Right Column */}
      <div className="lg:col-span-3">
        {isLoggedIn ? (
          <MeetingListCard 
            meetings={allMeetings} 
            onDelete={handleDeleteMeeting} 
          />
        ) : (
          <LoginRequired 
            message="Access Your Dashboard" 
            description="Log in to view your meetings, manage bookings, and access all dashboard features." 
            fullPage={false}
          />
        )}
      </div>
    </div>
  );
};

export default OverviewView;
