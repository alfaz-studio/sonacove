import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, 
  History, 
  AlertTriangle, 
  CircleCheck, 
  Trash2, 
  Copy,
  Clock,
  Loader2
} from 'lucide-react';
import { format, isAfter } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const MeetingStatusBadge = ({ status }: { status: 'Upcoming' | 'Expired' | 'Past' }) => {
  const styles = {
    Upcoming: "bg-green-100 text-green-800 border-green-200",
    Expired: "bg-yellow-100 text-yellow-800 border-yellow-200",
    Past: "bg-gray-100 text-gray-700 border-gray-200",
  };

  const icons = {
    Upcoming: <CircleCheck className="w-3 h-3" />,
    Expired: <AlertTriangle className="w-3 h-3" />,
    Past: <History className="w-3 h-3" />,
  };

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${styles[status]}`}>
      {icons[status]}
      {status}
    </span>
  );
};

// --- Main Component ---
interface MeetingListItemProps {
  meeting: any;
  onDelete: (id: string) => void;
}

const MeetingListItem: React.FC<MeetingListItemProps> = ({ meeting, onDelete }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDeleting(true);
    // Simulate API call delay
    setTimeout(() => {
      onDelete(meeting.id);
      setIsDeleting(false);
    }, 800);
  };

  const formattedDate = format(new Date(meeting.timestamp), 'MMM d, yyyy');
  const formattedTime = format(new Date(meeting.timestamp), 'h:mm a');
  
  // Logic to determine status
  let status: 'Upcoming' | 'Past' = 'Past';
  if (isAfter(new Date(meeting.timestamp), new Date())) {
    status = 'Upcoming';
  }

  const meetingUrl = `/meet/${meeting.title}`; 

  return (
    <div className={`group flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl border border-gray-100 bg-white hover:border-primary-200 hover:shadow-sm transition-all duration-200 ${isDeleting ? 'opacity-50' : ''}`}>
      {/* Date Box */}
      <div className="flex sm:flex-col items-center sm:items-start gap-2 sm:gap-0 min-w-[100px]">
        <span className="text-sm font-semibold text-gray-900">{formattedDate}</span>
        <span className="text-xs text-gray-500">{formattedTime}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="text-base font-bold text-gray-900 truncate" title={meeting.title}>
            {meeting.title}
          </h4>
          <MeetingStatusBadge status={status} />
        </div>
        <p className="text-xs text-gray-500 truncate flex items-center gap-1">
          <Clock className="h-3 w-3" /> Duration: {Math.floor(meeting.duration)}m
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        {/* Copy Link Button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-primary-500 hover:bg-primary-50">
                <Copy className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy Link</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Delete Button */}
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
        
        {/* Join Button */}
        <Button 
          size="sm" 
          asChild 
          className="ml-2 bg-primary-50 text-primary-600 hover:bg-primary-100 hover:text-primary-700 border-transparent h-8 text-xs font-semibold cursor-pointer shadow-none"
        >
          <a href={meetingUrl}>
            Join
          </a>
        </Button>
      </div>
    </div>
  );
};

export default MeetingListItem;
