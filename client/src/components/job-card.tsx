import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, BadgeDollarSign } from "lucide-react";
import type { Job } from "@shared/schema";

export function JobCard({ job }: { job: Job }) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle className="flex justify-between items-start">
          <div>
            <h3 className="text-xl font-semibold">{job.title}</h3>
            <div className="flex items-center mt-2 text-muted-foreground">
              <Building2 className="h-4 w-4 mr-1" />
              <span>{job.company}</span>
            </div>
          </div>
          <Badge>{job.category}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center text-muted-foreground">
            <MapPin className="h-4 w-4 mr-1" />
            <span>{job.location}</span>
          </div>
          <div className="flex items-center text-muted-foreground">
            <BadgeDollarSign className="h-4 w-4 mr-1" />
            <span>{job.salary}</span>
          </div>
          <p className="text-sm mt-4">{job.description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
