/**
 * Fake CBR token storage for testing purposes.
 * All balances are persisted in localStorage.
 * BigInt values are stored as strings to avoid JSON serialization issues.
 */

const BALANCE_KEY = "fake_cbr_balance";
const LISTINGS_KEY = "fake_market_listings";
const STAKES_KEY = "fake_stakes";
const PROPOSALS_KEY = "fake_proposals";
const VOTES_KEY = "fake_votes";

// ---------------------------------------------------------------------------
// Token balance
// ---------------------------------------------------------------------------

function loadBalances(): Record<string, string> {
  try {
    const raw = localStorage.getItem(BALANCE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveBalances(data: Record<string, string>): void {
  localStorage.setItem(BALANCE_KEY, JSON.stringify(data));
}

export function getBalance(principal: string): bigint {
  const balances = loadBalances();
  return balances[principal] ? BigInt(balances[principal]) : BigInt(0);
}

export function setBalance(principal: string, amount: bigint): void {
  const balances = loadBalances();
  balances[principal] = amount.toString();
  saveBalances(balances);
}

export function addBalance(principal: string, amount: bigint): void {
  const current = getBalance(principal);
  setBalance(principal, current + amount);
}

/** Returns false if the balance is insufficient, does not modify state. */
export function subtractBalance(principal: string, amount: bigint): boolean {
  const current = getBalance(principal);
  if (current < amount) return false;
  setBalance(principal, current - amount);
  return true;
}

/** Mint any amount to principal — no restrictions, for testing only. */
export function mintTokens(principal: string, amount: bigint): void {
  addBalance(principal, amount);
}

/** Sum of all stored balances. */
export function getTotalSupply(): bigint {
  const balances = loadBalances();
  return Object.values(balances).reduce((sum, v) => sum + BigInt(v), BigInt(0));
}

// ---------------------------------------------------------------------------
// Marketplace listings
// ---------------------------------------------------------------------------

export interface FakeListing {
  listingId: number;
  itemId: number;
  itemType: "Land" | "Modifier";
  seller: string;
  price: string; // stored as string, represents bigint
  isActive: boolean;
}

function loadListings(): FakeListing[] {
  try {
    const raw = localStorage.getItem(LISTINGS_KEY);
    return raw ? (JSON.parse(raw) as FakeListing[]) : [];
  } catch {
    return [];
  }
}

function saveListings(data: FakeListing[]): void {
  localStorage.setItem(LISTINGS_KEY, JSON.stringify(data));
}

export function getActiveListings(): FakeListing[] {
  return loadListings().filter((l) => l.isActive);
}

export function getUserListings(principal: string): FakeListing[] {
  return loadListings().filter((l) => l.seller === principal && l.isActive);
}

export function createListing(
  itemId: number,
  itemType: "Land" | "Modifier",
  price: bigint,
  seller: string,
): number {
  const listings = loadListings();
  const listingId =
    listings.length > 0 ? Math.max(...listings.map((l) => l.listingId)) + 1 : 1;

  listings.push({
    listingId,
    itemId,
    itemType,
    seller,
    price: price.toString(),
    isActive: true,
  });

  saveListings(listings);
  return listingId;
}

export function buyListing(
  listingId: number,
  buyer: string,
): { success: boolean; reason?: string } {
  const listings = loadListings();
  const idx = listings.findIndex((l) => l.listingId === listingId);

  if (idx === -1) return { success: false, reason: "Listing not found" };

  const listing = listings[idx];
  if (!listing.isActive)
    return { success: false, reason: "Listing not active" };
  if (listing.seller === buyer)
    return { success: false, reason: "Cannot buy own listing" };

  const price = BigInt(listing.price);
  const buyerBalance = getBalance(buyer);

  if (buyerBalance < price) {
    return {
      success: false,
      reason: `Insufficient funds. Required: ${price.toString()}, available: ${buyerBalance.toString()}`,
    };
  }

  // Transfer
  subtractBalance(buyer, price);
  addBalance(listing.seller, price);

  // Mark as sold
  listings[idx] = { ...listing, isActive: false };
  saveListings(listings);

  return { success: true };
}

export function cancelListing(listingId: number, caller: string): void {
  const listings = loadListings();
  const idx = listings.findIndex(
    (l) => l.listingId === listingId && l.seller === caller,
  );
  if (idx !== -1) {
    listings[idx] = { ...listings[idx], isActive: false };
    saveListings(listings);
  }
}

// ---------------------------------------------------------------------------
// Governance — staking
// ---------------------------------------------------------------------------

function loadStakes(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STAKES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveStakes(data: Record<string, string>): void {
  localStorage.setItem(STAKES_KEY, JSON.stringify(data));
}

export function getStake(principal: string): bigint {
  const stakes = loadStakes();
  return stakes[principal] ? BigInt(stakes[principal]) : BigInt(0);
}

export function stake(principal: string, amount: bigint): boolean {
  const balance = getBalance(principal);
  if (balance < amount) return false;
  subtractBalance(principal, amount);
  const stakes = loadStakes();
  const current = stakes[principal] ? BigInt(stakes[principal]) : BigInt(0);
  stakes[principal] = (current + amount).toString();
  saveStakes(stakes);
  return true;
}

export function unstake(principal: string, amount: bigint): void {
  const stakes = loadStakes();
  const current = stakes[principal] ? BigInt(stakes[principal]) : BigInt(0);
  const newStake = current > amount ? current - amount : BigInt(0);
  stakes[principal] = newStake.toString();
  saveStakes(stakes);
  addBalance(principal, amount > current ? current : amount);
}

// ---------------------------------------------------------------------------
// Governance — proposals & votes
// ---------------------------------------------------------------------------

export interface FakeProposal {
  id: number;
  title: string;
  description: string;
  proposer: string;
  createdAt: number;
  votesYes: string; // bigint as string
  votesNo: string; // bigint as string
  isActive: boolean;
}

function loadProposals(): FakeProposal[] {
  try {
    const raw = localStorage.getItem(PROPOSALS_KEY);
    return raw ? (JSON.parse(raw) as FakeProposal[]) : [];
  } catch {
    return [];
  }
}

function saveProposals(data: FakeProposal[]): void {
  localStorage.setItem(PROPOSALS_KEY, JSON.stringify(data));
}

function loadVotes(): Record<string, Record<string, boolean>> {
  try {
    const raw = localStorage.getItem(VOTES_KEY);
    return raw
      ? (JSON.parse(raw) as Record<string, Record<string, boolean>>)
      : {};
  } catch {
    return {};
  }
}

function saveVotes(data: Record<string, Record<string, boolean>>): void {
  localStorage.setItem(VOTES_KEY, JSON.stringify(data));
}

export function createProposal(
  title: string,
  description: string,
  proposer: string,
): number {
  const proposals = loadProposals();
  const id =
    proposals.length > 0 ? Math.max(...proposals.map((p) => p.id)) + 1 : 1;

  proposals.push({
    id,
    title,
    description,
    proposer,
    createdAt: Date.now(),
    votesYes: "0",
    votesNo: "0",
    isActive: true,
  });

  saveProposals(proposals);
  return id;
}

export function voteOnProposal(
  proposalId: number,
  choice: boolean,
  voter: string,
): { success: boolean; reason?: string; weight?: bigint } {
  const proposals = loadProposals();
  const idx = proposals.findIndex((p) => p.id === proposalId);

  if (idx === -1) return { success: false, reason: "Proposal not found" };
  if (!proposals[idx].isActive)
    return { success: false, reason: "Proposal not active" };

  const votes = loadVotes();
  const proposalVotes = votes[proposalId.toString()] ?? {};

  if (voter in proposalVotes)
    return { success: false, reason: "Already voted" };

  const stakeWeight = getStake(voter);
  // Allow voting even without stake for test convenience, weight = 1 e8s minimum
  const weight = stakeWeight > BigInt(0) ? stakeWeight : BigInt(100000000);

  proposalVotes[voter] = choice;
  votes[proposalId.toString()] = proposalVotes;
  saveVotes(votes);

  const proposal = proposals[idx];
  if (choice) {
    proposal.votesYes = (BigInt(proposal.votesYes) + weight).toString();
  } else {
    proposal.votesNo = (BigInt(proposal.votesNo) + weight).toString();
  }
  proposals[idx] = proposal;
  saveProposals(proposals);

  return { success: true, weight };
}

export function getProposals(onlyActive?: boolean): FakeProposal[] {
  const proposals = loadProposals();
  return onlyActive ? proposals.filter((p) => p.isActive) : proposals;
}

// ---------------------------------------------------------------------------
// Cycle Charge simulation — 100 charge per minute (for testing)
// ---------------------------------------------------------------------------

const CHARGE_UPDATE_KEY = "fake_charge_update";

interface ChargeState {
  [landId: string]: {
    lastUpdateMs: number;
    currentCharge: number;
    chargeCap: number;
  };
}

function loadChargeState(): ChargeState {
  try {
    const raw = localStorage.getItem(CHARGE_UPDATE_KEY);
    return raw ? (JSON.parse(raw) as ChargeState) : {};
  } catch {
    return {};
  }
}

function saveChargeState(data: ChargeState): void {
  localStorage.setItem(CHARGE_UPDATE_KEY, JSON.stringify(data));
}

/** Call this on each render tick to calculate accumulated charge (100/min). */
export function getSimulatedCharge(
  landId: string,
  backendCharge: number,
  chargeCap: number,
): number {
  const state = loadChargeState();
  const entry = state[landId];
  const now = Date.now();

  if (!entry) {
    // First time we see this land — init from backend value
    state[landId] = {
      lastUpdateMs: now,
      currentCharge: backendCharge,
      chargeCap,
    };
    saveChargeState(state);
    return backendCharge;
  }

  const elapsedMs = now - entry.lastUpdateMs;
  // 100 charge per minute = 100/60000 per ms
  const gained = (elapsedMs * 100) / 60000;
  const newCharge = Math.min(entry.currentCharge + gained, chargeCap);

  state[landId] = { lastUpdateMs: now, currentCharge: newCharge, chargeCap };
  saveChargeState(state);

  return Math.floor(newCharge);
}

/** Reset charge state for a land (e.g. after spending charge via backend call). */
export function syncCharge(
  landId: string,
  backendCharge: number,
  chargeCap: number,
): void {
  const state = loadChargeState();
  state[landId] = {
    lastUpdateMs: Date.now(),
    currentCharge: backendCharge,
    chargeCap,
  };
  saveChargeState(state);
}

// ---------------------------------------------------------------------------
// Opened cache IDs — persistent set to prevent re-opening after refresh
// ---------------------------------------------------------------------------

const OPENED_CACHES_KEY = "fake_opened_caches";

function loadOpenedCaches(): string[] {
  try {
    const raw = localStorage.getItem(OPENED_CACHES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function markCacheOpened(cacheId: string): void {
  const opened = loadOpenedCaches();
  if (!opened.includes(cacheId)) {
    opened.push(cacheId);
    localStorage.setItem(OPENED_CACHES_KEY, JSON.stringify(opened));
  }
}

export function isCacheOpened(cacheId: string): boolean {
  return loadOpenedCaches().includes(cacheId);
}

export function getOpenedCacheIds(): string[] {
  return loadOpenedCaches();
}

// ---------------------------------------------------------------------------
// Booster inventory — stacked items (e.g. "x3 Nova Charge")
// ---------------------------------------------------------------------------

const BOOSTERS_KEY = "fake_booster_inventory";

export interface BoosterStack {
  boosterId: string;
  count: number;
}

function loadBoosters(): BoosterStack[] {
  try {
    const raw = localStorage.getItem(BOOSTERS_KEY);
    return raw ? (JSON.parse(raw) as BoosterStack[]) : [];
  } catch {
    return [];
  }
}

function saveBoosters(data: BoosterStack[]): void {
  localStorage.setItem(BOOSTERS_KEY, JSON.stringify(data));
}

export function getBoosters(): BoosterStack[] {
  return loadBoosters();
}

export function addBooster(boosterId: string): void {
  const inv = loadBoosters();
  const existing = inv.find((b) => b.boosterId === boosterId);
  if (existing) {
    existing.count += 1;
  } else {
    inv.push({ boosterId, count: 1 });
  }
  saveBoosters(inv);
}

/** Returns false if no booster of that type available. Removes 1 from stack. */
export function consumeBooster(boosterId: string): boolean {
  const inv = loadBoosters();
  const idx = inv.findIndex((b) => b.boosterId === boosterId);
  if (idx === -1 || inv[idx].count <= 0) return false;
  inv[idx].count -= 1;
  if (inv[idx].count === 0) inv.splice(idx, 1);
  saveBoosters(inv);
  return true;
}

// ---------------------------------------------------------------------------
// Crystal inventory — stacked items
// ---------------------------------------------------------------------------

const CRYSTALS_KEY = "fake_crystal_inventory";

export interface CrystalStack {
  crystalId: string;
  count: number;
}

function loadCrystals(): CrystalStack[] {
  try {
    const raw = localStorage.getItem(CRYSTALS_KEY);
    return raw ? (JSON.parse(raw) as CrystalStack[]) : [];
  } catch {
    return [];
  }
}

function saveCrystals(data: CrystalStack[]): void {
  localStorage.setItem(CRYSTALS_KEY, JSON.stringify(data));
}

export function getCrystals(): CrystalStack[] {
  return loadCrystals();
}

export function addCrystal(crystalId: string): void {
  const inv = loadCrystals();
  const existing = inv.find((c) => c.crystalId === crystalId);
  if (existing) {
    existing.count += 1;
  } else {
    inv.push({ crystalId, count: 1 });
  }
  saveCrystals(inv);
}

// ---------------------------------------------------------------------------
// Loot drop log — stores all items gained from opening caches
// ---------------------------------------------------------------------------

const LOOT_LOG_KEY = "fake_loot_log";

export type LootItemType = "modifier" | "booster" | "crystal";

export interface LootDropEntry {
  id: number;
  cacheId: string;
  cacheTier: number;
  itemType: LootItemType;
  itemId: string; // modifier name, booster id, or crystal id
  displayName: string;
  rarityTier: number;
  multiplierValue: number; // 0 for non-modifiers
  openedAt: number;
}

function loadLootLog(): LootDropEntry[] {
  try {
    const raw = localStorage.getItem(LOOT_LOG_KEY);
    return raw ? (JSON.parse(raw) as LootDropEntry[]) : [];
  } catch {
    return [];
  }
}

function saveLootLog(data: LootDropEntry[]): void {
  localStorage.setItem(LOOT_LOG_KEY, JSON.stringify(data));
}

export function addLootDrop(entry: Omit<LootDropEntry, "id">): void {
  const log = loadLootLog();
  const id = log.length > 0 ? Math.max(...log.map((e) => e.id)) + 1 : 1;
  log.unshift({ id, ...entry }); // newest first
  saveLootLog(log);
}

export function getLootLog(): LootDropEntry[] {
  return loadLootLog();
}

// ---------------------------------------------------------------------------
// Modifier inventory — local storage for modifiers dropped from caches
// ---------------------------------------------------------------------------

const MODIFIERS_KEY = "fake_modifier_inventory";

export interface LocalModifier {
  instanceId: number;
  modifierType: string;
  displayName: string;
  rarityTier: number;
  assetUrl: string;
  addedAt: number;
  appliedToLand?: string; // land id if applied
}

function loadLocalModifiers(): LocalModifier[] {
  try {
    const raw = localStorage.getItem(MODIFIERS_KEY);
    return raw ? (JSON.parse(raw) as LocalModifier[]) : [];
  } catch {
    return [];
  }
}

function saveLocalModifiers(data: LocalModifier[]): void {
  localStorage.setItem(MODIFIERS_KEY, JSON.stringify(data));
}

export function getLocalModifiers(): LocalModifier[] {
  return loadLocalModifiers().filter((m) => !m.appliedToLand);
}

export function addLocalModifier(
  mod: Omit<LocalModifier, "instanceId" | "addedAt">,
): void {
  const inv = loadLocalModifiers();
  const instanceId =
    inv.length > 0 ? Math.max(...inv.map((m) => m.instanceId)) + 1 : 1;
  inv.unshift({ instanceId, addedAt: Date.now(), ...mod });
  saveLocalModifiers(inv);
}

export function markModifierApplied(instanceId: number, landId: string): void {
  const inv = loadLocalModifiers();
  const idx = inv.findIndex((m) => m.instanceId === instanceId);
  if (idx !== -1) {
    inv[idx].appliedToLand = landId;
    saveLocalModifiers(inv);
  }
}

// ---------------------------------------------------------------------------
// Legacy support for old entries without itemType
export function migrateLootLog(): void {
  const log = loadLootLog();
  let changed = false;
  for (const entry of log) {
    if (!(entry as { itemType?: string }).itemType) {
      (entry as { itemType: string }).itemType = "modifier";
      (entry as { itemId?: string }).itemId =
        (entry as { modifierType?: string }).modifierType ?? "";
      (entry as { displayName?: string }).displayName =
        (entry as { modifierType?: string }).modifierType ?? "";
      changed = true;
    }
  }
  if (changed) saveLootLog(log);
}
