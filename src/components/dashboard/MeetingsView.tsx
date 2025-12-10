"use client"

import React, { useState, useMemo } from 'react';
import type { VisibilityState } from "@tanstack/react-table"
import type { DateRange } from "react-day-picker"
import type { User } from '@/data/dashboard-types';
import type { MeetingMetaData } from '@/data/meeting-types';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { fetchMeetings } from '@/utils/api';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Search, Filter, X, Clock, Users, Video, HardDrive } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { DataTable } from './meetings/meeting-datatable';
import { columns } from './meetings/columns';
import { DateRangeFilter } from './meetings/DateRangeFilter';
import { ColumnToggle } from './meetings/ColumnToggle';
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";
import LoginRequired from './LoginRequired';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { format } from 'date-fns';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getExpandedRowModel,
  type SortingState,
  type ColumnFiltersState,
  type ExpandedState,
} from "@tanstack/react-table"
import { useAuth } from '@/hooks/useAuth';

interface MeetingsViewProps {
  user: User;
}

const MeetingsView: React.FC<MeetingsViewProps> = ({ user }) => {
  const { isLoggedIn, getAccessToken } = useAuth();

  if (!isLoggedIn) {
    return (
      <LoginRequired 
        message="Access Your Meetings" 
        description="Please log in to view detailed analytics, recordings, and meeting history." 
      />
    );
  }

  // Search and filter state
  const [globalFilter, setGlobalFilter] = useState('');
  // Default to last 7 days
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(subDays(new Date(), 6)),
    to: endOfDay(new Date()),
  });

  // Fetch meetings from API
  const token = getAccessToken();
  const { data: meetingsData = [], isLoading, error } = useQuery({
    queryKey: ['meetings', dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      if (!token) {
        throw new Error('No access token available');
      }
      return fetchMeetings(token, dateRange?.from, dateRange?.to);
    },
    enabled: !!token && isLoggedIn,
  });
  const [isHostFilter, setIsHostFilter] = useState(false);
  const [participantSizeFilter, setParticipantSizeFilter] = useState<string>('');
  const [ongoingFilter, setOngoingFilter] = useState(false);
  // Hide artifacts column by default
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    artifacts: false,
  });

  // Table state for ColumnToggle component
  const [sorting, setSorting] = useState<SortingState>([
    { id: "timestamp", desc: true }
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState({});
  const [expanded, setExpanded] = useState<ExpandedState>({});

  // Apply "I am host" filter
  React.useEffect(() => {
    if (isHostFilter) {
      setColumnFilters((prev) => {
        const otherFilters = prev.filter((f) => f.id !== "isHost")
        return [...otherFilters, { id: "isHost", value: true }]
      })
    } else {
      setColumnFilters((prev) => prev.filter((f) => f.id !== "isHost"))
    }
  }, [isHostFilter, user.email])

  // Apply participant size filter
  React.useEffect(() => {
    if (participantSizeFilter) {
      if (participantSizeFilter === '6+') {
        // For 6+, filter for meetings with 6 or more participants
        setColumnFilters((prev) => {
          const otherFilters = prev.filter((f) => f.id !== "participantSize")
          return [...otherFilters, { id: "participantSize", value: '6+' }]
        })
      } else {
        const size = parseInt(participantSizeFilter, 10)
        if (!isNaN(size)) {
          setColumnFilters((prev) => {
            const otherFilters = prev.filter((f) => f.id !== "participantSize")
            return [...otherFilters, { id: "participantSize", value: size }]
          })
        } else {
          setColumnFilters((prev) => prev.filter((f) => f.id !== "participantSize"))
        }
      }
    } else {
      setColumnFilters((prev) => prev.filter((f) => f.id !== "participantSize"))
    }
  }, [participantSizeFilter])

  // Apply ongoing filter
  React.useEffect(() => {
    if (ongoingFilter) {
      setColumnFilters((prev) => {
        const otherFilters = prev.filter((f) => f.id !== "ongoing")
        return [...otherFilters, { id: "ongoing", value: true }]
      })
    } else {
      setColumnFilters((prev) => prev.filter((f) => f.id !== "ongoing"))
    }
  }, [ongoingFilter])

  // Apply date range filter
  React.useEffect(() => {
    if (dateRange?.from || dateRange?.to) {
      setColumnFilters((prev) => {
        const otherFilters = prev.filter((f) => f.id !== "timestamp")
        return [...otherFilters, { id: "timestamp", value: dateRange }]
      })
    } else {
      setColumnFilters((prev) => prev.filter((f) => f.id !== "timestamp"))
    }
  }, [dateRange])

  // Get base meetings filtered by role (this is the base dataset for both analytics and table)
  // This must be defined before the table instance
  const baseMeetings = useMemo(() => {
    // Cast the API response to MeetingMetaData[]
    let result: MeetingMetaData[] = (meetingsData as MeetingMetaData[]) || [];

    // Apply role-based filtering
    if (user.role === 'teacher') {
      result = result.filter(m => {
        // Check if user is in hosts array or email field (for backward compatibility)
        const hosts = m.hosts || (m.email ? [m.email] : []);
        return hosts.includes(user.email);
      });
    } else if (user.role === 'student') {
      result = result.filter(m => 
        m.participants.some((p: string) => p === user.email)
      );
    }
    // Owner and admin see all meetings

    return result;
  }, [meetingsData, user]);

  // Create table instance for ColumnToggle
  const table = useReactTable({
    data: baseMeetings,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onExpandedChange: setExpanded,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      expanded,
      globalFilter,
    },
    globalFilterFn: (row, columnId, filterValue) => {
      const searchValue = String(filterValue).toLowerCase()
      
      const title = String(row.getValue("title") || "").toLowerCase()
      if (title.includes(searchValue)) return true
      
      const hostName = String(row.getValue("hostName") || "").toLowerCase()
      if (hostName.includes(searchValue)) return true
      
      const email = String(row.original.email || "").toLowerCase()
      if (email.includes(searchValue)) return true
      
      const participants = row.original.participants || []
      if (participants.some((p: string) => p.toLowerCase().includes(searchValue))) return true
      
      return false
    },
  })

  // Active filter count
  const activeFilterCount = [
    dateRange?.from ? 1 : 0,
    isHostFilter ? 1 : 0,
    participantSizeFilter ? 1 : 0,
    ongoingFilter ? 1 : 0,
    globalFilter ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const clearAllFilters = () => {
    setGlobalFilter('');
    setDateRange({
      from: startOfDay(subDays(new Date(), 6)),
      to: endOfDay(new Date()),
    });
    setIsHostFilter(false);
    setParticipantSizeFilter('');
    setOngoingFilter(false);
  };

  // Get filtered meetings based on all filters (for analytics)
  const filteredMeetings = useMemo(() => {
    let result: MeetingMetaData[] = baseMeetings;

    // Apply isHost filter
    if (isHostFilter) {
      result = result.filter(row => {
        // Check if user is in hosts array or email field (for backward compatibility)
        const hosts = row.hosts || (row.email ? [row.email] : []);
        return hosts.includes(user.email);
      });
    }

    // Apply participantSize filter
    if (participantSizeFilter) {
      if (participantSizeFilter === '6+') {
        result = result.filter(row => row.participantCount >= 6);
      } else {
        const size = parseInt(participantSizeFilter, 10);
        if (!isNaN(size)) {
          result = result.filter(row => row.participantCount === size);
        }
      }
    }

    // Apply ongoing filter
    if (ongoingFilter) {
      result = result.filter(row => row.status === "in_progress");
    }

    // Apply date range filter
    if (dateRange?.from || dateRange?.to) {
      result = result.filter(m => {
        const meetingDate = new Date(m.timestamp);
        if (dateRange.from && meetingDate < dateRange.from) return false;
        if (dateRange.to && meetingDate > dateRange.to) return false;
        return true;
      });
    }

    // Apply global search filter
    if (globalFilter) {
      const searchValue = globalFilter.toLowerCase();
      result = result.filter(m => {
        const title = (m.title || "").toLowerCase();
        const hostName = (m.hostName || "").toLowerCase();
        const email = (m.email || "").toLowerCase();
        const participants = m.participants || [];
        
        return (
          title.includes(searchValue) ||
          hostName.includes(searchValue) ||
          email.includes(searchValue) ||
          participants.some((p: string) => p.toLowerCase().includes(searchValue))
        );
      });
    }

    return result;
  }, [baseMeetings, isHostFilter, participantSizeFilter, ongoingFilter, dateRange, globalFilter, user.email]);

  // Calculate analytics from filtered meetings
  const analytics = useMemo(() => {
    const totalMinutes = filteredMeetings.reduce((acc, m) => acc + m.duration, 0);
    const totalMeetings = filteredMeetings.length;
    const avgParticipants = totalMeetings > 0
      ? Math.round(filteredMeetings.reduce((acc, m) => acc + m.participantCount, 0) / totalMeetings)
      : 0;
    
    // Calculate storage from recordings (in GB)
    const totalStorageBytes = filteredMeetings.reduce((acc: number, m) => {
      return acc + m.recordings.reduce((recAcc: number, rec) => recAcc + (rec?.size || 0), 0);
    }, 0);
    const totalStorageGB = totalStorageBytes / (1024 * 1024 * 1024);

    // Group by day for line chart
    const dailyData: Record<string, number> = {};
    
    filteredMeetings.forEach(meeting => {
      const dayKey = format(new Date(meeting.timestamp), 'yyyy-MM-dd');
      if (!dailyData[dayKey]) {
        dailyData[dayKey] = 0;
      }
      dailyData[dayKey] += meeting.participantCount;
    });

    // Convert to array and sort by date
    const chartData = Object.entries(dailyData)
      .map(([date, participants]) => ({
        date,
        participants,
        displayDate: format(new Date(date), 'MMM d'),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalMinutes,
      totalMeetings,
      avgParticipants,
      totalStorageGB,
      chartData,
    };
  }, [filteredMeetings]);

  const chartConfig = {
    participants: {
      label: "Participants",
      color: "#f05023",
    },
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading meetings...</div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-600">Error loading meetings: {error instanceof Error ? error.message : 'Unknown error'}</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Analytics Section */}
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-white shadow-sm border-accent-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Meetings</CardTitle>
              <Video className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{analytics.totalMeetings}</div>
              <p className="text-xs text-muted-foreground">
                {dateRange?.from && dateRange?.to
                  ? `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d')}`
                  : 'All time'}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-sm border-accent-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Minutes</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{analytics.totalMinutes.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {dateRange?.from && dateRange?.to
                  ? `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d')}`
                  : 'All time'}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-sm border-accent-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Participants</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{analytics.avgParticipants}</div>
              <p className="text-xs text-muted-foreground">
                Per meeting average
              </p>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-sm border-accent-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{analytics.totalStorageGB.toFixed(2)} GB</div>
              <p className="text-xs text-muted-foreground">
                From recordings
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <Card className="bg-white shadow-sm border-accent-200">
          <CardHeader>
            <CardTitle className="text-gray-900">Meeting Activity</CardTitle>
            <CardDescription>Total participants per day over the selected time period.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <LineChart accessibilityLayer data={analytics.chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6e6e6" />
                <XAxis
                  dataKey="displayDate"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tick={{ fill: '#666666' }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  width={50}
                  tick={{ fill: '#666666' }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="participants"
                  stroke="#f05023"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6, fill: "#f05023" }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Meetings Table Section */}
      <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-col gap-4 bg-white p-4 rounded-lg border border-accent-200 shadow-sm">
        {/* Top row: Search and primary actions */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Search Input */}
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search meetings, hosts, participants..."
              className="pl-9 pr-9"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
            />
            {globalFilter && (
              <button 
                onClick={() => setGlobalFilter('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <ColumnToggle table={table} />
          </div>
        </div>

        {/* Bottom row: Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Range Filter */}
          <DateRangeFilter
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />

          {/* Participant size filter */}
          <div className="flex items-center gap-2">
            <Label htmlFor="participant-size" className="text-sm text-muted-foreground whitespace-nowrap">
              Participants:
            </Label>
            <Select
              value={participantSizeFilter}
              onValueChange={(value) => setParticipantSizeFilter(value === 'all' ? '' : value)}
            >
              <SelectTrigger id="participant-size" className="w-[100px] h-9 focus:ring-primary-500">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="6+">6+</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Ongoing filter */}
          <div className="flex items-center space-x-2 border rounded-md px-3 py-1.5 h-9">
            <Checkbox
              id="ongoing"
              checked={ongoingFilter}
              onCheckedChange={(checked) => setOngoingFilter(checked === true)}
              className="border-accent-300 data-[state=checked]:bg-primary-500 data-[state=checked]:border-primary-500 focus-visible:ring-primary-500"
            />
            <Label
              htmlFor="ongoing"
              className="text-sm font-normal cursor-pointer"
            >
              Ongoing
            </Label>
          </div>

          {/* I am host filter */}
          <div className="flex items-center space-x-2 border rounded-md px-3 py-1.5 h-9">
            <Checkbox
              id="is-host"
              checked={isHostFilter}
              onCheckedChange={(checked) => setIsHostFilter(checked === true)}
              className="border-accent-300 data-[state=checked]:bg-primary-500 data-[state=checked]:border-primary-500 focus-visible:ring-primary-500"
            />
            <Label
              htmlFor="is-host"
              className="text-sm font-normal cursor-pointer"
            >
              Hosted by me
            </Label>
          </div>

          {/* Active filters indicator */}
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <Badge variant="secondary" className="gap-1 bg-primary-50 text-primary-700 hover:bg-primary-100">
                <Filter className="h-3 w-3" />
                {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-7 text-xs hover:text-primary-600 hover:bg-primary-50"
              >
                Clear all
              </Button>
            </div>
          )}
        </div>
      </div>

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={baseMeetings}
          globalFilter={globalFilter}
          onGlobalFilterChange={setGlobalFilter}
          dateRange={dateRange}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
          columnFilters={columnFilters}
          user={user}
        />
      </div>
    </div>
  );
};

export default MeetingsView;
