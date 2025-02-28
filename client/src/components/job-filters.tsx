import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface JobFiltersProps {
  onFilterChange: (filters: {
    search: string;
    location: string;
    category: string;
  }) => void;
}

export function JobFilters({ onFilterChange }: JobFiltersProps) {
  return (
    <div className="space-y-4 p-4 bg-card rounded-lg">
      <div className="space-y-2">
        <Label htmlFor="search">Search Jobs</Label>
        <Input
          id="search"
          placeholder="Search by title or company..."
          onChange={(e) =>
            onFilterChange({ search: e.target.value, location: "", category: "" })
          }
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Select onValueChange={(value) => 
          onFilterChange({ search: "", location: value, category: "" })
        }>
          <SelectTrigger>
            <SelectValue placeholder="Select location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="remote">Remote</SelectItem>
            <SelectItem value="new-york">New York, NY</SelectItem>
            <SelectItem value="san-francisco">San Francisco, CA</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Select onValueChange={(value) =>
          onFilterChange({ search: "", location: "", category: value })
        }>
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="engineering">Engineering</SelectItem>
            <SelectItem value="product">Product</SelectItem>
            <SelectItem value="data">Data</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
