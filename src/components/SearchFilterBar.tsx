import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { 
  Search, 
  Filter, 
  Download, 
  X,
  CalendarIcon 
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface FilterOption {
  value: string;
  label: string;
}

interface SearchFilterBarProps {
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  statusOptions?: FilterOption[];
  statusValue?: string;
  onStatusChange?: (value: string) => void;
  dateRange?: { from: Date | undefined; to: Date | undefined };
  onDateRangeChange?: (range: { from: Date | undefined; to: Date | undefined }) => void;
  onExport?: () => void;
  showDateFilter?: boolean;
  extraFilters?: React.ReactNode;
}

const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  searchPlaceholder = 'Search...',
  searchValue,
  onSearchChange,
  statusOptions,
  statusValue,
  onStatusChange,
  dateRange,
  onDateRangeChange,
  onExport,
  showDateFilter = false,
  extraFilters
}) => {
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters = statusValue && statusValue !== 'all' || 
    (dateRange?.from || dateRange?.to);

  const clearFilters = () => {
    onStatusChange?.('all');
    onDateRangeChange?.({ from: undefined, to: undefined });
    onSearchChange('');
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9"
          />
          {searchValue && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => onSearchChange('')}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Filter Toggle */}
        <Button
          variant={showFilters ? 'secondary' : 'outline'}
          size="sm"
          className="gap-1.5 h-9"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-4 w-4" />
          Filter
          {hasActiveFilters && (
            <span className="ml-1 h-2 w-2 rounded-full bg-primary" />
          )}
        </Button>

        {/* Export Button */}
        {onExport && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-9"
            onClick={onExport}
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        )}
      </div>

      {/* Expanded Filters */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/50 animate-slide-up">
          {/* Status Filter */}
          {statusOptions && onStatusChange && (
            <Select value={statusValue || 'all'} onValueChange={onStatusChange}>
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {statusOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Date Filter */}
          {showDateFilter && onDateRangeChange && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-9 gap-1.5 min-w-[200px] justify-start",
                    dateRange?.from && "text-foreground"
                  )}
                >
                  <CalendarIcon className="h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d")}
                      </>
                    ) : (
                      format(dateRange.from, "MMM d, yyyy")
                    )
                  ) : (
                    "Date Range"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={{ from: dateRange?.from, to: dateRange?.to }}
                  onSelect={(range) => onDateRangeChange({ 
                    from: range?.from, 
                    to: range?.to 
                  })}
                  initialFocus
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          )}

          {/* Extra Filters */}
          {extraFilters}

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-1.5 text-muted-foreground"
              onClick={clearFilters}
            >
              <X className="h-3 w-3" />
              Clear
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchFilterBar;
