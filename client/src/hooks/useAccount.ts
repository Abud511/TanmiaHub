import { trpc } from "@/lib/trpc";

/** حالة الحساب المحلي الحالي (متدرب أو مشرف) */
export function useAccount() {
  const utils = trpc.useUtils();
  const { data: account, isLoading } = trpc.account.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const logoutMutation = trpc.account.logout.useMutation({
    onSuccess: () => {
      try {
        localStorage.removeItem("platform_session_token");
      } catch {}
      utils.account.me.setData(undefined, null);
      utils.invalidate();
    },
  });

  return {
    account: account ?? null,
    isLoading,
    isAuthenticated: !!account,
    isAdmin: account?.role === "admin",
    logout: () => logoutMutation.mutate(),
  };
}
