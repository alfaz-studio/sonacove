import React, { useState } from 'react';
import type { Meeting } from '../types';
import ToggleSwitch from '../../../components/ToggleSwitch';
import MeetingListItem from './MeetingListItem';
import EmptyMeetingList, { type EmptyMeetingListType } from './EmptyMeetingList';

/**
 * Props for the MeetingsPanel component.
 */
interface MeetingsPanelProps {
  /** The combined list of all meetings (upcoming and past). */
  meetings: Meeting[];

  /** The title of the meeting currently being deleted, or null. */
  deletingMeetingId: string | null;

  /** Callback function to handle the deletion of a meeting. */
  onDeleteMeeting: (meeting: Meeting) => void;

  /** Callback function to open the booking modal. */
  onBookMeeting: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

const MeetingsPanel: React.FC<MeetingsPanelProps> = ({
  meetings,
  deletingMeetingId,
  onDeleteMeeting,
  onBookMeeting,
}) => {
  /** State to manage the active filter ('All', 'Upcoming', 'Past'). */
  const [meetingsFilter, setMeetingsFilter] = useState('All');

  /** Derived list of meetings to display based on the current filter. */
  const displayedMeetings = meetings.filter((meeting) => {
    if (meetingsFilter === 'All') return true;
    return meeting.status === meetingsFilter;
  });

  const filterOptions = [
    { label: 'All', value: 'All' },
    { label: 'Upcoming', value: 'Upcoming' },
    { label: 'Past', value: 'Past' },
  ];

  // The main empty state when there are no meetings of any kind.
  if (meetings.length === 0) {
    return (
      <div className='flex flex-col justify-center text-center py-12 min-h-[400px]'>
        <EmptyMeetingList type='none' onButtonClick={onBookMeeting} />
      </div>
    );
  }

  // Render the list view if there are meetings.
  return (
    <div className='text-center sm:text-left h-[400px] flex flex-col'>
      <ToggleSwitch
        options={filterOptions}
        activeOption={meetingsFilter}
        onOptionChange={(option) => setMeetingsFilter(option)}
        className='rounded-full mb-8 flex-shrink-0 w-fit'
      />

      <div className='space-y-6 overflow-y-auto pr-4 h-full'>
        {displayedMeetings.length > 0 ? (
          displayedMeetings.map((meeting, i) => (
            <MeetingListItem
              key={`${meeting.title}-${i}`}
              meeting={meeting}
              isDeleting={deletingMeetingId === meeting.title}
              onDelete={onDeleteMeeting}
            />
          ))
        ) : (
          /* If the filtered list is empty, render the correct EmptyMeetingList based on the filter. */
          <div className='flex items-center justify-center h-full'>
            <EmptyMeetingList
              type={meetingsFilter.toLowerCase() as EmptyMeetingListType}
              onButtonClick={onBookMeeting}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetingsPanel;
