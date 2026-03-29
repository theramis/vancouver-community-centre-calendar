'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronDown, ChevronRight, Search, Calendar as CalendarIcon, Info, CheckSquare, Square, Download, Copy, ExternalLink, AlertTriangle } from 'lucide-react';
import { Series } from '@/lib/api';
import { compressIds } from '@/lib/utils';

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
      } catch (err) {
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

  const generateIcsUrl = () => {
    const compressed = compressIds(Array.from(selectedIds));
    if (!compressed) return null;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/api/calendar?ids=${compressed}`;
  };

  const handleCopyLink = async () => {
    const url = generateIcsUrl();
    if (url) {
      await navigator.clipboard.writeText(url);
      alert('Subscription link copied to clipboard!');
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
      <header className="bg-zinc-900 border-b border-zinc-800 pt-8 pb-6 px-4 md:px-8 mb-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-normal text-zinc-100 mb-2 tracking-tight">
            Vancouver Community Centre Calendar
          </h1>
          <p className="text-zinc-400 text-base md:text-lg">
            Select the event series you want to subscribe to and generate a custom Google Calendar link.
          </p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-8">
        {/* Sticky Action Bar */}
        <div className="sticky top-0 z-20 bg-zinc-950/95 backdrop-blur-sm pb-4 mb-6 pt-2 -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="text-base font-medium text-blue-400 bg-blue-900/30 px-4 py-1.5 rounded-full">
                {selectedIds.size} {selectedIds.size === 1 ? 'Series' : 'Series'} Selected
              </div>
              {selectedIds.size > 0 && (
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors px-2 py-1 rounded-md hover:bg-zinc-800"
                >
                  Clear selection
                </button>
              )}
            </div>
            <div className="flex gap-3 w-full md:w-auto">
                <button
                  onClick={handleCopyLink}
                  disabled={selectedIds.size === 0}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-medium rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed transition-colors"
                >
                  <Copy size={18} />
                  Copy Subscribe Link
                </button>
                <a
                  href={icsUrl || '#'}
                  download
                  className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-zinc-900 border border-zinc-700 text-blue-400 font-medium rounded-full hover:bg-zinc-800 hover:border-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${selectedIds.size === 0 ? 'opacity-50 border-zinc-800 text-zinc-600 cursor-not-allowed pointer-events-none' : ''}`}
                >
                  <Download size={18} />
                  Download .ics
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
