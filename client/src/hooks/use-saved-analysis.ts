import { useQuery } from "@tanstack/react-query";
import { ResumeAnalysis } from "@shared/schema";
import { getQueryFn } from "@/lib/queryClient";
import { useEffect, useState } from "react";

/**
 * Hook to retrieve, load and handle saved resume analyses
 */
export function useSavedAnalysis() {
  // Check for analysis ID in URL params
  const [analysisId, setAnalysisId] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const id = urlParams.get('id');
      return id ? parseInt(id, 10) : null;
    }
    return null;
  });

  // Query for user's previous analyses
  const { 
    data: userAnalyses,
    isLoading: isLoadingUserAnalyses,
    error: userAnalysesError,
    refetch: refetchUserAnalyses
  } = useQuery<ResumeAnalysis[]>({
    queryKey: ['/api/user/analyses'],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: true, // Always fetch user analyses when this hook is used
  });

  // Query for specific analysis if ID is provided
  const {
    data: savedAnalysis,
    isLoading: isLoadingSavedAnalysis,
    error: savedAnalysisError
  } = useQuery<ResumeAnalysis>({
    queryKey: [`/api/resume-analysis/${analysisId}`],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!analysisId, // Only run if we have an ID
  });

  // Update URL with analysis ID for deep linking
  const setAnalysisIdWithUrlUpdate = (id: number | null) => {
    if (typeof window !== 'undefined') {
      if (id) {
        // Update URL without page reload
        const url = new URL(window.location.href);
        url.searchParams.set('id', id.toString());
        window.history.pushState({}, '', url);
      } else {
        // Remove ID from URL
        const url = new URL(window.location.href);
        url.searchParams.delete('id');
        window.history.pushState({}, '', url);
      }
    }
    
    // Update state
    setAnalysisId(id);
  };

  // Load analysis if ID is in URL on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const id = urlParams.get('id');
      if (id) {
        setAnalysisId(parseInt(id, 10));
      }
    }
  }, []);

  return {
    savedAnalysis,
    isLoadingSavedAnalysis,
    savedAnalysisError,
    userAnalyses,
    isLoadingUserAnalyses,
    userAnalysesError,
    analysisId,
    setAnalysisId: setAnalysisIdWithUrlUpdate,
    refetchUserAnalyses
  };
}