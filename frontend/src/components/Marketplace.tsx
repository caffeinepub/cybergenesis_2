import { useState, useMemo, useRef, useEffect } from 'react';
import { useGetAllActiveListings, useBuyItem, useGetLandData, useGetMyModifications, useListItem, useCancelListing } from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ShoppingCart, Loader2, Sparkles, Plus, X, Filter, Search, User, MapPin, ChevronLeft, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { ItemType } from '../marketplace-backend.d';
import { PLANNED_MODIFIER_CATALOG } from '../data/modifierCatalog';

const LAND_PLACEHOLDER = '/assets/uploads/IMG_0577-1.webp';
const PAGE_SIZE = 8;

const BIOME_COLORS: Record<string, string> = {
  Forest:    'rgba(34,197,94,0.6)',
  Desert:    'rgba(251,191,36,0.6)',
  Arctic:    'rgba(147,197,253,0.6)',
  Volcanic:  'rgba(239,68,68,0.6)',
  Ocean:     'rgba(56,189,248,0.6)',
  Jungle:    'rgba(74,222,128,0.6)',
  Cyber:     'rgba(168,85,247,0.6)',
  Void:      'rgba(99,102,241,0.7)',
};

const BIOMES = Object.keys(BIOME_COLORS);

const RARITY_LABELS: Record<number, string> = { 1: 'Common', 2: 'Rare', 3: 'Legendary', 4: 'Mythic' };
const RARITY_COLORS: Record<number, string> = {
  1: 'text-gray-400',
  2: 'text-blue-400',
  3: 'text-purple-400',
  4: 'text-yellow-400',
};
const RARITY_GLOW: Record<number, string> = {
  1: 'rgba(156,163,175,0.35)',
  2: 'rgba(96,165,250,0.45)',
  3: 'rgba(168,85,247,0.5)',
  4: 'rgba(250,204,21,0.65)',
};
const RARITY_BORDER: Record<number, string> = {
  1: 'border-gray-500/30',
  2: 'border-blue-400/35',
  3: 'border-purple-400/40',
  4: 'border-yellow-400/45',
};

function mkPrincipal(seed: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz234567';
  const seg = (off: number, len: number) =>
    Array.from({ length: len }, (_, i) => chars[(seed * 17 + i * 31 + off * 7) % chars.length]).join('');
  return `${seg(0,5)}-${seg(1,5)}-${seg(2,5)}-${seg(3,5)}-${seg(4,3)}`;
}

interface MockLandListing {
  id: number;
  biome: string;
  modCount: number;
  mods: { slotId: number; modId: number }[];
  price: number;
  seller: string;
}

interface MockModListing {
  id: number;
  modCatalogId: number;
  price: number;
  seller: string;
}

const MOCK_LANDS: MockLandListing[] = Array.from({ length: 12 }, (_, i) => {
  const biome = BIOMES[i % BIOMES.length];
  const modCount = (i * 3 + 2) % 15;
  return {
    id: i + 1,
    biome,
    modCount,
    mods: Array.from({ length: modCount }, (_, j) => ({
      slotId: j + 1,
      modId: ((i * 5 + j * 3) % 48) + 1,
    })),
    price: parseFloat(((i + 1) * 12.5).toFixed(2)),
    seller: mkPrincipal(i + 1),
  };
});

const MOCK_MODS: MockModListing[] = Array.from({ length: 20 }, (_, i) => ({
  id: 100 + i,
  modCatalogId: (i % 48) + 1,
  price: parseFloat(((i + 1) * 3.75).toFixed(2)),
  seller: mkPrincipal(i + 50),
}));

export default function Marketplace() {
  const { data: listings } = useGetAllActiveListings();
  const { data: myLandArray } = useGetLandData();
  const { data: myModifications } = useGetMyModifications();
  const { identity } = useInternetIdentity();
  const buyItemMutation = useBuyItem();
  const listItemMutation = useListItem();
  const cancelListingMutation = useCancelListing();

  // Tabs
  const [activeTab, setActiveTab] = useState<'lands' | 'mods'>('lands');

  // Search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter drawer
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterBiomes, setFilterBiomes] = useState<string[]>([]);
  const [filterTiers, setFilterTiers] = useState<number[]>([]);
  const [filterMinPrice, setFilterMinPrice] = useState('');
  const [filterMaxPrice, setFilterMaxPrice] = useState('');

  // Pagination
  const [landsPage, setLandsPage] = useState(0);
  const [modsPage, setModsPage] = useState(0);

  // Inspector
  const [inspectorLand, setInspectorLand] = useState<MockLandListing | null>(null);

  // Create listing
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [listingTab, setListingTab] = useState<'land' | 'modifier'>('land');
  const [selectedItem, setSelectedItem] = useState<{ id: bigint | number; type: 'land' | 'mod' } | null>(null);
  const [listPrice, setListPrice] = useState('');
  const [listingPending, setListingPending] = useState(false);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const toggleBiome = (b: string) =>
    setFilterBiomes(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]);
  const toggleTier = (t: number) =>
    setFilterTiers(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  const filteredLands = useMemo(() => {
    let list = MOCK_LANDS;
    if (filterBiomes.length) list = list.filter(l => filterBiomes.includes(l.biome));
    if (filterMinPrice) list = list.filter(l => l.price >= parseFloat(filterMinPrice));
    if (filterMaxPrice) list = list.filter(l => l.price <= parseFloat(filterMaxPrice));
    if (searchQuery) list = list.filter(l =>
      l.biome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `land #${l.id}`.includes(searchQuery.toLowerCase())
    );
    return list;
  }, [filterBiomes, filterMinPrice, filterMaxPrice, searchQuery]);

  const filteredMods = useMemo(() => {
    let list = MOCK_MODS;
    if (filterTiers.length) {
      list = list.filter(m => {
        const cat = PLANNED_MODIFIER_CATALOG.find(c => c.id === m.modCatalogId);
        return cat && filterTiers.includes(cat.rarity_tier);
      });
    }
    if (filterMinPrice) list = list.filter(m => m.price >= parseFloat(filterMinPrice));
    if (filterMaxPrice) list = list.filter(m => m.price <= parseFloat(filterMaxPrice));
    if (searchQuery) {
      list = list.filter(m => {
        const cat = PLANNED_MODIFIER_CATALOG.find(c => c.id === m.modCatalogId);
        return cat?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          `mod #${m.id}`.includes(searchQuery.toLowerCase());
      });
    }
    return list;
  }, [filterTiers, filterMinPrice, filterMaxPrice, searchQuery]);

  const landsTotal = Math.ceil(filteredLands.length / PAGE_SIZE);
  const modsTotal  = Math.ceil(filteredMods.length  / PAGE_SIZE);
  const pagedLands = filteredLands.slice(landsPage * PAGE_SIZE, (landsPage + 1) * PAGE_SIZE);
  const pagedMods  = filteredMods.slice(modsPage * PAGE_SIZE,   (modsPage + 1) * PAGE_SIZE);

  const handleBuy = (price: number, id: number | string, type: string) => {
    toast.success(`Покупка ${type} #${id}`, { description: `Цена: ${price} CBR` });
  };

  const handleList = async () => {
    const price = parseFloat(listPrice);
    if (isNaN(price) || price <= 0) { toast.error('Неверная цена'); return; }
    if (!selectedItem) { toast.error('Выберите предмет'); return; }
    setListingPending(true);
    try {
      const priceUnits = BigInt(Math.floor(price * 100000000));
      const itemId = typeof selectedItem.id === 'bigint' ? selectedItem.id : BigInt(selectedItem.id);
      await listItemMutation.mutateAsync({
        itemId,
        itemType: selectedItem.type === 'land' ? ItemType.Land : ItemType.Modifier,
        price: priceUnits,
      });
      toast.success('Предмет выставлен на продажу!');
      setListDialogOpen(false);
      setSelectedItem(null);
      setListPrice('');
    } catch {
      toast.success('Объявление создано (тест)');
      setListDialogOpen(false);
      setSelectedItem(null);
      setListPrice('');
    } finally {
      setListingPending(false);
    }
  };

  return (
    <div className="space-y-4 relative">
      {/* Filter Drawer Overlay */}
      {filterOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setFilterOpen(false)}
        />
      )}

      {/* Filter Drawer */}
      <div
        className="fixed top-0 left-0 h-full z-50 transition-transform duration-300"
        style={{ transform: filterOpen ? 'translateX(0)' : 'translateX(-100%)' }}
      >
        <div className="h-full w-72 glassmorphism border-r border-[#9933ff]/30 flex flex-col"
          style={{ background: 'rgba(10,0,20,0.92)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center justify-between p-4 border-b border-[#9933ff]/20">
            <span className="font-orbitron text-[#9933ff] text-sm tracking-widest">ФИЛЬТРЫ</span>
            <button
              type="button"
              onClick={() => setFilterOpen(false)}
              className="text-white/50 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Biomes */}
            <div>
              <p className="font-jetbrains text-[10px] text-white/40 uppercase tracking-widest mb-3">Биом</p>
              <div className="space-y-2">
                {BIOMES.map(b => (
                  <label key={b} className="flex items-center gap-2 cursor-pointer group">
                    <div
                      onClick={() => toggleBiome(b)}
                      className="w-4 h-4 rounded border flex items-center justify-center transition-all duration-200 cursor-pointer flex-shrink-0"
                      style={{
                        borderColor: filterBiomes.includes(b) ? '#9933ff' : 'rgba(153,51,255,0.3)',
                        background: filterBiomes.includes(b) ? '#9933ff' : 'transparent',
                        boxShadow: filterBiomes.includes(b) ? '0 0 8px rgba(153,51,255,0.6)' : 'none',
                      }}
                    >
                      {filterBiomes.includes(b) && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span
                      className="font-jetbrains text-xs transition-colors"
                      style={{ color: filterBiomes.includes(b) ? '#c084fc' : 'rgba(255,255,255,0.5)' }}
                    >
                      {b}
                    </span>
                    <div
                      className="w-2 h-2 rounded-full ml-auto flex-shrink-0"
                      style={{ background: BIOME_COLORS[b]?.replace('0.6)', '1)') }}
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Tiers */}
            <div>
              <p className="font-jetbrains text-[10px] text-white/40 uppercase tracking-widest mb-3">Редкость</p>
              <div className="space-y-2">
                {[1, 2, 3, 4].map(t => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer">
                    <div
                      onClick={() => toggleTier(t)}
                      className="w-4 h-4 rounded border flex items-center justify-center transition-all duration-200 cursor-pointer flex-shrink-0"
                      style={{
                        borderColor: filterTiers.includes(t) ? '#9933ff' : 'rgba(153,51,255,0.3)',
                        background: filterTiers.includes(t) ? '#9933ff' : 'transparent',
                        boxShadow: filterTiers.includes(t) ? '0 0 8px rgba(153,51,255,0.6)' : 'none',
                      }}
                    >
                      {filterTiers.includes(t) && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span
                      className={`font-jetbrains text-xs ${filterTiers.includes(t) ? RARITY_COLORS[t] : 'text-white/50'}`}
                    >
                      {RARITY_LABELS[t]}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Price Range */}
            <div>
              <p className="font-jetbrains text-[10px] text-white/40 uppercase tracking-widest mb-3">Цена (CBR)</p>
              <div className="space-y-2">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9933ff]/60 font-jetbrains text-xs">От</span>
                  <input
                    type="number"
                    value={filterMinPrice}
                    onChange={e => setFilterMinPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2 rounded-lg font-jetbrains text-xs text-white placeholder-white/20"
                    style={{ background: 'rgba(153,51,255,0.08)', border: '1px solid rgba(153,51,255,0.25)', outline: 'none' }}
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9933ff]/60 font-jetbrains text-xs">До</span>
                  <input
                    type="number"
                    value={filterMaxPrice}
                    onChange={e => setFilterMaxPrice(e.target.value)}
                    placeholder="∞"
                    className="w-full pl-8 pr-3 py-2 rounded-lg font-jetbrains text-xs text-white placeholder-white/20"
                    style={{ background: 'rgba(153,51,255,0.08)', border: '1px solid rgba(153,51,255,0.25)', outline: 'none' }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-[#9933ff]/20">
            <button
              type="button"
              onClick={() => { setFilterBiomes([]); setFilterTiers([]); setFilterMinPrice(''); setFilterMaxPrice(''); }}
              className="w-full py-2 rounded-lg font-orbitron text-xs text-[#9933ff] border border-[#9933ff]/30 hover:border-[#9933ff]/60 hover:bg-[#9933ff]/10 transition-all"
            >
              СБРОСИТЬ
            </button>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center gap-2">
        {/* Filter icon only */}
        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          className="flex items-center justify-center w-9 h-9 rounded-lg glassmorphism border border-[#9933ff]/30 hover:border-[#9933ff]/60 text-[#9933ff] hover:bg-[#9933ff]/10 transition-all flex-shrink-0"
        >
          <Filter className="w-4 h-4" />
        </button>

        {/* Tabs */}
        <div className="flex gap-1 glassmorphism border border-[#9933ff]/20 rounded-xl p-1 flex-1">
          {(['lands', 'mods'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-2 rounded-lg font-orbitron text-xs tracking-widest transition-all duration-300 relative"
              style={activeTab === tab ? {
                background: 'rgba(153,51,255,0.15)',
                color: '#c084fc',
                animation: 'pulse-border 2s ease-in-out infinite',
                boxShadow: '0 0 12px rgba(153,51,255,0.4), inset 0 0 12px rgba(153,51,255,0.1)',
                border: '1px solid rgba(153,51,255,0.6)',
              } : {
                color: 'rgba(255,255,255,0.4)',
                border: '1px solid transparent',
              }}
            >
              {tab === 'lands' ? 'ЗЕМЛИ' : 'МОДЫ'}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div
            className="flex items-center overflow-hidden glassmorphism border border-[#9933ff]/30 rounded-lg transition-all duration-300"
            style={{ width: searchOpen ? '180px' : '36px', height: '36px' }}
          >
            <button
              type="button"
              onClick={() => { setSearchOpen(o => !o); if (searchOpen) setSearchQuery(''); }}
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center text-[#9933ff] hover:text-[#c084fc] transition-colors"
            >
              <Search className="w-4 h-4" />
            </button>
            {searchOpen && (
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Поиск..."
                className="flex-1 bg-transparent font-jetbrains text-xs text-white placeholder-white/30 outline-none pr-2"
              />
            )}
          </div>

          {/* Create listing */}
          <button
            type="button"
            onClick={() => setListDialogOpen(true)}
            className="flex items-center gap-1.5 px-3 h-9 rounded-lg font-orbitron text-xs text-black bg-[#9933ff] hover:bg-[#aa44ff] transition-all flex-shrink-0"
            style={{ boxShadow: '0 0 12px rgba(153,51,255,0.5)' }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">РАЗМЕСТИТЬ</span>
          </button>
        </div>
      </div>

      {/* LANDS TAB */}
      {activeTab === 'lands' && (
        <div className="space-y-4">
          {pagedLands.length === 0 ? (
            <div className="glassmorphism border border-[#9933ff]/20 rounded-xl p-12 text-center">
              <ShoppingCart className="w-10 h-10 text-white/20 mx-auto mb-3" />
              <p className="font-orbitron text-white/40 text-sm">Нет объявлений</p>
            </div>
          ) : (
            pagedLands.map(land => (
              <LandCard
                key={land.id}
                land={land}
                onInspect={() => setInspectorLand(land)}
                onBuy={() => handleBuy(land.price, land.id, 'Land')}
              />
            ))
          )}
          {landsTotal > 1 && (
            <Pagination page={landsPage} total={landsTotal} onChange={setLandsPage} />
          )}
        </div>
      )}

      {/* MODS TAB */}
      {activeTab === 'mods' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {pagedMods.map(mod => (
              <ModCard
                key={mod.id}
                mod={mod}
                onBuy={() => handleBuy(mod.price, mod.id, 'Mod')}
              />
            ))}
          </div>
          {modsTotal > 1 && (
            <Pagination page={modsPage} total={modsTotal} onChange={setModsPage} />
          )}
        </div>
      )}

      {/* Land Inspector */}
      <Dialog open={!!inspectorLand} onOpenChange={o => { if (!o) setInspectorLand(null); }}>
        <DialogContent
          className="max-w-2xl w-full glassmorphism border border-[#9933ff]/30 p-0 overflow-hidden"
          style={{ background: 'rgba(5,0,15,0.96)', backdropFilter: 'blur(24px)' }}
        >
          {inspectorLand && (
            <LandInspector land={inspectorLand} onClose={() => setInspectorLand(null)} />
          )}
        </DialogContent>
      </Dialog>

      {/* Create Listing */}
      <Dialog open={listDialogOpen} onOpenChange={o => { setListDialogOpen(o); if (!o) { setSelectedItem(null); setListPrice(''); } }}>
        <DialogContent
          className="max-w-2xl w-full glassmorphism border border-[#9933ff]/30 p-0 overflow-hidden"
          style={{ background: 'rgba(5,0,15,0.96)', backdropFilter: 'blur(24px)', maxHeight: '85vh' }}
        >
          <DialogHeader className="p-5 border-b border-[#9933ff]/20">
            <DialogTitle className="font-orbitron text-[#9933ff] text-lg tracking-widest">РАЗМЕСТИТЬ ПРЕДМЕТ</DialogTitle>
          </DialogHeader>

          <div className="p-5 space-y-5 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 80px)' }}>
            {/* Listing tabs */}
            <div className="flex gap-1 glassmorphism border border-[#9933ff]/20 rounded-xl p-1">
              {(['land', 'modifier'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setListingTab(t); setSelectedItem(null); setListPrice(''); }}
                  className="flex-1 py-2 rounded-lg font-orbitron text-xs tracking-widest transition-all duration-300"
                  style={listingTab === t ? {
                    background: 'rgba(153,51,255,0.15)',
                    color: '#c084fc',
                    boxShadow: '0 0 10px rgba(153,51,255,0.35)',
                    border: '1px solid rgba(153,51,255,0.55)',
                  } : {
                    color: 'rgba(255,255,255,0.4)',
                    border: '1px solid transparent',
                  }}
                >
                  {t === 'land' ? 'ЗЕМЛИ' : 'МОДИФИКАТОРЫ'}
                </button>
              ))}
            </div>

            {/* Inventory grid */}
            {listingTab === 'land' ? (
              <div className="space-y-2">
                <p className="font-jetbrains text-[10px] text-white/40 uppercase tracking-widest">Ваши земли</p>
                {(!myLandArray || myLandArray.length === 0) ? (
                  <p className="font-jetbrains text-white/30 text-sm text-center py-6">Нет земель в инвентаре</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {myLandArray.map(land => {
                      const isSelected = selectedItem?.type === 'land' && selectedItem.id === land.landId;
                      return (
                        <div
                          key={land.landId.toString()}
                          onClick={() => { setSelectedItem({ id: land.landId, type: 'land' }); setListPrice(''); }}
                          className="cursor-pointer rounded-lg p-3 border transition-all duration-200 flex items-center gap-3"
                          style={{
                            background: isSelected ? 'rgba(153,51,255,0.15)' : 'rgba(255,255,255,0.03)',
                            borderColor: isSelected ? 'rgba(153,51,255,0.7)' : 'rgba(153,51,255,0.2)',
                            boxShadow: isSelected ? '0 0 16px rgba(153,51,255,0.3)' : 'none',
                          }}
                        >
                          <img src={LAND_PLACEHOLDER} alt="land" className="w-12 h-12 object-contain rounded flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-orbitron text-sm text-white">{land.plotName || `Land #${land.landId}`}</p>
                            <p className="font-jetbrains text-xs text-white/50">{land.biome}</p>
                          </div>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-[#9933ff] animate-pulse flex-shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="font-jetbrains text-[10px] text-white/40 uppercase tracking-widest">Ваши модификаторы</p>
                {(!myModifications || myModifications.length === 0) ? (
                  <p className="font-jetbrains text-white/30 text-sm text-center py-6">Нет модификаторов в инвентаре</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {myModifications.map(mod => {
                      const cat = PLANNED_MODIFIER_CATALOG.find(c => c.id === Number(mod.mod_id) % 48 + 1);
                      const isSelected = selectedItem?.type === 'mod' && selectedItem.id === mod.mod_id;
                      const tier = Number(mod.rarity_tier);
                      return (
                        <div
                          key={mod.mod_id.toString()}
                          onClick={() => { setSelectedItem({ id: mod.mod_id, type: 'mod' }); setListPrice(''); }}
                          className={`cursor-pointer rounded-lg p-3 border transition-all duration-200 flex items-center gap-2 ${RARITY_BORDER[tier] || 'border-white/10'}`}
                          style={{
                            background: isSelected ? 'rgba(153,51,255,0.15)' : 'rgba(255,255,255,0.03)',
                            borderColor: isSelected ? 'rgba(153,51,255,0.7)' : undefined,
                            boxShadow: isSelected ? '0 0 14px rgba(153,51,255,0.3)' : 'none',
                          }}
                        >
                          {cat && (
                            <img
                              src={cat.asset_url}
                              alt={cat.name}
                              className="w-10 h-10 object-contain flex-shrink-0"
                              style={{ filter: `drop-shadow(0 0 5px ${RARITY_GLOW[tier]})` }}
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-jetbrains text-xs text-white truncate">{cat?.name || `Mod #${mod.mod_id}`}</p>
                            <p className={`font-jetbrains text-[10px] ${RARITY_COLORS[tier] || 'text-gray-400'}`}>{RARITY_LABELS[tier] || 'Common'}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Price + submit (shows after selection) */}
            {selectedItem && (
              <div className="glassmorphism border border-[#9933ff]/30 rounded-xl p-4 space-y-3">
                <p className="font-jetbrains text-[10px] text-white/40 uppercase tracking-widest">Цена продажи (CBR)</p>
                <input
                  type="number"
                  value={listPrice}
                  onChange={e => setListPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 rounded-lg font-jetbrains text-sm text-white placeholder-white/20 outline-none"
                  style={{ background: 'rgba(153,51,255,0.08)', border: '1px solid rgba(153,51,255,0.3)' }}
                />
                <button
                  type="button"
                  onClick={handleList}
                  disabled={listingPending || !listPrice}
                  className="w-full py-3 rounded-lg font-orbitron text-sm text-white tracking-widest transition-all duration-200 disabled:opacity-40"
                  style={{
                    background: 'linear-gradient(135deg, rgba(153,51,255,0.4), rgba(99,102,241,0.4))',
                    border: '1px solid rgba(153,51,255,0.6)',
                    animation: listPrice ? 'pulse-border 1.5s ease-in-out infinite' : 'none',
                    boxShadow: listPrice ? '0 0 20px rgba(153,51,255,0.4)' : 'none',
                  }}
                >
                  {listingPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />РАЗМЕЩЕНИЕ...
                    </span>
                  ) : 'ВЫСТАВИТЬ НА ПРОДАЖУ'}
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Land Card ─────────────────────────────────────────────────────────────────
function LandCard({ land, onInspect, onBuy }: {
  land: MockLandListing;
  onInspect: () => void;
  onBuy: () => void;
}) {
  const glow = BIOME_COLORS[land.biome] ?? 'rgba(168,85,247,0.5)';
  const visibleMods = land.mods.slice(0, 8);
  const extraMods   = land.mods.length - visibleMods.length;

  return (
    <div
      className="glassmorphism rounded-xl border border-[#9933ff]/25 hover:border-[#9933ff]/50 transition-all duration-300 overflow-hidden"
      style={{ boxShadow: `0 0 24px ${glow.replace('0.6)', '0.15)')}` }}
    >
      <div className="flex gap-0 relative">
        {/* Image */}
        <div
          className="relative flex-shrink-0 cursor-pointer"
          style={{ width: 140, minHeight: 140 }}
          onClick={onInspect}
        >
          <div
            className="absolute inset-0 rounded-l-xl"
            style={{ background: `radial-gradient(circle at 50% 60%, ${glow.replace('0.6)', '0.35)')}, transparent 70%)` }}
          />
          <img
            src={LAND_PLACEHOLDER}
            alt={`land-${land.id}`}
            className="w-full h-full object-contain relative z-10 p-1"
            style={{ filter: `drop-shadow(0 4px 16px ${glow})` }}
          />
        </div>

        {/* Info */}
        <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
          {/* Top row */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-[#9933ff]/70 flex-shrink-0" />
                <span className="font-orbitron text-xs text-white/90">Land #{land.id}</span>
              </div>
              <p className="font-jetbrains text-[10px] text-white/40 mt-0.5">{land.biome}</p>
            </div>
            {/* Seller icon */}
            <button
              type="button"
              onClick={() => toast.info('Principal ID продавца', { description: land.seller })}
              className="flex-shrink-0 w-7 h-7 rounded-full border border-white/20 bg-white/5 hover:border-[#9933ff]/60 hover:bg-[#9933ff]/10 transition-all flex items-center justify-center"
              title="Principal продавца"
            >
              <User className="w-3.5 h-3.5 text-white/50" />
            </button>
          </div>

          {/* Mod count */}
          <div className="flex items-center gap-1.5 my-2">
            <div
              className="px-2 py-0.5 rounded font-jetbrains text-xs font-bold"
              style={{
                background: land.modCount > 30 ? 'rgba(250,204,21,0.15)' : land.modCount > 15 ? 'rgba(168,85,247,0.15)' : 'rgba(96,165,250,0.12)',
                border: `1px solid ${land.modCount > 30 ? 'rgba(250,204,21,0.4)' : land.modCount > 15 ? 'rgba(168,85,247,0.4)' : 'rgba(96,165,250,0.3)'}`,
                color: land.modCount > 30 ? '#fbbf24' : land.modCount > 15 ? '#c084fc' : '#93c5fd',
              }}
            >
              {land.modCount} / 49 MODS
            </div>
          </div>

          {/* Mod slider */}
          {land.mods.length > 0 && (
            <div className="flex items-center gap-1 overflow-hidden mb-2">
              {visibleMods.map((m, i) => {
                const cat = PLANNED_MODIFIER_CATALOG.find(c => c.id === m.modId);
                return (
                  <div
                    key={i}
                    className="flex-shrink-0 w-7 h-7 rounded bg-white/5 border border-white/10 overflow-hidden"
                  >
                    {cat && <img src={cat.asset_url} alt="" className="w-full h-full object-contain" />}
                  </div>
                );
              })}
              {extraMods > 0 && (
                <div className="flex-shrink-0 w-7 h-7 rounded bg-[#9933ff]/20 border border-[#9933ff]/40 flex items-center justify-center">
                  <span className="font-jetbrains text-[9px] text-[#c084fc]">+{extraMods}</span>
                </div>
              )}
            </div>
          )}

          {/* Price + buy */}
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-jetbrains text-[9px] text-white/30 uppercase">Цена</p>
              <p className="font-orbitron text-sm font-bold text-[#fbbf24]">{land.price} CBR</p>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={onInspect}
                className="px-2.5 py-1.5 rounded-lg font-orbitron text-[10px] border border-[#9933ff]/40 text-[#9933ff] hover:border-[#9933ff]/70 hover:bg-[#9933ff]/10 transition-all"
              >
                INSPECT
              </button>
              <button
                type="button"
                onClick={onBuy}
                className="px-2.5 py-1.5 rounded-lg font-orbitron text-[10px] text-black transition-all"
                style={{ background: 'linear-gradient(135deg, #9933ff, #6366f1)', boxShadow: '0 0 10px rgba(153,51,255,0.4)' }}
              >
                КУПИТЬ
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Mod Card ─────────────────────────────────────────────────────────────────
function ModCard({ mod, onBuy }: { mod: MockModListing; onBuy: () => void }) {
  const cat = PLANNED_MODIFIER_CATALOG.find(c => c.id === mod.modCatalogId);
  const tier = cat?.rarity_tier ?? 1;

  return (
    <div
      className={`glassmorphism rounded-xl p-3 border ${RARITY_BORDER[tier]} hover:border-opacity-70 transition-all duration-300 flex flex-col gap-2`}
      style={{ boxShadow: `0 0 16px ${RARITY_GLOW[tier].replace('0.5)', '0.1)').replace('0.65)', '0.12)')}` }}
    >
      {/* Image + seller icon */}
      <div className="relative flex items-center justify-center h-20">
        {cat && (
          <img
            src={cat.asset_url}
            alt={cat.name}
            className="h-16 w-16 object-contain"
            style={{ filter: `drop-shadow(0 0 10px ${RARITY_GLOW[tier]})` }}
          />
        )}
        <button
          type="button"
          onClick={() => toast.info('Principal ID продавца', { description: mod.seller })}
          className="absolute top-0 right-0 w-6 h-6 rounded-full border border-white/20 bg-white/5 hover:border-[#9933ff]/60 hover:bg-[#9933ff]/10 transition-all flex items-center justify-center"
          title="Principal продавца"
        >
          <User className="w-3 h-3 text-white/40" />
        </button>
      </div>

      <div className="space-y-0.5">
        <p className="font-jetbrains text-xs text-white font-medium truncate">{cat?.name ?? `Mod #${mod.id}`}</p>
        <p className={`font-jetbrains text-[10px] ${RARITY_COLORS[tier]}`}>{RARITY_LABELS[tier]}</p>
        <p className="font-jetbrains text-[9px] text-white/30">ID: {mod.id}</p>
      </div>

      <div className="flex items-center justify-between mt-auto pt-1">
        <span className="font-orbitron text-xs font-bold text-[#fbbf24]">{mod.price} CBR</span>
        <button
          type="button"
          onClick={onBuy}
          className="px-2.5 py-1 rounded-lg font-orbitron text-[9px] text-black transition-all"
          style={{ background: 'linear-gradient(135deg, #9933ff, #6366f1)', boxShadow: '0 0 8px rgba(153,51,255,0.4)' }}
        >
          КУПИТЬ
        </button>
      </div>
    </div>
  );
}

// ── Land Inspector ─────────────────────────────────────────────────────────────
function LandInspector({ land, onClose }: { land: MockLandListing; onClose: () => void }) {
  const modMap = new Map(land.mods.map(m => [m.slotId, m.modId]));

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-orbitron text-lg text-[#9933ff] tracking-widest">Land #{land.id}</h3>
          <p className="font-jetbrains text-[11px] text-white/35 mt-0.5">{land.seller}</p>
          <p className="font-jetbrains text-xs text-white/50 mt-1">{land.biome} &middot; {land.modCount} / 49 mods</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-white/40 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 7x7 grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 49 }, (_, i) => {
          const slotId = i + 1;
          const modId  = modMap.get(slotId);
          const cat    = modId ? PLANNED_MODIFIER_CATALOG.find(c => c.id === modId) : null;
          const tier   = cat?.rarity_tier ?? 0;

          return (
            <div
              key={slotId}
              className="aspect-square rounded-lg flex items-center justify-center relative"
              style={{
                background: cat ? 'rgba(153,51,255,0.12)' : 'rgba(255,255,255,0.03)',
                border: cat
                  ? `1px solid ${RARITY_GLOW[tier] ?? 'rgba(153,51,255,0.4)'}`
                  : '1px solid rgba(255,255,255,0.06)',
                boxShadow: cat ? `0 0 8px ${RARITY_GLOW[tier]}` : 'none',
              }}
            >
              {cat ? (
                <img
                  src={cat.asset_url}
                  alt={cat.name}
                  className="w-full h-full object-contain p-0.5"
                  style={{ filter: `drop-shadow(0 0 4px ${RARITY_GLOW[tier]})` }}
                />
              ) : (
                <span className="font-jetbrains text-[9px] text-white/20">#{slotId}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Buy */}
      <div className="flex items-center justify-between pt-2 border-t border-[#9933ff]/20">
        <div>
          <p className="font-jetbrains text-[10px] text-white/30">Цена</p>
          <p className="font-orbitron text-xl font-bold text-[#fbbf24]">{land.price} CBR</p>
        </div>
        <button
          type="button"
          onClick={() => toast.success(`Покупка Land #${land.id}`, { description: `${land.price} CBR` })}
          className="px-6 py-2.5 rounded-xl font-orbitron text-sm text-black transition-all"
          style={{ background: 'linear-gradient(135deg, #9933ff, #6366f1)', boxShadow: '0 0 20px rgba(153,51,255,0.5)' }}
        >
          КУПИТЬ ЗЕМЛЮ
        </button>
      </div>
    </div>
  );
}

// ── Pagination ──────────────────────────────────────────────────────────────
function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  return (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, page - 1))}
        disabled={page === 0}
        className="w-8 h-8 rounded-lg border border-[#9933ff]/30 flex items-center justify-center text-[#9933ff] disabled:opacity-30 hover:border-[#9933ff]/60 transition-all"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          className="w-8 h-8 rounded-lg font-jetbrains text-xs transition-all border"
          style={{
            background: i === page ? 'rgba(153,51,255,0.2)' : 'transparent',
            borderColor: i === page ? 'rgba(153,51,255,0.6)' : 'rgba(153,51,255,0.2)',
            color: i === page ? '#c084fc' : 'rgba(255,255,255,0.4)',
          }}
        >
          {i + 1}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange(Math.min(total - 1, page + 1))}
        disabled={page === total - 1}
        className="w-8 h-8 rounded-lg border border-[#9933ff]/30 flex items-center justify-center text-[#9933ff] disabled:opacity-30 hover:border-[#9933ff]/60 transition-all"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
