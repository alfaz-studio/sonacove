"use client"

import React, { useMemo } from 'react';
import { Calendar as CalendarIcon, History, Lock } from 'lucide-react';
import { isAfter, isBefore } from 'date-fns';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { useAuth } from '@/hooks/useAuth';
import MeetingListItem from './MeetingListItem';

export interface Meeting {
  id: string;
  title: string;
  timestamp: Date | string | number;
  duration: number | string;
}

interface MeetingListCardProps {
  meetings: Meeting[]; 
  onDelete: (id: string) => void;
}

const EmptyState = ({ type }: { type: 'reserved' | 'past' }) => (
  <div className="flex flex-col items-center justify-center h-full text-center py-10 px-4">
    <div className="h-16 w-16 bg-primary-50 rounded-full flex items-center justify-center mb-4">
      {type === 'reserved' ? <CalendarIcon className="h-8 w-8 text-primary-300" /> : <History className="h-8 w-8 text-primary-300" />}
    </div>
    <h3 className="text-xl font-semibold text-gray-900">No {type === 'reserved' ? 'reserved' : type} meetings</h3>
    <p className="text-base text-gray-500 max-w-xs mx-auto">
      {type === 'reserved' 
        ? "You don't have any reserved meeting rooms." 
        : "You haven't attended any meetings yet."}
    </p>
  </div>
);

const MeetingListCard: React.FC<MeetingListCardProps> = ({ meetings, onDelete }) => {
  const { isLoggedIn, login } = useAuth();
  
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
          <CardTitle className="text-2xl font-bold text-gray-900">My Meetings</CardTitle>
        </div>
        <CardDescription>Manage your reserved rooms and past sessions.</CardDescription>
      </CardHeader>
      
      <CardContent className="flex-1 min-h-0 pr-3">
        {!isLoggedIn ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12 px-4 min-h-[400px]">
            <div className="h-16 w-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <Lock className="h-8 w-8 text-gray-300" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">Login Required</h3>
            <p className="text-base text-gray-500 max-w-xs mx-auto mb-6">
              Please log in to view your reserved rooms and history.
            </p>
            <Button variant="outline" onClick={login}>
              Log In
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="reserved" className="w-full h-full flex flex-col">
            <TabsList className="w-full justify-start bg-transparent p-0 border-b border-gray-100 mb-4 rounded-none h-auto">
              <TabsTrigger value="reserved" className={tabTriggerClass}>
                Reserved
                <Badge className="ml-2 bg-primary-100 text-primary-700 hover:bg-primary-100 border-none h-5 px-1.5">
                  {upcoming.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="past" className={tabTriggerClass}>
                Past History
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 relative min-h-[400px]">
              <TabsContent value="reserved" className="absolute inset-0 m-0">
                <ScrollArea className="h-full">
                  {upcoming.length > 0 ? (
                    <div className="space-y-3 pb-4">
                      {upcoming.map((meeting) => (
                        <MeetingListItem key={meeting.id} meeting={meeting} onDelete={onDelete} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState type="reserved" />
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="past" className="absolute inset-0 m-0">
                <ScrollArea className="h-full">
                  {past.length > 0 ? (
                    <div className="space-y-3 pb-4">
                      {past.map((meeting) => (
                        <MeetingListItem key={meeting.id} meeting={meeting} onDelete={onDelete} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState type="past" />
                  )}
                </ScrollArea>
              </TabsContent>
            </div>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};

export default MeetingListCard;
