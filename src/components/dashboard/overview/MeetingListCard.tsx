"use client"

import React, { useState, useMemo } from 'react';
import { Calendar as CalendarIcon, History } from 'lucide-react';
import { isAfter, isBefore } from 'date-fns';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

import { sampleMeetings } from '@/data/sample-meetings';
import MeetingListItem from './MeetingListItem';

const EmptyState = ({ type }: { type: 'upcoming' | 'past' }) => (
  <div className="flex flex-col items-center justify-center h-full text-center py-10 px-4">
    <div className="h-16 w-16 bg-primary-50 rounded-full flex items-center justify-center mb-4">
      {type === 'upcoming' ? <CalendarIcon className="h-8 w-8 text-primary-300" /> : <History className="h-8 w-8 text-primary-300" />}
    </div>
    <h3 className="text-lg font-semibold text-gray-900">No {type} meetings</h3>
    <p className="text-sm text-gray-500 max-w-xs mx-auto">
      {type === 'upcoming' 
        ? "You don't have any upcoming sessions scheduled. Use the form to book one!" 
        : "You haven't attended any meetings yet."}
    </p>
  </div>
);

const MeetingListCard = () => {
  const [meetings, setMeetings] = useState(sampleMeetings);

  const handleDeleteMeeting = (id: string) => {
    setMeetings(prev => prev.filter(m => m.id !== id));
  };

  const { upcoming, past } = useMemo(() => {
    const now = new Date();
    return {
      upcoming: meetings.filter(m => isAfter(new Date(m.timestamp), now)),
      past: meetings.filter(m => isBefore(new Date(m.timestamp), now))
    };
  }, [meetings]);

  const tabTriggerClass = "rounded-none border-b-2 border-transparent px-4 pb-2 pt-1 font-semibold text-muted-foreground hover:text-foreground data-[state=active]:border-primary-500 data-[state=active]:text-primary-500 data-[state=active]:shadow-none bg-transparent";

  return (
    <Card className="border-border shadow-sm h-full flex flex-col bg-white">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-gray-900">My Meetings</CardTitle>
        </div>
        <CardDescription>Manage your scheduled and past sessions.</CardDescription>
      </CardHeader>
      
      <CardContent className="flex-1 min-h-0">
        <Tabs defaultValue="upcoming" className="w-full h-full flex flex-col">
          <TabsList className="w-full justify-start bg-transparent p-0 border-b border-gray-100 mb-4 rounded-none h-auto">
            <TabsTrigger value="upcoming" className={tabTriggerClass}>
              Upcoming
              <Badge className="ml-2 bg-primary-100 text-primary-700 hover:bg-primary-100 border-none h-5 px-1.5">
                {upcoming.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="past" className={tabTriggerClass}>
              Past History
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 relative min-h-[400px]">
            <TabsContent value="upcoming" className="absolute inset-0 m-0">
              <ScrollArea className="h-full pr-4">
                {upcoming.length > 0 ? (
                  <div className="space-y-3 pb-4">
                    {upcoming.map((meeting) => (
                      <MeetingListItem key={meeting.id} meeting={meeting} onDelete={handleDeleteMeeting} />
                    ))}
                  </div>
                ) : (
                  <EmptyState type="upcoming" />
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="past" className="absolute inset-0 m-0">
              <ScrollArea className="h-full pr-4">
                {past.length > 0 ? (
                  <div className="space-y-3 pb-4">
                    {past.map((meeting) => (
                      <MeetingListItem key={meeting.id} meeting={meeting} onDelete={handleDeleteMeeting} />
                    ))}
                  </div>
                ) : (
                  <EmptyState type="past" />
                )}
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default MeetingListCard;
