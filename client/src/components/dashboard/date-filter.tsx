import React, { useState } from "react";
import { Calendar, CalendarDays, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DateFilterProps {
  onDateRangeChange: (startDate: string, endDate: string) => void;
  defaultRange?: string;
}

export default function DateFilter({ onDateRangeChange, defaultRange = "30" }: DateFilterProps) {
  const [selectedRange, setSelectedRange] = useState(defaultRange);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [isCustom, setIsCustom] = useState(false);

  const getDateRange = (range: string) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (range) {
      case "today":
        return {
          start: today.toISOString(),
          end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString()
        };
      case "yesterday":
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        return {
          start: yesterday.toISOString(),
          end: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString()
        };
      case "7":
        return {
          start: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          end: now.toISOString()
        };
      case "30":
        return {
          start: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          end: now.toISOString()
        };
      default:
        return {
          start: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          end: now.toISOString()
        };
    }
  };

  const handleRangeChange = (range: string) => {
    setSelectedRange(range);
    if (range === "custom") {
      setIsCustom(true);
      return;
    }
    
    setIsCustom(false);
    const dateRange = getDateRange(range);
    onDateRangeChange(dateRange.start, dateRange.end);
  };

  const handleCustomDateSubmit = () => {
    if (customStart && customEnd) {
      const startDate = new Date(customStart).toISOString();
      const endDate = new Date(new Date(customEnd).getTime() + 24 * 60 * 60 * 1000 - 1).toISOString();
      onDateRangeChange(startDate, endDate);
    }
  };

  // Initialize with default range
  React.useEffect(() => {
    const dateRange = getDateRange(defaultRange);
    onDateRangeChange(dateRange.start, dateRange.end);
  }, []);

  return (
    <div className="flex items-center space-x-4">
      <div className="flex items-center space-x-2">
        <CalendarDays className="h-4 w-4 text-gray-500" />
        <Label htmlFor="date-range" className="text-sm font-medium">
          Date Range:
        </Label>
      </div>
      
      <Select value={selectedRange} onValueChange={handleRangeChange}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Select range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="yesterday">Yesterday</SelectItem>
          <SelectItem value="7">Last 7 days</SelectItem>
          <SelectItem value="30">Last 30 days</SelectItem>
          <SelectItem value="custom">Custom range</SelectItem>
        </SelectContent>
      </Select>

      {isCustom && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Calendar className="h-4 w-4 mr-2" />
              Custom Dates
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </div>
              <Button onClick={handleCustomDateSubmit} className="w-full">
                Apply Custom Range
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}