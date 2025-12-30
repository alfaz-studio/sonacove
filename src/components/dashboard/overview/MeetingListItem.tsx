"use client"

import React, { useState } from 'react';
import { 
  AlertTriangle, 
  CircleCheck, 
  Trash2, 
  Clock,
  Loader2,
  Calendar,
  MoreVertical,
  ExternalLink,
  Copy,
} from 'lucide-react';
import { format, isAfter } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import type { Meeting } from './MeetingListCard';
import { formatDurationMs } from '@/components/lib/utils';
import CopyIcon from '@/components/CopyIcon';
import ScheduleMeetingDialog from './ScheduleMeetingDialog';

const MeetingStatusBadge = ({ status }: { status: 'Reserved' | 'Expired' | 'Past' }) => {
  if (status === 'Past') return;

  const styles = {
    Reserved: "bg-green-100 text-green-800 border-green-200",
    Expired: "bg-yellow-100 text-yellow-800 border-yellow-200",
  };

  const icons = {
    Reserved: <CircleCheck className="w-3 h-3" />,
    Expired: <AlertTriangle className="w-3 h-3" />,
  };

  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-2.5 py-0.5 mr-3 rounded-full border ${styles[status]}`}>
      {icons[status]}
      {status}
    </span>
  );
};

interface MeetingListItemProps {
  meeting: Meeting; 
  onDelete: (id: string) => void;
}

const MeetingListItem: React.FC<MeetingListItemProps> = ({ meeting, onDelete }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDeleting(true);
    setTimeout(() => {
      onDelete(meeting.id);
      setIsDeleting(false);
    }, 800);
  };

  const dateObj = new Date(meeting.timestamp);
  const formattedDate = format(dateObj, 'MMM d, yyyy');
  const formattedTime = format(dateObj, 'h:mm a');
  
  let status: 'Reserved' | 'Past' = 'Past';
  if (isAfter(dateObj, new Date())) {
    status = 'Reserved';
  }

  const meetingUrl = `/meet/${meeting.title}`; 
  const fullUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}${meetingUrl}`;
  const isReservedRoom = status === 'Reserved';

  return (
    <div className={`group flex flex-col 2xl:flex-row items-start 2xl:items-center gap-2 2xl:gap-4 p-3 2xl:p-4 rounded-xl border border-gray-100 bg-white transition-all duration-200 w-full overflow-hidden ${isDeleting ? 'opacity-50 pointer-events-none' : 'hover:border-primary-200 hover:shadow-sm'}`}>
      
      {/* Date Box */}
      <div className="flex flex-row sm:flex-row 2xl:flex-col items-center 2xl:items-start justify-between sm:justify-start gap-2 2xl:gap-0 w-full sm:w-auto 2xl:w-24 2xl:min-w-[100px] flex-shrink-0">
        <div className="flex flex-row 2xl:flex-col gap-1 2xl:gap-0 items-center 2xl:items-start min-w-0">
          <span className="text-sm 2xl:text-base font-semibold text-gray-900 whitespace-nowrap">{formattedDate}</span>
          <span className="text-sm 2xl:text-base text-gray-500 whitespace-nowrap">{formattedTime}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="2xl:hidden flex-shrink-0">
            <MeetingStatusBadge status={status} />
          </div>
          {/* Mobile Only - Dropdown Menu */}
          <div className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-gray-400 hover:text-gray-600"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.preventDefault();
                    navigator.clipboard.writeText(fullUrl);
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Link
                </DropdownMenuItem>
                {isReservedRoom && (
                  <DropdownMenuItem onClick={() => setIsScheduleDialogOpen(true)}>
                    <Calendar className="mr-2 h-4 w-4" />
                    Schedule
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <a href={meetingUrl} className="flex items-center">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Join
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-red-600 focus:text-red-600"
                >
                  {isDeleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Info Section */}
      <div className="flex-1 min-w-0 w-full 2xl:w-auto">
        <div className="flex flex-col 2xl:flex-row items-start 2xl:items-center gap-1 2xl:gap-2 mb-1 min-w-0">
          <h4 className="text-sm 2xl:text-lg font-bold text-gray-900 truncate overflow-hidden max-w-full" title={meeting.title}>
            {meeting.title}
          </h4>
          <div className="hidden 2xl:block flex-shrink-0">
            <MeetingStatusBadge status={status} />
          </div>
        </div>
        {status === 'Past' ? (
          <p className="text-base text-gray-500 truncate flex items-center gap-1">
            <Clock className="h-4 w-4" /> Duration: {formatDurationMs(Number(meeting.duration))}
          </p>
        ) : (
          <p className="text-sm text-gray-500 truncate flex items-center gap-1 invisible">
            <Clock className="h-3 w-3" /> Duration: 00:00
          </p>
        )}
      </div>

      {/* Actions Section - Medium screens (row below) and 2xl screens (inline) */}
      <div className="hidden sm:flex flex-wrap items-center justify-start 2xl:justify-end w-full 2xl:w-auto mt-2 pt-3 border-t border-gray-100 2xl:border-0 2xl:mt-0 2xl:pt-0 2xl:ml-auto gap-2 flex-shrink-0">
        {/* Copy & Delete */}
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="inline-flex"> 
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-primary-500 hover:bg-primary-50">
                    <CopyIcon textToCopy={fullUrl} />
                  </Button>
                </div>
              </TooltipTrigger>
              <TooltipContent>Copy Link</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        {/* Schedule Button - Only for reserved rooms */}
        {isReservedRoom && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsScheduleDialogOpen(true)}
                  className="bg-white text-gray-700 hover:bg-gray-50 border-gray-200 h-9 text-sm font-semibold px-4"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule
                </Button>
              </TooltipTrigger>
              <TooltipContent>Schedule this meeting in your calendar</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Desktop Join Button */}
        <Button 
          size="sm" 
          asChild 
          className="bg-primary-50 text-primary-600 hover:bg-primary-100 hover:text-primary-700 border-transparent h-9 text-sm font-semibold cursor-pointer shadow-none px-4"
        >
          <a href={meetingUrl} className="flex items-center gap-2">
            Join
          </a>
        </Button>
      </div>

      {/* Schedule Meeting Dialog */}
      {isReservedRoom && (
        <ScheduleMeetingDialog
          open={isScheduleDialogOpen}
          onOpenChange={setIsScheduleDialogOpen}
          roomName={meeting.title}
          meetingUrl={fullUrl}
        />
      )}
    </div>
  );
};

export default MeetingListItem;
