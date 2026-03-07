import Map "mo:core/Map";
import Time "mo:core/Time";
import List "mo:core/List";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Float "mo:core/Float";
import Array "mo:core/Array";
import Principal "mo:core/Principal";
import Iter "mo:core/Iter";
import Order "mo:core/Order";
import Runtime "mo:core/Runtime";

import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";
import OutCall "http-outcalls/outcall";

actor {
  type LandData = {
    landId : Nat;
    owner : Principal;
    lat : Float;
    lon : Float;
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

  type ModifierInstance = {
    modifierInstanceId : Nat;
    modifierType : Text;
    rarity_tier : Nat;
    multiplier_value : Float;
    model_url : Text;
  };

  type ClaimResult = { #Ok : Float; #Err : Text };
  type UpgradeResult = { #Ok : LandData; #Err : Text };

  type GameUserProfile = {
    owner : Principal;
    landIds : [Nat];
    landTokenBalance : Nat;
    modifierInstanceIds : [Nat];
  };

  type TopLandEntry = {
    landId : Nat;
    owner : Principal;
    upgradeLevel : Nat;
    tokenBalance : Float;
  };

  module TopLandEntry {
    public func compare(a : TopLandEntry, b : TopLandEntry) : Order.Order {
      switch (Nat.compare(b.upgradeLevel, a.upgradeLevel)) {
        case (#equal) {
          Float.compare(b.tokenBalance, a.tokenBalance);
        };
        case (other) { other };
      };
    };
  };

  let biomes = ["Forest", "Desert", "Ocean", "Mountain", "Tundra", "Volcano"];

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

  public shared ({ caller }) func getLandData(landId : Nat) : async ?LandData {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can access land data");
    };
    let land = lands.get(landId);
    switch (land) {
      case (?l) {
        if (l.owner != caller and not AccessControl.isAdmin(accessControlState, caller)) {
          Runtime.trap("Unauthorized: Can only view your own land");
        };
        land;
      };
      case (null) { null };
    };
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

  public shared ({ caller }) func mintLand() : async Result<LandData, Text> {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can mint land");
    };

    let profile = switch (gameUserProfiles.get(caller)) {
      case (?p) { p };
      case (null) { return #err("No land tokens in inventory") };
    };

    if (profile.landTokenBalance < 1) { return #err("Insufficient land tokens") };

    let newLandId = nextLandId;
    nextLandId += 1;

    let newLand : LandData = {
      landId = newLandId;
      owner = caller;
      lat = 0.0;
      lon = 0.0;
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

    let updatedProfile : GameUserProfile = {
      owner = profile.owner;
      landIds = profile.landIds.concat([newLandId]);
      landTokenBalance = profile.landTokenBalance - 1;
      modifierInstanceIds = profile.modifierInstanceIds;
    };
    gameUserProfiles.add(caller, updatedProfile);

    #ok newLand;
  };

  public shared ({ caller }) func claimRewards(landId : Nat) : async ClaimResult {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can claim rewards");
    };

    let land = switch (lands.get(landId)) {
      case (null) { return #Err("No such land") };
      case (?land) { land };
    };

    if (land.owner != caller) { return #Err("Not the land's owner") };
    if (land.cycleCharge < 10) { return #Err("Insufficient cycleCharge") };
    if (Time.now() - land.lastClaimTime < 86_400_000_000_000) {
      return #Err("Cooldown active");
    };

    let amount = 100.0 * (land.upgradeLevel + 1).toFloat() * land.baseTokenMultiplier;
    let updatedLand = {
      land with
      cycleCharge = land.cycleCharge - 10;
      lastClaimTime = Time.now();
    };
    lands.add(landId, updatedLand);

    #Ok amount;
  };

  public shared ({ caller }) func upgradePlot(landId : Nat) : async UpgradeResult {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can upgrade plots");
    };

    let land = switch (lands.get(landId)) {
      case (null) { return #Err("No such land") };
      case (?land) { land };
    };

    if (land.owner != caller) { return #Err("Not the land's owner") };
    if (land.upgradeLevel >= 5) { return #Err("Already max level") };

    let updatedLand = {
      land with
      upgradeLevel = land.upgradeLevel + 1;
      baseTokenMultiplier = land.baseTokenMultiplier + 0.2;
    };
    lands.add(landId, updatedLand);

    #Ok updatedLand;
  };

  public shared ({ caller }) func updatePlotName(landId : Nat, name : Text) : async Result<(), Text> {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can update plot names");
    };

    let land = switch (lands.get(landId)) {
      case (null) { return #err("No such land") };
      case (?land) { land };
    };

    if (land.owner != caller) { return #err("Not the land's owner") };
    if (name.size() > 20) { return #err("Name too long") };

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

    if (land.owner != caller) { return #err("Not the land's owner") };

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

  public shared ({ caller }) func getLandOwner(landId : Nat) : async ?Principal {
    switch (marketplaceCanister) {
      case (?marketplace) {
        if (caller != marketplace) {
          Runtime.trap("Unauthorized: Only marketplace canister can call this function");
        };
      };
      case (null) {
        Runtime.trap("Unauthorized: Marketplace canister not set");
      };
    };

    switch (lands.get(landId)) {
      case (?land) { ?land.owner };
      case (null) { null };
    };
  };

  public shared ({ caller }) func transferLand(landId : Nat, to : Principal) : async Result<(), Text> {
    switch (marketplaceCanister) {
      case (?marketplace) {
        if (caller != marketplace) {
          Runtime.trap("Unauthorized: Only marketplace canister can call this function");
        };
      };
      case (null) {
        Runtime.trap("Unauthorized: Marketplace canister not set");
      };
    };

    let land = switch (lands.get(landId)) {
      case (null) { return #err("Land not found") };
      case (?land) { land };
    };

    let oldOwner = land.owner;
    let updatedLand = { land with owner = to };
    lands.add(landId, updatedLand);

    switch (gameUserProfiles.get(oldOwner)) {
      case (?oldProfile) {
        let newLandIds = oldProfile.landIds.filter(func(id) { id != landId });
        let updatedOldProfile = {
          oldProfile with
          landIds = newLandIds;
        };
        gameUserProfiles.add(oldOwner, updatedOldProfile);
      };
      case (null) {};
    };

    switch (gameUserProfiles.get(to)) {
      case (?newProfile) {
        let updatedNewProfile = {
          newProfile with
          landIds = newProfile.landIds.concat([landId]);
        };
        gameUserProfiles.add(to, updatedNewProfile);
      };
      case (null) {
        let newProfile : GameUserProfile = {
          owner = to;
          landIds = [landId];
          landTokenBalance = 0;
          modifierInstanceIds = [];
        };
        gameUserProfiles.add(to, newProfile);
      };
    };

    #ok ();
  };

  public query func getTopLands(n : Nat) : async [TopLandEntry] {
    let allLands = lands.values().toArray();
    let topLandEntries = allLands.map(
      func(land) {
        {
          landId = land.landId;
          owner = land.owner;
          upgradeLevel = land.upgradeLevel;
          tokenBalance = 100.0 * (land.upgradeLevel + 1).toFloat() * land.baseTokenMultiplier;
        };
      },
    );

    let sorted = topLandEntries.sort();
    let limit = Nat.min(n, sorted.size());
    Array.tabulate<TopLandEntry>(limit, func(i) { sorted[i] });
  };

  public shared ({ caller }) func discoverLootCache(tier : Nat) : async Result<LootCache, Text> {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can discover loot caches");
    };

    if (tier < 1 or tier > 3) { return #err("Invalid tier") };

    let cost = switch (tier) {
      case (1) { 200 };
      case (2) { 500 };
      case (3) { 1000 };
      case (_) { return #err("Invalid tier") };
    };

    let allLands = lands.values().toArray();
    let ownedLands = allLands.filter(func(land) { land.owner == caller });

    if (ownedLands.size() == 0) { return #err("No lands owned") };

    let firstLand = ownedLands[0];

    if (firstLand.cycleCharge < cost) { return #err("Insufficient cycleCharge") };

    let updatedLand = { firstLand with cycleCharge = firstLand.cycleCharge - cost };
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
    if (cache.is_opened) { return #err("Cache has been already opened") };

    if (Time.now() - cache.discovered_at < 14_400_000_000_000) {
      let allLands = lands.values().toArray();
      let ownedLands = allLands.filter(func(land) { land.owner == caller });

      if (ownedLands.size() == 0) {
        return #err("Not ready yet and no lands found to pay the opening fee");
      };

      let firstLand = ownedLands[0];
      if (firstLand.cycleCharge < 10) {
        return #err("Not ready yet and insufficient cycleCharge to open early");
      };

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
      case (?profile) {
        let updatedProfile = {
          profile with
          modifierInstanceIds = profile.modifierInstanceIds.concat([nextModifierInstanceId]);
        };
        gameUserProfiles.add(caller, updatedProfile);
      };
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

    lootCaches.add(
      cache_id,
      {
        cache with
        is_opened = true;
      },
    );
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

    if (land.owner != caller) { return #err("Not the land's owner") };

    let owner = modifierOwners.get(modifierInstanceId);
    switch (owner) {
      case (?modOwner) {
        if (modOwner != caller) {
          return #err("Not modifier owner");
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
      attachedModifications = land.attachedModifications.concat([modifierInstance]);
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

    // Manually map and filter the array
    var resultList = List.empty<ModifierInstance>();
    for (instanceId in modifierInstanceIds.values()) {
      switch (modifierOwners.get(instanceId)) {
        case (?_) {
          switch (modifierInstances.get(instanceId)) {
            case (?instance) {
              resultList.add(instance);
            };
            case (_) {};
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
          return #err("Unauthorized: Only governance canister can set all modifiers");
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
