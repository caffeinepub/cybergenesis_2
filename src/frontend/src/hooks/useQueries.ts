import * as fakeCbr from "@/lib/fakeCbr";
import { formatTokenBalance } from "@/lib/tokenUtils";
import type {
  LandData,
  ModifierInstance,
  Time,
  TopLandEntry,
  UserProfile,
} from "@/types";
import type { Principal } from "@icp-sdk/core/principal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useActor } from "./useActor";
import { useInternetIdentity } from "./useInternetIdentity";

// Runtime actor interface — cast from backendInterface for actual method calls
interface RuntimeActor {
  getLandData(): Promise<LandData[]>;
  getCallerUserProfile(): Promise<UserProfile | null>;
  saveCallerUserProfile(profile: UserProfile): Promise<void>;
  claimRewards(landId: bigint): Promise<unknown>;
  upgradePlot(landId: bigint, cost: bigint): Promise<unknown>;
  updatePlotName(landId: bigint, name: string): Promise<void>;
  updateDecoration(landId: bigint, url: string): Promise<void>;
  getMyModifications(): Promise<ModifierInstance[]>;
  applyModifier(modifierInstanceId: bigint, landId: bigint): Promise<void>;
  mintLand(): Promise<unknown>;
  getTopLands(limit: bigint): Promise<TopLandEntry[]>;
}

function asRuntimeActor(actor: unknown): RuntimeActor {
  return actor as RuntimeActor;
}

// Placeholder types for governance and marketplace (not yet in backend)
interface Proposal {
  id: bigint;
  title: string;
  description: string;
  proposer: Principal;
  createdAt: Time;
  votesYes: bigint;
  votesNo: bigint;
  isActive: boolean;
}

enum ItemType {
  Land = "Land",
  Modifier = "Modifier",
}

interface Listing {
  listingId: bigint;
  itemId: bigint;
  itemType: ItemType;
  seller: Principal;
  price: bigint;
  isActive: boolean;
}

type StakeResult =
  | {
      __kind__: "success";
      success: {
        newStake: bigint;
      };
    }
  | {
      __kind__: "insufficientTokens";
      insufficientTokens: {
        required: bigint;
        available: bigint;
      };
    }
  | {
      __kind__: "transferFailed";
      transferFailed: string;
    };

type VoteResult =
  | {
      __kind__: "success";
      success: {
        weight: bigint;
      };
    }
  | {
      __kind__: "proposalNotFound";
      proposalNotFound: null;
    }
  | {
      __kind__: "proposalNotActive";
      proposalNotActive: null;
    }
  | {
      __kind__: "alreadyVoted";
      alreadyVoted: null;
    }
  | {
      __kind__: "notStaker";
      notStaker: null;
    };

type BuyResult =
  | {
      __kind__: "success";
      success: {
        buyer: Principal;
        seller: Principal;
        price: bigint;
      };
    }
  | {
      __kind__: "listingNotFound";
      listingNotFound: null;
    }
  | {
      __kind__: "listingNotActive";
      listingNotActive: null;
    }
  | {
      __kind__: "insufficientFunds";
      insufficientFunds: {
        required: bigint;
        available: bigint;
      };
    }
  | {
      __kind__: "transferFailed";
      transferFailed: string;
    }
  | {
      __kind__: "cannotBuyOwnListing";
      cannotBuyOwnListing: null;
    };

// Land Data Query
export function useGetLandData() {
  const { actor, isFetching } = useActor();

  return useQuery<LandData[]>({
    queryKey: ["landData"],
    queryFn: async () => {
      if (!actor) return [];
      console.log("Fetching land data...");
      const result = await asRuntimeActor(actor).getLandData();
      console.log("Land data fetched:", result);
      return result;
    },
    enabled: !!actor && !isFetching,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

// User Profile Query
export function useGetCallerUserProfile() {
  const { actor, isFetching: actorFetching } = useActor();

  const query = useQuery<UserProfile | null>({
    queryKey: ["currentUserProfile"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return asRuntimeActor(actor).getCallerUserProfile();
    },
    enabled: !!actor && !actorFetching,
    retry: false,
  });

  return {
    ...query,
    isLoading: actorFetching || query.isLoading,
    isFetched: !!actor && query.isFetched,
  };
}

// Save User Profile Mutation
export function useSaveCallerUserProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      if (!actor) throw new Error("Actor not available");
      console.log("Saving user profile:", profile);
      await asRuntimeActor(actor).saveCallerUserProfile(profile);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUserProfile"] });
      toast.success("Профиль сохранен");
    },
    onError: (error: any) => {
      console.error("Profile save error:", error);
      toast.error(
        `Ошибка сохранения профиля: ${error.message || "Неизвестная ошибка"}`,
      );
    },
  });
}

// Token Balance Query — reads from fake localStorage CBR
export function useGetTokenBalance() {
  const { identity } = useInternetIdentity();

  return useQuery({
    queryKey: ["tokenBalance", identity?.getPrincipal().toString()],
    queryFn: async () => {
      if (!identity) return BigInt(0);
      const principal = identity.getPrincipal().toString();
      const balance = fakeCbr.getBalance(principal);
      console.log(
        "Fake CBR balance for",
        principal,
        ":",
        formatTokenBalance(balance),
      );
      return balance;
    },
    enabled: !!identity,
    staleTime: 5000,
  });
}

// Debug Token Balance Hook — reads fake balance from localStorage
export function useDebugTokenBalance() {
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!identity) throw new Error("Identity not available");
      const principal = identity.getPrincipal().toString();
      const balance = fakeCbr.getBalance(principal);
      console.log("🔍 Fake CBR balance:", balance.toString());
      return balance;
    },
    onSuccess: (balance) => {
      queryClient.invalidateQueries({ queryKey: ["tokenBalance"] });
      toast.success(`Баланс: ${formatTokenBalance(balance)} CBR`);
    },
    onError: (error: any) => {
      toast.error(
        `Ошибка получения баланса: ${error.message || "Неизвестная ошибка"}`,
      );
    },
  });
}

// Canister Token Balance Query — returns total fake supply
export function useGetCanisterTokenBalance() {
  return useQuery({
    queryKey: ["canisterTokenBalance"],
    queryFn: async () => {
      const total = fakeCbr.getTotalSupply();
      console.log("Fake CBR total supply:", total.toString());
      return total;
    },
    staleTime: 10000,
  });
}

// Debug Canister Balance Hook — returns total fake supply
export function useDebugCanisterBalance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const total = fakeCbr.getTotalSupply();
      console.log("🔍 Fake CBR total supply:", total.toString());
      return total;
    },
    onSuccess: (balance) => {
      queryClient.invalidateQueries({ queryKey: ["canisterTokenBalance"] });
      toast.success(`Баланс контракта: ${formatTokenBalance(balance)} CBR`);
    },
    onError: (error: any) => {
      toast.error(
        `Ошибка получения баланса контракта: ${error.message || "Неизвестная ошибка"}`,
      );
    },
  });
}

// Mint fake CBR tokens for testing — no restrictions
export function useMintFakeCbr() {
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (amount: bigint) => {
      if (!identity) throw new Error("Identity not available");
      const principal = identity.getPrincipal().toString();
      fakeCbr.mintTokens(principal, amount);
      return fakeCbr.getBalance(principal);
    },
    onSuccess: (newBalance, amount) => {
      queryClient.invalidateQueries({ queryKey: ["tokenBalance"] });
      queryClient.invalidateQueries({ queryKey: ["canisterTokenBalance"] });
      const amountFormatted = formatTokenBalance(amount);
      toast.success(`Получено ${amountFormatted} CBR для тестирования`);
      console.log(
        "Fake CBR minted. New balance:",
        formatTokenBalance(newBalance),
      );
    },
    onError: (error: any) => {
      toast.error(`Ошибка минтинга: ${error.message || "Неизвестная ошибка"}`);
    },
  });
}

// Claim Rewards Mutation
export function useClaimRewards() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (landId: bigint) => {
      if (!actor) throw new Error("Actor not available");
      console.log("Claiming rewards for land:", landId);
      const result = await asRuntimeActor(actor).claimRewards(landId);
      console.log("Claim result:", result);
      return result;
    },
    onSuccess: async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      queryClient.invalidateQueries({ queryKey: ["landData"] });
      queryClient.invalidateQueries({ queryKey: ["tokenBalance"] });
      toast.success("Награды получены!");
    },
    onError: (error: any) => {
      console.error("Claim rewards error:", error);
      toast.error(
        `Ошибка получения наград: ${error.message || "Неизвестная ошибка"}`,
      );
    },
  });
}

// Upgrade Plot Mutation
export function useUpgradePlot() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ landId, cost }: { landId: bigint; cost: bigint }) => {
      if (!actor) throw new Error("Actor not available");
      console.log("Upgrading plot:", landId, "Cost:", cost);
      const result = await asRuntimeActor(actor).upgradePlot(landId, cost);
      console.log("Upgrade result:", result);
      return result;
    },
    onSuccess: async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      queryClient.invalidateQueries({ queryKey: ["landData"] });
      queryClient.invalidateQueries({ queryKey: ["tokenBalance"] });
      toast.success("Участок улучшен!");
    },
    onError: (error: any) => {
      console.error("Upgrade plot error:", error);
      toast.error(`Ошибка улучшения: ${error.message || "Неизвестная ошибка"}`);
    },
  });
}

// Update Plot Name Mutation
export function useUpdatePlotName() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ landId, name }: { landId: bigint; name: string }) => {
      if (!actor) throw new Error("Actor not available");
      await asRuntimeActor(actor).updatePlotName(landId, name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landData"] });
      toast.success("Название обновлено");
    },
    onError: (error: any) => {
      console.error("Update plot name error:", error);
      toast.error(
        `Ошибка обновления названия: ${error.message || "Неизвестная ошибка"}`,
      );
    },
  });
}

// Update Decoration Mutation
export function useUpdateDecoration() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ landId, url }: { landId: bigint; url: string }) => {
      if (!actor) throw new Error("Actor not available");
      await asRuntimeActor(actor).updateDecoration(landId, url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landData"] });
      toast.success("Декорация обновлена");
    },
    onError: (error: any) => {
      console.error("Update decoration error:", error);
      toast.error(
        `Ошибка обновления декорации: ${error.message || "Неизвестная ошибка"}`,
      );
    },
  });
}

// Get Modifier Inventory Query — fetches real data from backend
export function useGetModifierInventory() {
  const { actor, isFetching } = useActor();

  return useQuery<ModifierInstance[]>({
    queryKey: ["modifierInventory"],
    queryFn: async () => {
      if (!actor) return [];
      console.log("Fetching modifier inventory via getMyModifications...");
      const result = await asRuntimeActor(actor).getMyModifications();
      console.log("Modifier inventory fetched:", result);
      return result;
    },
    enabled: !!actor && !isFetching,
    retry: 2,
  });
}

// Apply Modifier Mutation
export function useApplyModifier() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      modifierInstanceId,
      landId,
    }: { modifierInstanceId: bigint; landId: bigint }) => {
      if (!actor) throw new Error("Actor not available");
      console.log("Applying modifier:", modifierInstanceId, "to land:", landId);
      await asRuntimeActor(actor).applyModifier(modifierInstanceId, landId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landData"] });
      queryClient.invalidateQueries({ queryKey: ["modifierInventory"] });
      toast.success("Модификатор применен!");
    },
    onError: (error: any) => {
      console.error("Apply modifier error:", error);
      toast.error(
        `Ошибка применения модификатора: ${error.message || "Неизвестная ошибка"}`,
      );
    },
  });
}

// Mint Land Mutation
export function useMintLand() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Actor not available");
      console.log("Minting new land...");
      const result = await asRuntimeActor(actor).mintLand();
      console.log("Mint result:", result);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landData"] });
      toast.success("Новая земля создана!");
    },
    onError: (error: any) => {
      console.error("Mint land error:", error);
      toast.error(
        `Ошибка создания земли: ${error.message || "Неизвестная ошибка"}`,
      );
    },
  });
}

// Get Top Lands Query
export function useGetTopLands() {
  const { actor, isFetching } = useActor();

  return useQuery<TopLandEntry[]>({
    queryKey: ["topLands"],
    queryFn: async () => {
      if (!actor) return [];
      console.log("Fetching top lands...");
      const result = await asRuntimeActor(actor).getTopLands(BigInt(10));
      console.log("Top lands fetched:", result);
      return result;
    },
    enabled: !!actor && !isFetching,
    retry: 2,
  });
}

// Get My Modifications Query
export function useGetMyModifications() {
  const { actor, isFetching } = useActor();

  return useQuery({
    queryKey: ["myModifications"],
    queryFn: async () => {
      if (!actor) return [];
      console.log("Fetching my modifications...");
      const result = await asRuntimeActor(actor).getMyModifications();
      console.log("My modifications fetched:", result);
      return result;
    },
    enabled: !!actor && !isFetching,
    retry: 2,
  });
}

// Governance Hooks — backed by fake localStorage storage
export function useGetStakedBalance() {
  const { identity } = useInternetIdentity();

  return useQuery({
    queryKey: ["stakedBalance", identity?.getPrincipal().toString()],
    queryFn: async () => {
      if (!identity) return BigInt(0);
      return fakeCbr.getStake(identity.getPrincipal().toString());
    },
    enabled: !!identity,
    staleTime: 5000,
  });
}

export function useStakeTokens() {
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation<StakeResult, Error, bigint>({
    mutationFn: async (amount: bigint) => {
      if (!identity) throw new Error("Identity not available");
      const principal = identity.getPrincipal().toString();
      const success = fakeCbr.stake(principal, amount);

      if (!success) {
        const available = fakeCbr.getBalance(principal);
        return {
          __kind__: "insufficientTokens",
          insufficientTokens: { required: amount, available },
        };
      }

      const newStake = fakeCbr.getStake(principal);
      return { __kind__: "success", success: { newStake } };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["stakedBalance"] });
      queryClient.invalidateQueries({ queryKey: ["tokenBalance"] });
      if (result.__kind__ === "success") {
        toast.success("Токены застейканы!");
      }
    },
    onError: (error: any) => {
      console.error("Stake tokens error:", error);
      toast.error(`Ошибка стейкинга: ${error.message || "Неизвестная ошибка"}`);
    },
  });
}

export function useGetAllActiveProposals() {
  const { identity } = useInternetIdentity();

  return useQuery<Proposal[]>({
    queryKey: ["activeProposals"],
    queryFn: async () => {
      const fakeProposals = fakeCbr.getProposals(true);
      return fakeProposals.map((p) => ({
        id: BigInt(p.id),
        title: p.title,
        description: p.description,
        proposer: p.proposer as unknown as Principal,
        createdAt: BigInt(p.createdAt) as unknown as Time,
        votesYes: BigInt(p.votesYes),
        votesNo: BigInt(p.votesNo),
        isActive: p.isActive,
      }));
    },
    enabled: !!identity,
    staleTime: 5000,
  });
}

export function useCreateProposal() {
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      title,
      description,
    }: { title: string; description: string }) => {
      if (!identity) throw new Error("Identity not available");
      const principal = identity.getPrincipal().toString();
      const proposalId = fakeCbr.createProposal(title, description, principal);
      return proposalId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeProposals"] });
      toast.success("Предложение создано!");
    },
    onError: (error: any) => {
      console.error("Create proposal error:", error);
      toast.error(
        `Ошибка создания предложения: ${error.message || "Неизвестная ошибка"}`,
      );
    },
  });
}

export function useVote() {
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation<
    VoteResult,
    Error,
    { proposalId: bigint; choice: boolean }
  >({
    mutationFn: async ({
      proposalId,
      choice,
    }: { proposalId: bigint; choice: boolean }) => {
      if (!identity) throw new Error("Identity not available");
      const principal = identity.getPrincipal().toString();
      const result = fakeCbr.voteOnProposal(
        Number(proposalId),
        choice,
        principal,
      );

      if (!result.success) {
        if (result.reason === "Proposal not found") {
          return { __kind__: "proposalNotFound", proposalNotFound: null };
        }
        if (result.reason === "Proposal not active") {
          return { __kind__: "proposalNotActive", proposalNotActive: null };
        }
        if (result.reason === "Already voted") {
          return { __kind__: "alreadyVoted", alreadyVoted: null };
        }
        return { __kind__: "notStaker", notStaker: null };
      }

      return {
        __kind__: "success",
        success: { weight: result.weight ?? BigInt(100000000) },
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["activeProposals"] });
      if (result.__kind__ === "success") {
        toast.success("Голос учтен!");
      }
    },
    onError: (error: any) => {
      console.error("Vote error:", error);
      toast.error(
        `Ошибка голосования: ${error.message || "Неизвестная ошибка"}`,
      );
    },
  });
}

// Marketplace Hooks — backed by fake localStorage storage
export function useGetAllActiveListings() {
  const { identity } = useInternetIdentity();

  return useQuery<Listing[]>({
    queryKey: ["activeListings"],
    queryFn: async () => {
      const fakeListings = fakeCbr.getActiveListings();
      return fakeListings.map((l) => ({
        listingId: BigInt(l.listingId),
        itemId: BigInt(l.itemId),
        itemType: l.itemType === "Land" ? ItemType.Land : ItemType.Modifier,
        seller: l.seller as unknown as Principal,
        price: BigInt(l.price),
        isActive: l.isActive,
      }));
    },
    enabled: !!identity,
    staleTime: 5000,
  });
}

export function useListItem() {
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      itemType,
      price,
    }: { itemId: bigint; itemType: ItemType; price: bigint }) => {
      if (!identity) throw new Error("Identity not available");
      const principal = identity.getPrincipal().toString();
      const fakeType = itemType === ItemType.Land ? "Land" : "Modifier";
      const listingId = fakeCbr.createListing(
        Number(itemId),
        fakeType,
        price,
        principal,
      );
      return listingId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeListings"] });
      toast.success("Предмет выставлен на продажу!");
    },
    onError: (error: any) => {
      console.error("List item error:", error);
      toast.error(
        `Ошибка выставления: ${error.message || "Неизвестная ошибка"}`,
      );
    },
  });
}

export function useBuyItem() {
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation<BuyResult, Error, bigint>({
    mutationFn: async (listingId: bigint) => {
      if (!identity) throw new Error("Identity not available");
      const principal = identity.getPrincipal().toString();
      const result = fakeCbr.buyListing(Number(listingId), principal);

      if (!result.success) {
        const reason = result.reason ?? "";
        if (reason.startsWith("Insufficient funds")) {
          const buyerBalance = fakeCbr.getBalance(principal);
          return {
            __kind__: "insufficientFunds",
            insufficientFunds: {
              required: BigInt(0),
              available: buyerBalance,
            },
          };
        }
        if (reason === "Cannot buy own listing") {
          return { __kind__: "cannotBuyOwnListing", cannotBuyOwnListing: null };
        }
        if (reason === "Listing not active") {
          return { __kind__: "listingNotActive", listingNotActive: null };
        }
        return { __kind__: "listingNotFound", listingNotFound: null };
      }

      return {
        __kind__: "success",
        success: {
          buyer: principal as unknown as Principal,
          seller: principal as unknown as Principal,
          price: BigInt(0),
        },
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["activeListings"] });
      queryClient.invalidateQueries({ queryKey: ["landData"] });
      queryClient.invalidateQueries({ queryKey: ["tokenBalance"] });
      if (result.__kind__ === "success") {
        toast.success("Предмет куплен!");
      }
    },
    onError: (error: any) => {
      console.error("Buy item error:", error);
      toast.error(`Ошибка покупки: ${error.message || "Неизвестная ошибка"}`);
    },
  });
}

export function useCancelListing() {
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (listingId: bigint) => {
      if (!identity) throw new Error("Identity not available");
      const principal = identity.getPrincipal().toString();
      fakeCbr.cancelListing(Number(listingId), principal);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeListings"] });
      toast.success("Объявление отменено!");
    },
    onError: (error: any) => {
      console.error("Cancel listing error:", error);
      toast.error(`Ошибка отмены: ${error.message || "Неизвестная ошибка"}`);
    },
  });
}

// Export ItemType for use in components
export { ItemType };
