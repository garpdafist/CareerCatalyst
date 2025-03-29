import React, { useState } from "react";
import { motion } from "framer-motion";
import { useSavedAnalysis } from "@/hooks/use-saved-analysis";
import { ArrowLeft, Search, SlidersHorizontal } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ResumeAnalysisPopup } from "@/components/ui/resume-analysis-popup";

// Same type definitions and helpers used in saved-analyses.tsx
type SortOption = 'newest' | 'oldest' | 'highest' | 'lowest';
type FilterOption = 'all' | 'withJob' | 'withoutJob';

export default function AllAnalyses() {
  const { 
    userAnalyses, 
    isLoadingUserAnalyses, 
    setAnalysisId, 
    savedAnalysis, 
    isLoadingSavedAnalysis 
  } = useSavedAnalysis();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [filterOption, setFilterOption] = useState<FilterOption>('all');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  // Handle analysis click - open in a popup directly without navigating away
  const handleAnalysisClick = (id: number) => {
    setAnalysisId(id);
    // Using URL parameters for deep linking without redirecting
    window.history.pushState({}, '', `?id=${id}`);
    // Open the popup
    setIsPopupOpen(true);
  };

  // Effect to handle popup opening when an analysis is loaded
  React.useEffect(() => {
    if (savedAnalysis) {
      setIsPopupOpen(true);
    }
  }, [savedAnalysis]);

  // Filter and sort analyses
  const filteredAnalyses = React.useMemo(() => {
    if (!userAnalyses) return [];
    
    let result = [...userAnalyses];
    
    // Apply text search
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(analysis => {
        const skills = analysis.identifiedSkills?.join(" ").toLowerCase() || "";
        const keywords = analysis.primaryKeywords?.join(" ").toLowerCase() || "";
        let feedback = "";
        if (analysis.generalFeedback) {
          if (typeof analysis.generalFeedback === 'object' && analysis.generalFeedback.overall) {
            feedback = analysis.generalFeedback.overall.toLowerCase();
          } else if (typeof analysis.generalFeedback === 'string') {
            feedback = analysis.generalFeedback.toLowerCase();
          }
        }
        
        return skills.includes(searchLower) || 
               keywords.includes(searchLower) || 
               feedback.includes(searchLower);
      });
    }
    
    // Apply job filter
    if (filterOption === 'withJob') {
      result = result.filter(analysis => !!analysis.jobAnalysis);
    } else if (filterOption === 'withoutJob') {
      result = result.filter(analysis => !analysis.jobAnalysis);
    }
    
    // Apply sorting
    if (sortOption === 'newest') {
      result.sort((a, b) => (new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
    } else if (sortOption === 'oldest') {
      result.sort((a, b) => (new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()));
    } else if (sortOption === 'highest') {
      result.sort((a, b) => (b.score - a.score));
    } else if (sortOption === 'lowest') {
      result.sort((a, b) => (a.score - b.score));
    }
    
    return result;
  }, [userAnalyses, searchTerm, sortOption, filterOption]);

  // Get score color based on score value 
  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-green-100 text-green-800 border-green-200";
    if (score >= 60) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-red-100 text-red-800 border-red-200";
  };

  // Skeleton loading state
  if (isLoadingUserAnalyses) {
    return (
      <div className="min-h-screen bg-background px-4 py-8 md:py-16">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center mb-8">
            <Link href="/resume-analyzer">
              <Button variant="ghost" size="icon" className="mr-2">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">All Resume Analyses</h1>
          </div>
          
          <div className="grid gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <Skeleton className="h-6 w-1/4" />
                    <Skeleton className="h-8 w-16 rounded-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <Skeleton key={j} className="h-6 w-16 rounded-full" />
                    ))}
                  </div>
                  <div className="flex justify-end mt-4">
                    <Skeleton className="h-9 w-28" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:py-16">
      <div className="mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center mb-6">
            <Link href="/resume-analyzer">
              <Button variant="ghost" size="icon" className="mr-2">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">All Resume Analyses</h1>
          </div>

          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-grow">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search analyses..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button 
                  variant="outline"
                  size="icon"
                  onClick={() => setIsFilterVisible(!isFilterVisible)}
                  className={isFilterVisible ? "bg-muted" : ""}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
              </div>
              
              {isFilterVisible && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <div>
                    <p className="text-sm font-medium mb-2">Sort by</p>
                    <Select 
                      value={sortOption} 
                      onValueChange={(value) => setSortOption(value as SortOption)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Newest First</SelectItem>
                        <SelectItem value="oldest">Oldest First</SelectItem>
                        <SelectItem value="highest">Highest Score</SelectItem>
                        <SelectItem value="lowest">Lowest Score</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium mb-2">Filter by</p>
                    <Select 
                      value={filterOption} 
                      onValueChange={(value) => setFilterOption(value as FilterOption)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Analyses</SelectItem>
                        <SelectItem value="withJob">With Job Description</SelectItem>
                        <SelectItem value="withoutJob">Without Job Description</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            {filteredAnalyses.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">No analyses found.</p>
                </CardContent>
              </Card>
            ) : (
              filteredAnalyses.map((analysis) => (
                <motion.div
                  key={analysis.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="overflow-hidden hover:shadow-md transition-shadow duration-300">
                    <CardContent className="p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-lg truncate">
                            Resume Analysis {analysis.id}
                          </h3>
                          {analysis.createdAt && (
                            <p className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(analysis.createdAt), { addSuffix: true })}
                            </p>
                          )}
                        </div>
                        <Badge 
                          variant="outline" 
                          className={`${getScoreColor(analysis.score)} text-lg px-3 py-1`}
                        >
                          {analysis.score}/100
                        </Badge>
                      </div>
                      
                      <div className="mt-4">
                        <h4 className="text-sm font-medium mb-2">Key Skills</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {(analysis.identifiedSkills || []).slice(0, 5).map((skill, index) => (
                            <Badge
                              key={index}
                              variant="secondary"
                              className="bg-green-50 text-green-700 border-green-200"
                            >
                              {skill}
                            </Badge>
                          ))}
                          {(analysis.identifiedSkills || []).length > 5 && (
                            <Badge variant="outline">
                              +{(analysis.identifiedSkills || []).length - 5} more
                            </Badge>
                          )}
                          {(analysis.identifiedSkills || []).length === 0 && (
                            <span className="text-sm text-muted-foreground">No skills identified</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center mt-4 pt-3 border-t border-border">
                        <div>
                          {analysis.jobAnalysis && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              With Job Match
                            </Badge>
                          )}
                        </div>
                        <Button onClick={() => handleAnalysisClick(analysis.id)}>
                          View Results
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>
      
      {/* Add the ResumeAnalysisPopup component */}
      <ResumeAnalysisPopup 
        isOpen={isPopupOpen}
        onClose={() => setIsPopupOpen(false)}
        analysisData={savedAnalysis || null}
        isLoading={isLoadingSavedAnalysis}
      />
    </div>
  );
}