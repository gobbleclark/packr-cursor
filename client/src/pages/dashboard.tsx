import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import DateFilter from "@/components/dashboard/date-filter";
import EnhancedStatsCards from "@/components/dashboard/enhanced-stats-cards";
import RecentActivity from "@/components/dashboard/recent-activity";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleDateRangeChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none">
          {/* Dashboard Header */}
          <div className="bg-white shadow-sm border-b border-gray-200">
            <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
              <div className="md:flex md:items-center md:justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                    3PL Dashboard
                  </h2>
                  <div className="mt-1 flex flex-col sm:flex-row sm:flex-wrap sm:mt-0 sm:space-x-6">
                    <div className="mt-2 flex items-center text-sm text-gray-500">
                      <i className="fas fa-calendar-alt mr-1"></i>
                      <span>Live data from database</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex md:mt-0 md:ml-4">
                  <DateFilter onDateRangeChange={handleDateRangeChange} />
                </div>
              </div>
            </div>
          </div>

          {/* Dashboard Content */}
          <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            {startDate && endDate && (
              <EnhancedStatsCards startDate={startDate} endDate={endDate} />
            )}
            <div className="mt-8">
              <RecentActivity />
            </div>
          </div>
        </main>
    </div>
  );
}
