'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronDown, ChevronRight, Search, Calendar as CalendarIcon, Info, CheckSquare, Square, Download, Copy, ExternalLink, AlertTriangle } from 'lucide-react';
import { Series } from '@/lib/api';
import { compressIds } from '@/lib/utils';

type UrlMode = 'subscription' | 'encoded';

const SUBSCRIPTION_ID_PATTERN = /^[a-zA-Z0-9_-]{3,80}$/;
const ID_ADJECTIVES = ['cedar', 'rain', 'trout', 'fraser', 'seawall', 'maple', 'harbour', 'raven'];
const ID_NOUNS = ['swim', 'yoga', 'dance', 'skate', 'fitness', 'pilates', 'tennis', 'soccer'];

function selectedIdsKey(ids: Set<number>) {
  return Array.from(ids).sort((a, b) => a - b).join(',');
}

function generateReadableId() {
  const randomValues = new Uint32Array(3);
  crypto.getRandomValues(randomValues);

  const adjective = ID_ADJECTIVES[randomValues[0] % ID_ADJECTIVES.length];
  const noun = ID_NOUNS[randomValues[1] % ID_NOUNS.length];
  const number = String(randomValues[2] % 10000).padStart(4, '0');
  const suffix = randomValues[1].toString(36).slice(-4);

  return `${adjective}-${noun}-${number}-${suffix}`;
}

export default function CalendarApp() {
  const [events, setEvents] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const [expandedSeries, setExpandedSeries] = useState<Set<number>>(new Set());

  const [subscriptionId, setSubscriptionId] = useState('');
  const [savedSubscriptionId, setSavedSubscriptionId] = useState<string | null>(null);
  const [savedIdsKey, setSavedIdsKey] = useState('');
  const [subscriptionStatus, setSubscriptionStatus] = useState('Enter a subscription ID to load or create one.');
  const [subscriptionBusy, setSubscriptionBusy] = useState(false);
  const [urlMode, setUrlMode] = useState<UrlMode>('encoded');
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('selectedLocations');
      if (stored) {
        setSelectedLocations(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load selected locations', e);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('selectedLocations', JSON.stringify(selectedLocations));
  }, [selectedLocations]);

  useEffect(() => {
    const storedSubscriptionId = localStorage.getItem('subscriptionId');
    if (!storedSubscriptionId) return;

    setSubscriptionId(storedSubscriptionId);

    const loadStoredSubscription = async () => {
      try {
        const res = await fetch(`/api/subscriptions/${encodeURIComponent(storedSubscriptionId)}`);

        if (res.status === 404) {
          setSavedSubscriptionId(null);
          setSavedIdsKey('');
          setUrlMode('encoded');
          setSubscriptionStatus('Saved subscription was not found. Save to create it again.');
          return;
        }

        if (!res.ok) throw new Error('Failed to load subscription');

        const data: { ids: number[] } = await res.json();
        const loadedIds = new Set(data.ids);
        setSelectedIds(loadedIds);
        setSavedSubscriptionId(storedSubscriptionId);
        setSavedIdsKey(selectedIdsKey(loadedIds));
        setUrlMode('subscription');
        setSubscriptionStatus('Loaded saved subscription.');
      } catch (e) {
        console.error('Failed to load saved subscription', e);
        setSubscriptionStatus('Could not load saved subscription.');
      }
    };

    loadStoredSubscription();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsLocationDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let retries = 3;
    const fetchEventsWithRetry = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/events');
        if (!res.ok) throw new Error('Network response was not ok');
        const data: Series[] = await res.json();
        setEvents(data);
        
        if (data.length > 0) {
          setExpandedLocations(new Set([data[0].location]));
        }
        setLoading(false);
      } catch {
        if (retries > 0) {
          retries--;
          setTimeout(fetchEventsWithRetry, 1000);
        } else {
          setError('Failed to load events. Please try again later.');
          setLoading(false);
        }
      }
    };

    fetchEventsWithRetry();
  }, []);

  const locations = useMemo(() => {
    const locs = new Set(events.map(e => e.location));
    return Array.from(locs).sort();
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter(series => {
      const matchLocation = selectedLocations.length === 0 || selectedLocations.includes(series.location);
      const matchSearch = series.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          series.location.toLowerCase().includes(searchQuery.toLowerCase());
      return matchLocation && matchSearch;
    });
  }, [events, selectedLocations, searchQuery]);

  const groupedEvents = useMemo(() => {
    const groups = new Map<string, Series[]>();
    for (const series of filteredEvents) {
      if (!groups.has(series.location)) groups.set(series.location, []);
      groups.get(series.location)!.push(series);
    }
    return groups;
  }, [filteredEvents]);

  const currentSelectedIdsKey = useMemo(() => selectedIdsKey(selectedIds), [selectedIds]);
  const trimmedSubscriptionId = subscriptionId.trim();
  const isValidSubscriptionId = SUBSCRIPTION_ID_PATTERN.test(trimmedSubscriptionId);
  const hasSavedSubscription = Boolean(savedSubscriptionId);
  const hasUnsavedChanges = Boolean(savedSubscriptionId) && savedIdsKey !== currentSelectedIdsKey;
  const selectedSeriesLabel = selectedIds.size === 1 ? 'series selected' : 'series selected';

  const toggleLocation = (location: string) => {
    const newExpanded = new Set(expandedLocations);
    if (newExpanded.has(location)) newExpanded.delete(location);
    else newExpanded.add(location);
    setExpandedLocations(newExpanded);
  };

  const toggleSeries = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedSeries);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedSeries(newExpanded);
  };

  const toggleSelection = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const loadSubscription = async (id = trimmedSubscriptionId) => {
    if (!SUBSCRIPTION_ID_PATTERN.test(id)) {
      setSubscriptionStatus('Use 3-80 letters, numbers, dashes, or underscores.');
      return false;
    }

    setSubscriptionBusy(true);
    try {
      const res = await fetch(`/api/subscriptions/${encodeURIComponent(id)}`);

      if (res.status === 404) {
        setSubscriptionId(id);
        setSavedSubscriptionId(null);
        setSavedIdsKey('');
        setUrlMode('encoded');
        localStorage.setItem('subscriptionId', id);
        setSubscriptionStatus('New subscription ID. Select events and save to create it.');
        return true;
      }

      if (!res.ok) throw new Error('Failed to load subscription');

      const data: { ids: number[] } = await res.json();
      const loadedIds = new Set(data.ids);
      setSubscriptionId(id);
      setSelectedIds(loadedIds);
      setSavedSubscriptionId(id);
      setSavedIdsKey(selectedIdsKey(loadedIds));
      setUrlMode('subscription');
      localStorage.setItem('subscriptionId', id);
      setSubscriptionStatus('Loaded saved subscription.');
      return true;
    } catch (e) {
      console.error('Failed to load subscription', e);
      setSubscriptionStatus('Failed to load subscription.');
      return false;
    } finally {
      setSubscriptionBusy(false);
    }
  };

  const saveSubscription = async () => {
    if (!isValidSubscriptionId) {
      setSubscriptionStatus('Use 3-80 letters, numbers, dashes, or underscores.');
      return;
    }

    setSubscriptionBusy(true);
    setSubscriptionStatus('Saving subscription...');
    try {
      const res = await fetch(`/api/subscriptions/${encodeURIComponent(trimmedSubscriptionId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      if (!res.ok) throw new Error('Failed to save subscription');

      setSavedSubscriptionId(trimmedSubscriptionId);
      setSavedIdsKey(currentSelectedIdsKey);
      setUrlMode('subscription');
      localStorage.setItem('subscriptionId', trimmedSubscriptionId);
      setSubscriptionStatus('Saved subscription.');
    } catch (e) {
      console.error('Failed to save subscription', e);
      setSubscriptionStatus('Failed to save subscription.');
    } finally {
      setSubscriptionBusy(false);
    }
  };

  const deleteCurrentSubscription = async () => {
    if (!savedSubscriptionId) return;

    setSubscriptionBusy(true);
    try {
      const res = await fetch(`/api/subscriptions/${encodeURIComponent(savedSubscriptionId)}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete subscription');

      setSavedSubscriptionId(null);
      setSavedIdsKey('');
      setUrlMode('encoded');
      localStorage.removeItem('subscriptionId');
      setSubscriptionStatus('Deleted subscription.');
    } catch (e) {
      console.error('Failed to delete subscription', e);
      setSubscriptionStatus('Failed to delete subscription.');
    } finally {
      setSubscriptionBusy(false);
    }
  };

  const generateSubscriptionId = async () => {
    setSubscriptionBusy(true);
    try {
      for (let i = 0; i < 5; i++) {
        const id = generateReadableId();
        const res = await fetch(`/api/subscriptions/${encodeURIComponent(id)}`);
        if (res.status === 404) {
          setSubscriptionId(id);
          setSavedSubscriptionId(null);
          setSavedIdsKey('');
          setUrlMode('encoded');
          setSubscriptionStatus('Generated a new subscription ID. Save to create it.');
          return;
        }
      }

      const fallbackId = generateReadableId();
      setSubscriptionId(fallbackId);
      setSavedSubscriptionId(null);
      setSavedIdsKey('');
      setUrlMode('encoded');
      setSubscriptionStatus('Generated a new subscription ID. Save to create it.');
    } catch (e) {
      console.error('Failed to check generated subscription ID', e);
      const fallbackId = generateReadableId();
      setSubscriptionId(fallbackId);
      setSavedSubscriptionId(null);
      setSavedIdsKey('');
      setUrlMode('encoded');
      setSubscriptionStatus('Generated a new subscription ID. Save to create it.');
    } finally {
      setSubscriptionBusy(false);
    }
  };

  const generateIcsUrl = () => {
    if (urlMode === 'subscription') {
      if (!savedSubscriptionId) return null;
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      return `${origin}/api/calendar?subscription=${encodeURIComponent(savedSubscriptionId)}`;
    }

    const compressed = compressIds(Array.from(selectedIds));
    if (!compressed) return null;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/api/calendar?ids=${compressed}`;
  };

  const handleCopyLink = async () => {
    const url = generateIcsUrl();
    if (url) {
      await navigator.clipboard.writeText(url);
      setCopyStatus('Link copied');
      window.setTimeout(() => setCopyStatus(''), 1800);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-zinc-800 border-t-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 p-4 text-center">
        <AlertTriangle className="h-14 w-14 text-red-500 mb-4" />
        <h2 className="text-xl font-medium text-zinc-100 mb-2">Oops! Something went wrong</h2>
        <p className="text-zinc-400 mb-6">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-6 py-2 bg-blue-600 text-white font-medium rounded-full hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  const icsUrl = generateIcsUrl();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans pb-12">
      {/* Top App Bar area */}
      <header className="bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.22),transparent_34%),linear-gradient(180deg,#18181b_0%,#09090b_100%)] border-b border-zinc-800 pt-8 pb-7 px-4 md:px-8 mb-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-semibold text-zinc-100 mb-2 tracking-tight">
            Vancouver Community Centre Calendar
          </h1>
          <p className="text-zinc-400 text-base md:text-lg max-w-3xl">
            Select the event series you want to subscribe to and generate a custom Google Calendar link.
          </p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-8">
        {/* Subscription Controls */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-4 md:p-5 mb-6 shadow-2xl shadow-black/20">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-medium text-zinc-100 tracking-tight">Subscription</h2>
              <p className="text-sm text-zinc-400 mt-1">Use a saved ID for a stable calendar URL, or copy an encoded one-off link.</p>
            </div>
            {hasSavedSubscription && (
              <div className="hidden sm:block rounded-full border border-blue-800/60 bg-blue-950/40 px-3 py-1 text-xs font-medium text-blue-300">
                Active
              </div>
            )}
          </div>
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="flex-1">
              <label htmlFor="subscription-id" className="block text-sm font-medium text-zinc-300 mb-2">
                Subscription ID
              </label>
              <input
                id="subscription-id"
                type="text"
                value={subscriptionId}
                onChange={(e) => setSubscriptionId(e.target.value)}
                placeholder="Choose or generate a secret subscription ID"
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-2xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-zinc-100 placeholder-zinc-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-row">
              <button
                onClick={() => loadSubscription()}
                disabled={subscriptionBusy || !trimmedSubscriptionId}
                className="px-5 py-3 bg-zinc-800 text-zinc-100 font-medium rounded-2xl hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Load/Create
              </button>
              <button
                onClick={generateSubscriptionId}
                disabled={subscriptionBusy}
                className="px-5 py-3 bg-zinc-800 text-zinc-100 font-medium rounded-2xl hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Generate ID
              </button>
              <button
                onClick={saveSubscription}
                disabled={subscriptionBusy || !isValidSubscriptionId}
                className="px-5 py-3 bg-blue-600 text-white font-medium rounded-2xl hover:bg-blue-700 disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed transition-colors"
              >
                Save Subscription
              </button>
              {hasSavedSubscription && (
                <button
                  onClick={deleteCurrentSubscription}
                  disabled={subscriptionBusy}
                  className="px-5 py-3 bg-red-950/60 border border-red-900 text-red-300 font-medium rounded-2xl hover:bg-red-950 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
          <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${hasUnsavedChanges ? 'border-amber-800/60 bg-amber-950/30 text-amber-200' : 'border-zinc-800 bg-zinc-950/60 text-zinc-400'}`}>
            {hasUnsavedChanges ? 'Unsaved changes. Click Save Subscription to update the calendar link.' : subscriptionStatus}
          </div>
        </div>

        {/* Sticky Action Bar */}
        <div className="sticky top-0 z-20 bg-zinc-950/95 backdrop-blur-sm pb-4 mb-6 pt-2 -mx-4 px-4 md:mx-0 md:px-0">
          <div className="grid gap-4 bg-zinc-900/95 border border-zinc-800 rounded-3xl p-4 shadow-2xl shadow-black/20 md:grid-cols-[1fr_auto] md:items-center">
            <div className="flex items-center justify-between gap-4 md:justify-start">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-950/60 text-xl font-semibold text-blue-200 ring-1 ring-blue-800/50">
                  {selectedIds.size}
                </div>
                <div>
                  <div className="text-sm font-medium text-zinc-100">{selectedSeriesLabel}</div>
                  <div className="text-xs text-zinc-500">
                    {urlMode === 'subscription' ? 'Using saved subscription link' : 'Using encoded selected IDs'}
                  </div>
                </div>
              </div>
              {selectedIds.size > 0 && (
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors px-3 py-2 rounded-xl hover:bg-zinc-800"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(180px,auto)_1fr_1fr] md:w-auto">
                <label className="sr-only" htmlFor="url-mode">Calendar URL format</label>
                <select
                  id="url-mode"
                  value={urlMode}
                  onChange={(e) => setUrlMode(e.target.value as UrlMode)}
                  className="w-full px-4 py-3 bg-zinc-950 border border-zinc-700 text-zinc-100 rounded-2xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="subscription">Subscription URL</option>
                  <option value="encoded">Encoded Event IDs</option>
                </select>
                <button
                  onClick={handleCopyLink}
                  disabled={!icsUrl}
                  className="flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 text-white font-medium rounded-2xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed transition-colors"
                >
                  <Copy size={18} />
                  {copyStatus || 'Copy Link'}
                </button>
                <a
                  href={icsUrl || '#'}
                  download
                  className={`flex items-center justify-center gap-2 px-5 py-3 bg-zinc-950 border border-zinc-700 text-blue-300 font-medium rounded-2xl hover:bg-zinc-800 hover:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${!icsUrl ? 'opacity-50 border-zinc-800 text-zinc-600 cursor-not-allowed pointer-events-none' : ''}`}
                >
                  <Download size={18} />
                  Download
                </a>
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div className="mt-3 px-4 py-3 bg-blue-900/30 text-blue-400 rounded-xl flex items-start gap-3 text-sm border border-blue-800/50">
              <Info className="shrink-0 mt-0.5" size={18} />
              <p>
                <strong className="font-medium">Disclaimer:</strong> Google Calendar subscriptions are notoriously slow to sync. Updates to subscribed series may take 12-24 hours to reflect. If you need immediate updates, use the Download option instead.
              </p>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
            <input
              type="text"
              placeholder="Search events or locations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-full focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-zinc-100 placeholder-zinc-500 transition-shadow"
            />
          </div>
          <div className="w-full md:w-72 relative" ref={dropdownRef}>
            <button
              onClick={() => setIsLocationDropdownOpen(!isLocationDropdownOpen)}
              className="w-full pl-5 pr-10 py-3 bg-zinc-900 border border-zinc-800 rounded-full focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-left text-zinc-100 transition-shadow cursor-pointer truncate"
            >
              {selectedLocations.length === 0 
                ? 'All Locations' 
                : selectedLocations.length === 1 
                  ? selectedLocations[0] 
                  : `${selectedLocations.length} Locations Selected`}
            </button>
            <ChevronDown className={`absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none transition-transform ${isLocationDropdownOpen ? 'rotate-180' : ''}`} size={20} />
            
            {isLocationDropdownOpen && (
              <div className="absolute top-full mt-2 w-full bg-zinc-900 border border-zinc-800 rounded-2xl shadow-lg z-30 max-h-80 overflow-y-auto py-2 custom-scrollbar">
                <button
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800 transition-colors text-left"
                  onClick={() => setSelectedLocations([])}
                >
                  <div className={`shrink-0 ${selectedLocations.length === 0 ? 'text-blue-400' : 'text-zinc-500'}`}>
                    {selectedLocations.length === 0 ? <CheckSquare size={20} /> : <Square size={20} />}
                  </div>
                  <span className={`font-medium ${selectedLocations.length === 0 ? 'text-blue-400' : 'text-zinc-100'}`}>All Locations</span>
                </button>
                <div className="h-px bg-zinc-800 my-1"></div>
                {locations.map(loc => {
                  const isSelected = selectedLocations.includes(loc);
                  return (
                    <button
                      key={loc}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800 transition-colors text-left"
                      onClick={() => {
                        setSelectedLocations(prev => 
                          prev.includes(loc) 
                            ? prev.filter(l => l !== loc)
                            : [...prev, loc]
                        );
                      }}
                    >
                      <div className={`shrink-0 ${isSelected ? 'text-blue-400' : 'text-zinc-500'}`}>
                        {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                      </div>
                      <span className={`truncate ${isSelected ? 'text-blue-400 font-medium' : 'text-zinc-100'}`}>{loc}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Accordions */}
        <div className="space-y-4">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-16 text-zinc-400 bg-zinc-900 rounded-2xl border border-zinc-800">
              <CalendarIcon className="mx-auto h-12 w-12 text-zinc-700 mb-4" />
              <p className="text-lg font-medium text-zinc-100">No events found</p>
              <p>Try adjusting your search or location filter.</p>
            </div>
          ) : (
            Array.from(groupedEvents.entries()).map(([location, locationSeries]) => (
              <div key={location} className="border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-900 transition-shadow hover:shadow-sm">
                <button
                  onClick={() => toggleLocation(location)}
                  className="w-full flex items-center justify-between p-5 bg-zinc-900 hover:bg-zinc-800 transition-colors focus:outline-none"
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-zinc-800 text-zinc-400 p-2.5 rounded-full">
                      <CalendarIcon size={20} />
                    </div>
                    <div className="text-left">
                      <h2 className="text-lg font-medium text-zinc-100 tracking-tight">{location}</h2>
                      <p className="text-sm text-zinc-400 mt-0.5">{locationSeries.length} activities</p>
                    </div>
                  </div>
                  {expandedLocations.has(location) ? <ChevronDown size={24} className="text-zinc-400"/> : <ChevronRight size={24} className="text-zinc-400"/>}
                </button>
                
                {expandedLocations.has(location) && (
                  <div className="border-t border-zinc-800">
                    {locationSeries.map((series, index) => {
                      const isSelected = selectedIds.has(series.event_item_id);
                      const isExpanded = expandedSeries.has(series.event_item_id);
                      const isLast = index === locationSeries.length - 1;
                      
                      return (
                        <div key={series.event_item_id} className={`p-5 transition-colors ${!isLast ? 'border-b border-zinc-800' : ''} ${isSelected ? 'bg-blue-900/20' : 'hover:bg-zinc-800'}`}>
                          <div className="flex items-start gap-4">
                            <button 
                              onClick={() => toggleSelection(series.event_item_id)}
                              className={`mt-1 shrink-0 focus:outline-none transition-transform active:scale-95 ${isSelected ? 'text-blue-400' : 'text-zinc-500 hover:text-zinc-100'}`}
                              aria-label={isSelected ? "Deselect series" : "Select series"}
                            >
                              {isSelected ? <CheckSquare size={24} className="fill-blue-900/30" /> : <Square size={24} />}
                            </button>
                            
                            <div className="flex-1 cursor-pointer" onClick={() => toggleSelection(series.event_item_id)}>
                              <h3 className={`text-base font-medium transition-colors ${isSelected ? 'text-blue-300' : 'text-zinc-100'}`}>{series.title}</h3>
                              {(() => {
                                const firstInstance = series.instances[0];
                                if (!firstInstance) return null;
                                const startDate = new Date(firstInstance.start_time.replace(' ', 'T'));
                                const endDate = firstInstance.end_time ? new Date(firstInstance.end_time.replace(' ', 'T')) : null;
                                const dayStr = startDate.toLocaleDateString(undefined, { weekday: 'long' });
                                const startTimeStr = startDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
                                const endTimeStr = endDate ? endDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
                                return (
                                  <p className="text-sm text-zinc-400 mt-1">
                                    {dayStr}s • {startTimeStr}{endTimeStr ? ` - ${endTimeStr}` : ''}
                                  </p>
                                );
                              })()}
                              <p className="text-xs text-zinc-500 mt-1">{series.instances.length} upcoming instances</p>
                            </div>
                            
                            <button 
                              onClick={(e) => toggleSeries(series.event_item_id, e)}
                              className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 rounded-full transition-colors focus:outline-none"
                              aria-label="Toggle details"
                            >
                              {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                            </button>
                          </div>
                          
                          {isExpanded && (
                            <div className="mt-4 pl-10 pr-4">
                              <div className="text-sm text-zinc-300 mb-4 p-4 bg-zinc-900 rounded-xl border border-zinc-800 leading-relaxed">
                                {series.instances[0]?.description || 'No description available.'}
                              </div>
                              
                              <h4 className="text-sm font-medium text-zinc-100 mb-3">Schedule</h4>
                              <ul className="space-y-3 mb-4 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                {series.instances.map((inst, idx) => {
                                  const startDate = new Date(inst.start_time.replace(' ', 'T'));
                                  const endDate = inst.end_time ? new Date(inst.end_time.replace(' ', 'T')) : null;
                                  
                                  return (
                                    <li key={idx} className="text-sm flex items-center gap-3">
                                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                      <span className="font-medium text-zinc-100 w-24">{startDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                                      <span className="text-zinc-400">
                                        {startDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} 
                                        {endDate ? ` - ${endDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : ''}
                                      </span>
                                    </li>
                                  );
                                })}
                              </ul>
                              
                              {series.instances[0]?.activity_detail_url && (
                                <a 
                                  href={series.instances[0].activity_detail_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-400 hover:text-blue-300 hover:underline mt-2 p-2 -ml-2 rounded-md hover:bg-blue-900/40 transition-colors"
                                >
                                  View on Community Centre Website <ExternalLink size={16} />
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
