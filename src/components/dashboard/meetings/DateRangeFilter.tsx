"use client"

import * as React from "react"
import { format, subDays, startOfMonth, endOfMonth, startOfDay, endOfDay, subMonths } from "date-fns"
import { Calendar as CalendarIcon, ChevronDown, X } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { cn } from "@/components/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"

interface DateRangeFilterProps {
  dateRange: DateRange | undefined
  onDateRangeChange: (range: DateRange | undefined) => void
  className?: string
}

type PresetValue = 
  | "today"
  | "yesterday" 
  | "last7days" 
  | "last30days" 
  | "thisMonth" 
  | "lastMonth"
  | "custom"

const presets: { label: string; value: PresetValue; getRange: () => DateRange }[] = [
  {
    label: "Today",
    value: "today",
    getRange: () => ({
      from: startOfDay(new Date()),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: "Yesterday",
    value: "yesterday",
    getRange: () => ({
      from: startOfDay(subDays(new Date(), 1)),
      to: endOfDay(subDays(new Date(), 1)),
    }),
  },
  {
    label: "Last 7 days",
    value: "last7days",
    getRange: () => ({
      from: startOfDay(subDays(new Date(), 6)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: "Last 30 days",
    value: "last30days",
    getRange: () => ({
      from: startOfDay(subDays(new Date(), 29)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: "This month",
    value: "thisMonth",
    getRange: () => ({
      from: startOfMonth(new Date()),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: "Last month",
    value: "lastMonth",
    getRange: () => ({
      from: startOfMonth(subMonths(new Date(), 1)),
      to: endOfMonth(subMonths(new Date(), 1)),
    }),
  },
]

export function DateRangeFilter({
  dateRange,
  onDateRangeChange,
  className,
}: DateRangeFilterProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [selectedPreset, setSelectedPreset] = React.useState<PresetValue | null>(null)
  const [startTime, setStartTime] = React.useState("00:00")
  const [endTime, setEndTime] = React.useState("23:59")
  const [tempRange, setTempRange] = React.useState<DateRange | undefined>(dateRange)

  // Detect current preset based on dateRange
  React.useEffect(() => {
    if (!dateRange?.from || !dateRange?.to) {
      setSelectedPreset(null)
      return
    }
    
    // Check if current range matches any preset
    const matchedPreset = presets.find(preset => {
      const presetRange = preset.getRange()
      return (
        presetRange.from?.getTime() === dateRange.from?.getTime() &&
        presetRange.to?.getTime() === dateRange.to?.getTime()
      )
    })
    
    setSelectedPreset(matchedPreset?.value || "custom")
  }, [dateRange])

  const handlePresetSelect = (value: string) => {
    const preset = presets.find(p => p.value === value)
    if (preset) {
      const range = preset.getRange()
      setTempRange(range)
      setSelectedPreset(preset.value)
    }
  }

  const handleApply = () => {
    if (tempRange?.from && tempRange?.to) {
      // Apply time to the date range
      const [startHour, startMin] = startTime.split(":").map(Number)
      const [endHour, endMin] = endTime.split(":").map(Number)
      
      const from = new Date(tempRange.from)
      from.setHours(startHour, startMin, 0, 0)
      
      const to = new Date(tempRange.to)
      to.setHours(endHour, endMin, 59, 999)
      
      onDateRangeChange({ from, to })
    } else {
      onDateRangeChange(tempRange)
    }
    setIsOpen(false)
  }

  const handleClear = () => {
    setTempRange(undefined)
    onDateRangeChange(undefined)
    setSelectedPreset(null)
    setStartTime("00:00")
    setEndTime("23:59")
    setIsOpen(false)
  }

  const getDisplayText = () => {
    if (!dateRange?.from) {
      return "Select date range"
    }
    
    if (selectedPreset && selectedPreset !== "custom") {
      const preset = presets.find(p => p.value === selectedPreset)
      return preset?.label || "Select date range"
    }
    
    if (dateRange.to) {
      return `${format(dateRange.from, "MMM d, yyyy")} - ${format(dateRange.to, "MMM d, yyyy")}`
    }
    
    return format(dateRange.from, "MMM d, yyyy")
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start text-left font-normal min-w-[240px]",
            !dateRange && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {getDisplayText()}
          {dateRange?.from && (
            <X 
              className="ml-auto h-4 w-4 hover:text-destructive" 
              onClick={(e) => {
                e.stopPropagation()
                handleClear()
              }}
            />
          )}
          {!dateRange?.from && <ChevronDown className="ml-auto h-4 w-4" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          {/* Presets sidebar */}
          <div className="border-r p-3 space-y-1 w-[140px]">
            <p className="text-xs font-medium text-muted-foreground mb-2">Quick Select</p>
            {presets.map((preset) => (
              <Button
                key={preset.value}
                // CHANGED: Use ghost variant but override styles for selected state using cn()
                variant="ghost"
                size="sm"
                className={cn(
                  "w-full justify-start text-sm hover:bg-primary-50 hover:text-primary-700", // Hover effect
                  selectedPreset === preset.value && "bg-primary-50 text-primary-700 font-medium" // Selected state
                )}
                onClick={() => handlePresetSelect(preset.value)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          
          {/* Calendar and time inputs */}
          <div className="p-3">
            <Calendar
              mode="range"
              defaultMonth={tempRange?.from}
              selected={tempRange}
              onSelect={(range) => {
                setTempRange(range)
                setSelectedPreset("custom")
              }}
              numberOfMonths={2}
              className="rounded-md"
            />
            
            <Separator className="my-3" />
            
            {/* Time inputs */}
            <div className="flex items-center gap-4 px-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="start-time" className="text-xs text-muted-foreground">
                  Start time
                </Label>
                <Input
                  id="start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-[120px] h-8 focus-visible:ring-primary-500" // Added focus ring
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="end-time" className="text-xs text-muted-foreground">
                  End time
                </Label>
                <Input
                  id="end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-[120px] h-8 focus-visible:ring-primary-500" // Added focus ring
                />
              </div>
            </div>
            
            <Separator className="my-3" />
            
            {/* Action buttons */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={handleClear}>
                Clear
              </Button>
              <Button className="bg-primary-500 text-white hover:bg-primary-600" size="sm" onClick={handleApply}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
