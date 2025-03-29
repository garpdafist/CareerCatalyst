import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ResumeAnalysis } from "@shared/schema";
import { getQueryFn } from "@/lib/queryClient";
import { useEffect, useState, useCallback } from "react";

/**
 * Hook to retrieve, load and handle saved resume analyses
 */
export function useSavedAnalysis() {
  const queryClient = useQueryClient();
  
  // Check for analysis ID in URL params
  const [analysisId, setAnalysisId] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const id = urlParams.get('id');
      return id ? parseInt(id, 10) : null;
    }
    return null;
  });

  // Query for user's previous analyses with staleTime to reduce network calls
  const { 
    data: userAnalyses,
    isLoading: isLoadingUserAnalyses,
    error: userAnalysesError,
    refetch: refetchUserAnalyses
  } = useQuery<ResumeAnalysis[]>({
    queryKey: ['/api/user/analyses'],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 60000, // Data remains fresh for 1 minute to reduce API calls
    enabled: true
  });

  // Query for specific analysis if ID is provided - with caching
  const {
    data: savedAnalysis,
    isLoading: isLoadingSavedAnalysis,
    error: savedAnalysisError,
    status
  } = useQuery<ResumeAnalysis>({
    queryKey: [`/api/resume-analysis/${analysisId}`],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!analysisId,
    staleTime: 300000, // 5 minutes - analyses don't change often
  });
  
  // Prefetch function for analyses
  const prefetchAnalysis = useCallback((id: number) => {
    if (!id) return;
    // Prefetch the analysis data
    queryClient.prefetchQuery({
      queryKey: [`/api/resume-analysis/${id}`],
      queryFn: getQueryFn({ on401: "returnNull" }),
      staleTime: 300000
    });
  }, [queryClient]);
  
  // Find analysis in cache for immediate display
  const findAnalysisInCache = useCallback((id: number): ResumeAnalysis | undefined => {
    if (!id) return undefined;
    
    // Try to get from cache first
    return queryClient.getQueryData<ResumeAnalysis>([`/api/resume-analysis/${id}`]) ||
           // Or find it in the user analyses list
           userAnalyses?.find(analysis => analysis.id === id);
  }, [queryClient, userAnalyses]);

  // Update URL with analysis ID for deep linking
  const setAnalysisIdWithUrlUpdate = useCallback((id: number | null) => {
    if (typeof window !== 'undefined') {
      if (id) {
        // Update URL without page reload
        const url = new URL(window.location.href);
        url.searchParams.set('id', id.toString());
        window.history.pushState({}, '', url);
        
        // Prefetch this analysis
        prefetchAnalysis(id);
      } else {
        // Remove ID from URL
        const url = new URL(window.location.href);
        url.searchParams.delete('id');
        window.history.pushState({}, '', url);
      }
    }
    
    // Update state
    setAnalysisId(id);
  }, [prefetchAnalysis]);

  // Load analysis from URL parameters on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const id = urlParams.get('id');
      if (id) {
        const parsedId = parseInt(id, 10);
        setAnalysisId(parsedId);
        
        // Also prefetch any analyses we might need
        prefetchAnalysis(parsedId);
      }
    }
  }, [prefetchAnalysis]);

  // Remove debugging logs in production
  // console.log('useSavedAnalysis hook - analysisId:', analysisId);
  // console.log('useSavedAnalysis hook - savedAnalysis:', savedAnalysis);

  return {
    savedAnalysis,
    isLoadingSavedAnalysis,
    savedAnalysisError,
    userAnalyses,
    isLoadingUserAnalyses,
    userAnalysesError,
    analysisId,
    setAnalysisId: setAnalysisIdWithUrlUpdate,
    refetchUserAnalyses,
    // New functions for improved UX
    prefetchAnalysis,
    findAnalysisInCache,
    // Query status for better loading states
    analysisStatus: status
  };
}