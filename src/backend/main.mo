import Map "mo:core/Map";
import Time "mo:core/Time";
import List "mo:core/List";
import Nat "mo:core/Nat";
import Iter "mo:core/Iter";
import Order "mo:core/Order";
import Text "mo:core/Text";
import Float "mo:core/Float";
import Array "mo:core/Array";
import Int "mo:core/Int";

import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";

import OutCall "http-outcalls/outcall";
import AccessControl "authorization/access-control";
import MixinAuthorization "authorization/MixinAuthorization";


actor {
  public type Coordinates = {
    lat : Float;
    lon : Float;
  };

  public type LandData = {
    landId : Nat;
    principal : Principal;
    coordinates : Coordinates;
    biome : Text;
    upgradeLevel : Nat;
    lastClaimTime : Time.Time;
    plotName : Text;
    decorationURL : ?Text;
    baseTokenMultiplier : Float;
    cycleCharge : Int;
    chargeCap : Nat;
    lastChargeUpdate : Time.Time;
    attachedModifications : [ModifierInstance];
  };

  type LootCache = {
    cache_id : Nat;
    tier : Nat;
    owner : Principal;
    discovered_at : Time.Time;
    is_opened : Bool;
  };

  type Modifier = {
    mod_id : Nat;
    rarity_tier : Nat;
    name : Text;
    multiplier_value : Float;
    asset_url : Text;
  };

  public type ModifierInstance = {
    modifierInstanceId : Nat;
    modifierType : Text;
    rarity_tier : Nat;
    multiplier_value : Float;
    model_url : Text;
  };

  public type ClaimResult = {
    #success : {
      tokensClaimed : Nat;
      newBalance : Nat;
      nextClaimTime : Int;
    };
    #mintFailed : Text;
    #cooldown : { currentBalance : Nat; remainingTime : Int };
    #insufficientCharge : { required : Nat; current : Int };
  };

  public type UpgradeResult = {
    #maxLevelReached : ();
    #success : { newLevel : Nat; remainingTokens : Nat };
    #insufficientTokens : { required : Nat; current : Nat };
  };

  type GameUserProfile = {
    owner : Principal;
    landIds : [Nat];
    landTokenBalance : Nat;
    modifierInstanceIds : [Nat];
  };

  public type TopLandEntry = {
    upgradeLevel : Nat;
    principal : Principal;
    tokenBalance : Nat;
    plotName : Text;
  };

  module TopLandEntry {
    public func compare(a : TopLandEntry, b : TopLandEntry) : Order.Order {
      switch (Nat.compare(b.upgradeLevel, a.upgradeLevel)) {
        case (#equal) {
          Nat.compare(b.tokenBalance, a.tokenBalance);
        };
        case (other) { other };
      };
    };
  };

  let biomes = [
    "Forest",
    "Desert",
    "Ocean",
    "Mountain",
    "Tundra",
    "Volcano",
  ];

  let lands = Map.empty<Nat, LandData>();
  let lootCaches = Map.empty<Nat, LootCache>();
  let gameUserProfiles = Map.empty<Principal, GameUserProfile>();
  let modifierInstances = Map.empty<Nat, ModifierInstance>();
  let modifierOwners = Map.empty<Nat, Principal>();
  var modifiers : [Modifier] = [];
  var marketplaceCanister : ?Principal = null;
  var governanceCanister : ?Principal = null;
  var tokenCanister : ?Principal = null;
  var nextLandId = 0;
  var nextCacheId = 0;
  var nextModifierInstanceId = 0;

  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  public type UserProfile = {
    name : Text;
  };

  let userProfiles = Map.empty<Principal, UserProfile>();

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  type Result<T, E> = {
    #ok : T;
    #err : E;
  };

  public shared ({ caller }) func getLandData() : async [LandData] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can access land data");
    };

    lands.values().toArray().filter(func(land) { land.principal == caller });
  };

  public query ({ caller }) func getLandDataQuery(landId : Nat) : async ?LandData {
    lands.get(landId);
  };

  public shared ({ caller }) func adminGetLandData(landId : Nat) : async ?LandData {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can perform this action");
    };
    lands.get(landId);
  };

  public shared ({ caller }) func mintLand() : async LandData {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can mint land");
    };

    let newLandId = nextLandId;
    nextLandId += 1;

    let newLand : LandData = {
      landId = newLandId;
      principal = caller;
      coordinates = { lat = 0.0; lon = 0.0 };
      biome = biomes[newLandId % 6];
      upgradeLevel = 0;
      lastClaimTime = 0;
      plotName = "Plot #" # newLandId.toText();
      decorationURL = null;
      baseTokenMultiplier = 1.0;
      cycleCharge = 500;
      chargeCap = 1000;
      lastChargeUpdate = Time.now();
      attachedModifications = [];
    };
    lands.add(newLandId, newLand);

    newLand;
  };

  public shared ({ caller }) func claimRewards(landId : Nat) : async ClaimResult {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can claim rewards");
    };

    let land = switch (lands.get(landId)) {
      case (null) { return #mintFailed("No such land") };
      case (?land) { land };
    };

    if (land.principal != caller) { return #mintFailed("Not the owner's principal") };
    if (land.cycleCharge < 10) { return #insufficientCharge({ required = 10; current = land.cycleCharge }) };

    if (Time.now() - land.lastClaimTime < 86_400_000_000_000) {
      return #cooldown({
        currentBalance = Int.abs(land.cycleCharge).toNat();
        remainingTime = (Time.now() - land.lastClaimTime);
      });
    };

    let newBalance = Int.abs(land.cycleCharge - 10).toNat();
    let updatedLand = {
      land with
      cycleCharge = land.cycleCharge - 10;
      lastClaimTime = Time.now();
    };
    lands.add(landId, updatedLand);

    #success({ tokensClaimed = 100; newBalance; nextClaimTime = Time.now() });
  };

  public shared ({ caller }) func upgradePlot(landId : Nat, cost : Nat) : async UpgradeResult {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can upgrade plots");
    };

    let land = switch (lands.get(landId)) {
      case (null) { return #maxLevelReached(()) };
      case (?land) { land };
    };

    if (land.principal != caller) { return #maxLevelReached(()) };
    if (land.upgradeLevel >= 5) { return #maxLevelReached(()) };

    let updatedLand = {
      land with
      upgradeLevel = land.upgradeLevel + 1;
      baseTokenMultiplier = land.baseTokenMultiplier + 0.2;
    };
    lands.add(landId, updatedLand);

    #success({ newLevel = updatedLand.upgradeLevel; remainingTokens = cost });
  };

  public shared ({ caller }) func updatePlotName(landId : Nat, name : Text) : async Result<(), Text> {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can update plot names");
    };

    let land = switch (lands.get(landId)) {
      case (null) { return #err("No such land") };
      case (?land) { land };
    };

    if (land.principal != caller) { return #err("Not the owner's principal") };
    if (name.size() > 30) { return #err("Name too long") };

    let updatedLand = { land with plotName = name };
    lands.add(landId, updatedLand);
    #ok ();
  };

  public shared ({ caller }) func updateDecoration(landId : Nat, url : ?Text) : async Result<(), Text> {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can update decorations");
    };

    let land = switch (lands.get(landId)) {
      case (null) { return #err("No such land") };
      case (?land) { land };
    };

    if (land.principal != caller) { return #err("Not the owner's principal") };

    let updatedLand = { land with decorationURL = url };
    lands.add(landId, updatedLand);
    #ok ();
  };

  public shared ({ caller }) func setMarketplaceCanister(p : Principal) : async () {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can perform this action");
    };
    marketplaceCanister := ?p;
  };

  public shared ({ caller }) func setGovernanceCanister(p : Principal) : async () {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can perform this action");
    };
    governanceCanister := ?p;
  };

  public shared ({ caller }) func setTokenCanister(p : Principal) : async () {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can perform this action");
    };
    tokenCanister := ?p;
  };

  public query ({ caller }) func getLandOwner(landId : Nat) : async ?Principal {
    switch (marketplaceCanister) {
      case (?marketplace) {
        if (caller != marketplace) {
          Runtime.trap("Unauthorized: Only marketplace canister can call this function");
        };
      };
      case (null) { Runtime.trap("Unauthorized: Marketplace canister not set") };
    };

    switch (lands.get(landId)) {
      case (?land) { ?land.principal };
      case (null) { null };
    };
  };

  public shared ({ caller }) func transferLand(landId : Nat, to : Principal) : async Bool {
    switch (marketplaceCanister) {
      case (?marketplace) {
        if (caller != marketplace) {
          Runtime.trap("Unauthorized: Only marketplace canister can call this function");
        };
      };
      case (null) { Runtime.trap("Unauthorized: Marketplace canister not set") };
    };

    let land = switch (lands.get(landId)) {
      case (null) { return false };
      case (?land) { land };
    };

    let updatedLand = { land with principal = to };
    lands.add(landId, updatedLand);
    true;
  };

  public query ({ caller }) func getTopLands(_n : Nat) : async [TopLandEntry] {
    let allLands = lands.values().toArray();
    let topLandEntries = allLands.map(
      func(land) {
        {
          upgradeLevel = land.upgradeLevel;
          principal = land.principal;
          tokenBalance = (100 * (land.upgradeLevel + 1));
          plotName = land.plotName;
        };
      }
    );

    let sorted = topLandEntries.sort();
    Array.tabulate<TopLandEntry>(sorted.size(), func(i) { sorted[i] });
  };

  public shared ({ caller }) func discoverLootCache(tier : Nat) : async Result<LootCache, Text> {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can discover loot caches");
    };

    if (tier < 1) { return #err("Invalid tier") };

    let allLands = lands.values().toArray().filter(func(land) { land.principal == caller });

    if (allLands.size() == 0) { return #err("No lands owned") };

    let firstLand = allLands[0];

    let updatedLand = { firstLand with cycleCharge = firstLand.cycleCharge - 10 };
    lands.add(updatedLand.landId, updatedLand);

    let newCache : LootCache = {
      cache_id = nextCacheId;
      tier;
      owner = caller;
      discovered_at = Time.now();
      is_opened = false;
    };
    lootCaches.add(nextCacheId, newCache);
    nextCacheId += 1;

    #ok newCache;
  };

  public shared ({ caller }) func processCache(cache_id : Nat) : async Result<ModifierInstance, Text> {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can process caches");
    };

    let cache = switch (lootCaches.get(cache_id)) {
      case (null) { return #err("Cache not found") };
      case (?cache) { cache };
    };

    if (cache.owner != caller) { return #err("Cache not owned") };
    if (cache.is_opened) { return #err("Cache already opened") };

    if (Time.now() - cache.discovered_at < 14_400_000_000_000) {
      let allLands = lands.values().toArray().filter(func(land) { land.principal == caller });

      if (allLands.size() == 0) { return #err("Not ready yet and no lands found to pay the opening fee") };

      let firstLand = allLands[0];
      lands.add(firstLand.landId, { firstLand with cycleCharge = firstLand.cycleCharge - 10 });
    };

    let modifier = if (modifiers.size() > 0) {
      modifiers[cache_id % modifiers.size()];
    } else {
      return #err("No modifiers available");
    };

    let instance : ModifierInstance = {
      modifierInstanceId = nextModifierInstanceId;
      modifierType = modifier.name;
      rarity_tier = modifier.rarity_tier;
      multiplier_value = modifier.multiplier_value;
      model_url = modifier.asset_url;
    };

    modifierInstances.add(nextModifierInstanceId, instance);
    modifierOwners.add(nextModifierInstanceId, cache.owner);

    let userProfile = gameUserProfiles.get(caller);
    switch (userProfile) {
      case (?_) {};
      case (_) {
        gameUserProfiles.add(
          caller,
          {
            owner = caller;
            landIds = [];
            landTokenBalance = 0;
            modifierInstanceIds = [nextModifierInstanceId];
          },
        );
      };
    };
    lootCaches.add(cache_id, { cache with is_opened = true });
    nextModifierInstanceId += 1;
    #ok instance;
  };

  public shared ({ caller }) func applyModifier(landId : Nat, modifierInstanceId : Nat) : async Result<LandData, Text> {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can apply modifiers");
    };

    let land = switch (lands.get(landId)) {
      case (null) { return #err("Land not found") };
      case (?land) { land };
    };

    if (land.principal != caller) {
      return #err("Not the land's principal");
    };

    let owner = modifierOwners.get(modifierInstanceId);
    switch (owner) {
      case (?modOwner) {
        if (modOwner != caller) {
          return #err("Modifier not owned by caller");
        };
      };
      case (_) { return #err("Modifier not found") };
    };

    let modifierInstance = switch (modifierInstances.get(modifierInstanceId)) {
      case (null) { return #err("Modifier instance not found") };
      case (?inst) { inst };
    };

    let updatedLand = {
      land with
      attachedModifications = land.attachedModifications.concat(
        [modifierInstance]
      );
    };
    lands.add(landId, updatedLand);

    modifierOwners.remove(modifierInstanceId);
    #ok updatedLand;
  };

  public query ({ caller }) func getMyLootCaches() : async [LootCache] {
    let allCaches = lootCaches.values().toArray();
    allCaches.filter<LootCache>(func(cache) { cache.owner == caller });
  };

  public query ({ caller }) func getMyModifications() : async [ModifierInstance] {
    let modifierInstanceIds = switch (gameUserProfiles.get(caller)) {
      case (null) { [] };
      case (?profile) { profile.modifierInstanceIds };
    };

    var resultList = List.empty<ModifierInstance>();
    for (instanceId in modifierInstanceIds.values()) {
      switch (modifierOwners.get(instanceId)) {
        case (?owner) {
          if (owner == caller) {
            switch (modifierInstances.get(instanceId)) {
              case (?instance) {
                resultList.add(instance);
              };
              case (_) {};
            };
          };
        };
        case (_) {};
      };
    };

    resultList.toArray();
  };

  public shared ({ caller }) func adminSetAllModifiers(mods : [Modifier]) : async Result<(), Text> {
    switch (governanceCanister) {
      case (?governance) {
        if (caller != governance) {
          return #err("Unauthorized: Only governance canister can call this function");
        };
      };
      case (null) {
        return #err("Unauthorized: Governance canister not set");
      };
    };

    modifiers := mods;
    #ok ();
  };

  public query func getAllModifiers() : async [Modifier] {
    modifiers;
  };

  public query func getCurrentCbrBalance() : async Float {
    0.0;
  };

  public query func transform(raw : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(raw);
  };

  public shared ({ caller }) func getAssetCanisterCycleBalance() : async Result<Text, Text> {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      return #err("Unauthorized: Only admins can perform this action");
    };

    let url = "https://icp-api.io/api/v3/canisters/bd3sg-teaaa-aaaaa-qaaba-cai";
    switch (await OutCall.httpGetRequest(url, [], transform)) {
      case (response) { #ok response };
      case (_) { #err("Cannot reach icp-api.io!") };
    };
  };
};
