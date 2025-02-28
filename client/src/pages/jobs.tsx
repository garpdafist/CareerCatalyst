import { useQuery } from "@tanstack/react-query";
import { JobCard } from "@/components/job-card";
import { JobFilters } from "@/components/job-filters";
import { useState } from "react";
import type { Job } from "@shared/schema";

export default function Jobs() {
  const [filters, setFilters] = useState({
    search: "",
    location: "",
    category: "",
  });

  const { data: jobs, isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const filteredJobs = jobs?.filter((job) => {
    const matchesSearch =
      !filters.search ||
      job.title.toLowerCase().includes(filters.search.toLowerCase()) ||
      job.company.toLowerCase().includes(filters.search.toLowerCase());

    const matchesLocation =
      !filters.location || job.location.toLowerCase().includes(filters.location.toLowerCase());

    const matchesCategory =
      !filters.category || job.category.toLowerCase() === filters.category.toLowerCase();

    return matchesSearch && matchesLocation && matchesCategory;
  });

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        Loading...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-8">Available Jobs</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1">
          <JobFilters onFilterChange={setFilters} />
        </div>
        
        <div className="lg:col-span-3">
          <div className="space-y-6">
            {filteredJobs?.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
