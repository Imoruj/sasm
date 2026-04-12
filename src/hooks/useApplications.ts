"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useApplications() {
  return useQuery({
    queryKey: ["applications"],
    queryFn: async () => {
      const res = await fetch("/api/applications");
      if (!res.ok) throw new Error("Failed to fetch applications");
      const json = await res.json();
      return json.data;
    },
  });
}

export function useApplication(id: string) {
  return useQuery({
    queryKey: ["applications", id],
    queryFn: async () => {
      const res = await fetch(`/api/applications/${id}`);
      if (!res.ok) throw new Error("Failed to fetch application");
      const json = await res.json();
      return json.data;
    },
    enabled: !!id,
  });
}

export function useSubmitApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (applicationId: string) => {
      const res = await fetch(`/api/applications/${applicationId}/submit`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message ?? "Submission failed");
      }
      return res.json();
    },
    onSuccess: (_, applicationId) => {
      queryClient.invalidateQueries({ queryKey: ["applications", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });
}
