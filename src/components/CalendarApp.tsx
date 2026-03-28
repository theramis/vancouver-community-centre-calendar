'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight, Search, Calendar as CalendarIcon, Info, CheckSquare, Square, Download, Copy, ExternalLink, AlertTriangle } from 'lucide-react';
import { Series } from '@/lib/api';
import { compressIds } from '@/lib/utils';

export default function CalendarApp() {
  const [events, setEvents] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('All');
  
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const [expandedSeries, setExpandedSeries] = useState<Set<number>>(new Set());

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
    return ['All', ...Array.from(locs).sort()];
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter(series => {
      const matchLocation = selectedLocation === 'All' || series.location === selectedLocation;
      const matchSearch = series.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          series.location.toLowerCase().includes(searchQuery.toLowerCase());
      return matchLocation && matchSearch;
    });
  }, [events, selectedLocation, searchQuery]);

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
      <div className="flex items-center justify-center min-h-screen bg-[#f8f9fa]">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#e0e0e0] border-t-[#1a73e8]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f8f9fa] p-4 text-center">
        <AlertTriangle className="h-14 w-14 text-red-500 mb-4" />
        <h2 className="text-xl font-medium text-[#202124] mb-2">Oops! Something went wrong</h2>
        <p className="text-[#5f6368] mb-6">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-6 py-2 bg-[#1a73e8] text-white font-medium rounded-full hover:bg-[#1557b0] transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  const icsUrl = generateIcsUrl();

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#202124] font-sans pb-12">
      {/* Top App Bar area */}
      <header className="bg-white border-b border-[#e0e0e0] pt-8 pb-6 px-4 md:px-8 mb-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-normal text-[#202124] mb-2 tracking-tight">
            Vancouver Community Centre Calendar
          </h1>
          <p className="text-[#5f6368] text-base md:text-lg">
            Select the event series you want to subscribe to and generate a custom Google Calendar link.
          </p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-8">
        {/* Sticky Action Bar */}
        <div className="sticky top-0 z-20 bg-[#f8f9fa]/95 backdrop-blur-sm pb-4 mb-6 pt-2 -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white border border-[#e0e0e0] rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="text-base font-medium text-[#1a73e8] bg-[#e8f0fe] px-4 py-1.5 rounded-full">
                {selectedIds.size} {selectedIds.size === 1 ? 'Series' : 'Series'} Selected
              </div>
              {selectedIds.size > 0 && (
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-sm font-medium text-[#5f6368] hover:text-[#202124] transition-colors px-2 py-1 rounded-md hover:bg-[#f1f3f4]"
                >
                  Clear selection
                </button>
              )}
            </div>
            <div className="flex gap-3 w-full md:w-auto">
                <button
                  onClick={handleCopyLink}
                  disabled={selectedIds.size === 0}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-[#1a73e8] text-white font-medium rounded-full hover:bg-[#1557b0] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1a73e8] disabled:opacity-50 disabled:bg-[#e0e0e0] disabled:text-[#9aa0a6] disabled:cursor-not-allowed transition-colors"
                >
                  <Copy size={18} />
                  Copy Subscribe Link
                </button>
                <a
                  href={icsUrl || '#'}
                  download
                  className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-white border border-[#dadce0] text-[#1a73e8] font-medium rounded-full hover:bg-[#f8f9fa] hover:border-[#d2e3fc] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1a73e8] transition-colors ${selectedIds.size === 0 ? 'opacity-50 border-[#e0e0e0] text-[#9aa0a6] cursor-not-allowed pointer-events-none' : ''}`}
                >
                  <Download size={18} />
                  Download .ics
                </a>
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div className="mt-3 px-4 py-3 bg-[#e8f0fe] text-[#1a73e8] rounded-xl flex items-start gap-3 text-sm border border-[#d2e3fc]">
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
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5f6368]" size={20} />
            <input
              type="text"
              placeholder="Search events or locations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-[#e0e0e0] rounded-full focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] text-[#202124] placeholder-[#5f6368] transition-shadow"
            />
          </div>
          <div className="w-full md:w-72 relative">
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full pl-5 pr-10 py-3 bg-white border border-[#e0e0e0] rounded-full focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] appearance-none text-[#202124] transition-shadow cursor-pointer"
            >
              {locations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-[#5f6368] pointer-events-none" size={20} />
          </div>
        </div>

        {/* Accordions */}
        <div className="space-y-4">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-16 text-[#5f6368] bg-white rounded-2xl border border-[#e0e0e0]">
              <CalendarIcon className="mx-auto h-12 w-12 text-[#dadce0] mb-4" />
              <p className="text-lg font-medium text-[#202124]">No events found</p>
              <p>Try adjusting your search or location filter.</p>
            </div>
          ) : (
            Array.from(groupedEvents.entries()).map(([location, locationSeries]) => (
              <div key={location} className="border border-[#e0e0e0] rounded-2xl overflow-hidden bg-white transition-shadow hover:shadow-sm">
                <button
                  onClick={() => toggleLocation(location)}
                  className="w-full flex items-center justify-between p-5 bg-white hover:bg-[#f8f9fa] transition-colors focus:outline-none"
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-[#f1f3f4] text-[#5f6368] p-2.5 rounded-full">
                      <CalendarIcon size={20} />
                    </div>
                    <div className="text-left">
                      <h2 className="text-lg font-medium text-[#202124] tracking-tight">{location}</h2>
                      <p className="text-sm text-[#5f6368] mt-0.5">{locationSeries.length} activities</p>
                    </div>
                  </div>
                  {expandedLocations.has(location) ? <ChevronDown size={24} className="text-[#5f6368]"/> : <ChevronRight size={24} className="text-[#5f6368]"/>}
                </button>
                
                {expandedLocations.has(location) && (
                  <div className="border-t border-[#e0e0e0]">
                    {locationSeries.map((series, index) => {
                      const isSelected = selectedIds.has(series.event_item_id);
                      const isExpanded = expandedSeries.has(series.event_item_id);
                      const isLast = index === locationSeries.length - 1;
                      
                      return (
                        <div key={series.event_item_id} className={`p-5 transition-colors ${!isLast ? 'border-b border-[#f1f3f4]' : ''} ${isSelected ? 'bg-[#f0f4f9]' : 'hover:bg-[#f8f9fa]'}`}>
                          <div className="flex items-start gap-4">
                            <button 
                              onClick={() => toggleSelection(series.event_item_id)}
                              className={`mt-1 shrink-0 focus:outline-none transition-transform active:scale-95 ${isSelected ? 'text-[#1a73e8]' : 'text-[#5f6368] hover:text-[#202124]'}`}
                              aria-label={isSelected ? "Deselect series" : "Select series"}
                            >
                              {isSelected ? <CheckSquare size={24} className="fill-[#e8f0fe]" /> : <Square size={24} />}
                            </button>
                            
                            <div className="flex-1 cursor-pointer" onClick={() => toggleSelection(series.event_item_id)}>
                              <h3 className={`text-base font-medium transition-colors ${isSelected ? 'text-[#174ea6]' : 'text-[#202124]'}`}>{series.title}</h3>
                              {(() => {
                                const firstInstance = series.instances[0];
                                if (!firstInstance) return null;
                                const startDate = new Date(firstInstance.start_time.replace(' ', 'T'));
                                const endDate = firstInstance.end_time ? new Date(firstInstance.end_time.replace(' ', 'T')) : null;
                                const dayStr = startDate.toLocaleDateString(undefined, { weekday: 'long' });
                                const startTimeStr = startDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
                                const endTimeStr = endDate ? endDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
                                return (
                                  <p className="text-sm text-[#5f6368] mt-1">
                                    {dayStr}s • {startTimeStr}{endTimeStr ? ` - ${endTimeStr}` : ''}
                                  </p>
                                );
                              })()}
                              <p className="text-xs text-[#5f6368] mt-1">{series.instances.length} upcoming instances</p>
                            </div>
                            
                            <button 
                              onClick={(e) => toggleSeries(series.event_item_id, e)}
                              className="p-2 text-[#5f6368] hover:text-[#202124] hover:bg-[#e8eaed] rounded-full transition-colors focus:outline-none"
                              aria-label="Toggle details"
                            >
                              {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                            </button>
                          </div>
                          
                          {isExpanded && (
                            <div className="mt-4 pl-10 pr-4">
                              <div className="text-sm text-[#3c4043] mb-4 p-4 bg-white rounded-xl border border-[#e0e0e0] leading-relaxed">
                                {series.instances[0]?.description || 'No description available.'}
                              </div>
                              
                              <h4 className="text-sm font-medium text-[#202124] mb-3">Schedule</h4>
                              <ul className="space-y-3 mb-4 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                {series.instances.map((inst, idx) => {
                                  const startDate = new Date(inst.start_time.replace(' ', 'T'));
                                  const endDate = inst.end_time ? new Date(inst.end_time.replace(' ', 'T')) : null;
                                  
                                  return (
                                    <li key={idx} className="text-sm flex items-center gap-3">
                                      <div className="w-1.5 h-1.5 rounded-full bg-[#1a73e8]"></div>
                                      <span className="font-medium text-[#202124] w-24">{startDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                                      <span className="text-[#5f6368]">
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
                                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1a73e8] hover:text-[#1557b0] hover:underline mt-2 p-2 -ml-2 rounded-md hover:bg-[#e8f0fe] transition-colors"
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
