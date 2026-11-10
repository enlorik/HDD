import { useState, useEffect, useRef } from 'react';
import './Timeline.css';
import { fetchCodeforcesContests, formatContestsForTimeline } from '../services/codeforcesService';

// localStorage key for persisting timeline event opt-in state
const STORAGE_KEY = 'timeline-event-enabled';

// Greedy interval-packing: assigns each event the lowest-numbered lane whose
// last-placed event has already ended, so overlapping events stack into new
// lanes instead of colliding, and non-overlapping events share a lane.
function packIntoLanes(events) {
  const sorted = [...events].sort((a, b) => a.startWeek - b.startWeek);
  const laneEnds = [];
  const packed = sorted.map(event => {
    const end = event.startWeek + event.duration;
    let lane = laneEnds.findIndex(laneEnd => laneEnd <= event.startWeek);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    return { ...event, lane };
  });
  return { packed, laneCount: laneEnds.length };
}

function Timeline() {
  const [currentDate] = useState(new Date());
  const [showEventManager, setShowEventManager] = useState(false);
  const [codeforcesContests, setCodeforcesContests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const ecScrollRef = useRef(null);
  // Map of eventId → boolean (true = shown on calendar, false = hidden)
  const [enabledEvents, setEnabledEvents] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  });

  // Fetch Codeforces contests on component mount
  useEffect(() => {
    async function loadContests() {
      try {
        setLoading(true);
        const contests = await fetchCodeforcesContests();
        const formattedEvents = formatContestsForTimeline(contests, currentDate);
        setCodeforcesContests(formattedEvents);
        // Ensure every newly fetched event has an explicit true/false entry so
        // the default-enabled assumption doesn't silently add new clutter.
        setEnabledEvents(prev => {
          const next = { ...prev };
          let changed = false;
          formattedEvents.forEach(e => {
            if (!(e.id in next)) { next[e.id] = true; changed = true; }
          });
          return changed ? next : prev;
        });
        setError(null);
      } catch (err) {
        console.error('Failed to load Codeforces contests:', err);
        setError('Failed to load Codeforces contests. Please try again later.');
      } finally {
        setLoading(false);
      }
    }
    
    loadContests();
  }, [currentDate]);

  // Persist enabledEvents to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(enabledEvents));
    } catch {
      // localStorage may be unavailable in some environments
    }
  }, [enabledEvents]);

  // Default to enabled unless explicitly set to false
  const isEventEnabled = (map, id) => map[id] !== false;

  // Toggle whether an event appears on the calendar
  const toggleEvent = (id) => {
    setEnabledEvents(prev => ({ ...prev, [id]: !isEventEnabled(prev, id) }));
  };

  // Only opted-in events are rendered on the calendar view
  const visibleEvents = codeforcesContests.filter(e => isEventEnabled(enabledEvents, e.id));

  // Calculate week information
  const getWeekNumber = (date) => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  };

  const currentWeek = getWeekNumber(currentDate);
  const weeksToShow = 10;
  const startWeek = currentWeek - 3;

  const weeks = Array.from({ length: weeksToShow }, (_, i) => startWeek + i);

  const getWeekLabel = (weekOffset) => {
    const date = new Date(currentDate);
    date.setDate(date.getDate() + weekOffset * 7);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    const day = date.getDate();
    return `${month} ${day}`;
  };

  // Extract the first hex color from a gradient string to use as accent
  const getAccentColor = (event) => {
    const match = event.gradient && event.gradient.match(/#[0-9a-fA-F]{6}/);
    return match ? match[0] : '#4a9eff';
  };

  const rowHeight = 56;
  const labelColWidth = 70;
  const todayColumn = 4; // visible weeks start at currentWeek-3, so "now" is the 4th column
  // Time-row labels sit in their own absolutely-positioned column to the
  // left of .ec-grid (reserved via margin-left in CSS), separate from the
  // week-columns grid itself.

  // Only events whose [startWeek, startWeek+duration) interval actually
  // overlaps the displayed window belong on the grid at all - without this,
  // a contest starting 7+ weeks out would get force-placed into a column
  // beyond the 10 explicit grid columns, silently misaligning everything
  // after it (caught in code review, not by eye).
  const windowStart = 1 - todayColumn;
  const windowEnd = weeksToShow - todayColumn + 1;
  const windowEvents = visibleEvents.filter(
    e => e.startWeek < windowEnd && e.startWeek + e.duration > windowStart
  );

  // Multi-week ("practice marathon") events get their own lane-packed rows
  // (no clock - a row can hold several non-overlapping events). Single-week
  // timed contests work differently: each row IS a specific start time, so
  // events are grouped by their formatted time rather than lane-packed -
  // the row's label is that time, not a prefix glued onto each bubble.
  const multiWeekEvents = windowEvents.filter(e => e.duration >= 2);
  const timedEvents = windowEvents.filter(e => e.duration === 1);
  const { packed: multiPacked, laneCount: multiLaneCount } = packIntoLanes(multiWeekEvents);

  const formatEventTime = (startDate) =>
    startDate
      ? new Date(startDate).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : 'TBA';

  const timeRows = (() => {
    const groups = new Map();
    timedEvents.forEach(event => {
      const label = formatEventTime(event.startDate);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(event);
    });
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, events]) => ({ label, events }));
  })();

  // On a narrow viewport the grid is wider than the visible scroll container
  // and starts scrolled to week 1 by default - today and every upcoming
  // contest sit off-screen to the right until the user manually scrolls
  // (caught in code review: with all-upcoming data this makes the calendar
  // look empty on first open). Scroll to put one week of past context, then
  // today, at the left edge instead.
  useEffect(() => {
    if (loading || !ecScrollRef.current) return;
    const el = ecScrollRef.current;
    const columnWidth = (el.scrollWidth - labelColWidth) / weeksToShow;
    el.scrollLeft = Math.max(0, labelColWidth + (todayColumn - 2) * columnWidth);
  }, [loading, todayColumn, weeksToShow, labelColWidth]);

  return (
    <div className="timeline-container">
      {/* Header: title + toggle for the event opt-in drawer */}
      <div className="ec-header">
        <h2 className="ec-title">Events Calendar</h2>
        <button
          className="ec-manage-btn"
          onClick={() => setShowEventManager(v => !v)}
          aria-expanded={showEventManager}
        >
          {showEventManager ? 'Close' : 'Manage events'}
        </button>
      </div>

      {/* Loading and Error States */}
      {loading && (
        <div className="timeline-status">
          <p>Loading Codeforces contests...</p>
        </div>
      )}
      
      {error && (
        <div className="timeline-status error">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && codeforcesContests.length === 0 && (
        <div className="timeline-status">
          <p>No active Codeforces contests found.</p>
        </div>
      )}

      {/* Gantt-style events calendar: weeks as grid columns, multi-week and
          timed events packed into two independent sets of lanes (grid rows)
          so neither group collides with or crowds out the other */}
      <div className="timeline-content">
        <div className="ec-wrap">
          {/* Both rows scroll together horizontally below ~900px - a weeks-wide
              Gantt can't meaningfully compress onto a phone screen, so it scrolls
              like any calendar/schedule app does on mobile instead of squashing
              text illegibly or overflowing the page. */}
          <div className="ec-scroll" ref={ecScrollRef}>
            <div
              className="ec-scroll-inner"
              style={{ minWidth: `${labelColWidth + weeksToShow * 110}px` }}
            >
              <div className="ec-row">
                <div className="ec-label-col" style={{ gridTemplateRows: `${rowHeight}px` }} />
                <div className="ec-week-headers" style={{ gridTemplateColumns: `repeat(${weeksToShow}, 1fr)` }}>
                  {weeks.map((week, index) => (
                    <div key={week} className="week-header">
                      <div className="week-label">Week {week}</div>
                      <div className="week-date">{getWeekLabel(index - 3)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {multiPacked.length > 0 && (
                <div className="ec-row">
                  <div
                    className="ec-label-col"
                    style={{ gridTemplateRows: `repeat(${Math.max(multiLaneCount, 1)}, ${rowHeight}px)` }}
                  />
                  <div
                    className="ec-grid"
                    style={{
                      gridTemplateColumns: `repeat(${weeksToShow}, 1fr)`,
                      gridTemplateRows: `repeat(${Math.max(multiLaneCount, 1)}, ${rowHeight}px)`
                    }}
                  >
                    <div className="today-line" style={{ left: `${((todayColumn - 1) / weeksToShow) * 100}%` }}>
                      <div className="today-label">Today</div>
                    </div>

                    {multiPacked.map(event => {
                      const rawStart = event.startWeek + todayColumn;
                      const start = Math.max(1, rawStart);
                      const end = Math.min(weeksToShow + 1, rawStart + event.duration);
                      const span = Math.max(1, end - start);

                      let tooltipText = event.title;
                      if (event.type === 'codeforces') {
                        tooltipText += ` (${event.contestType})`;
                        tooltipText += ` · Phase: ${event.phase}`;
                      }

                      return (
                        <div
                          key={event.id}
                          className="ec-bar"
                          style={{
                            gridColumn: `${start} / span ${span}`,
                            gridRow: event.lane + 1,
                            background: event.gradient
                          }}
                          onClick={() => event.detailLink && window.open(event.detailLink, '_blank', 'noopener,noreferrer')}
                          title={tooltipText}
                        >
                          <span className="event-title">{event.title}</span>
                          <div className="ec-tooltip">{tooltipText}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {timeRows.length > 0 && (
                <div className={`ec-row ${multiPacked.length > 0 ? 'ec-row--divider' : ''}`}>
                  <div
                    className="ec-label-col"
                    style={{ gridTemplateRows: `repeat(${timeRows.length}, ${rowHeight}px)` }}
                  >
                    {timeRows.map(row => (
                      <div key={row.label} className="time-row-label">{row.label}</div>
                    ))}
                  </div>
                  <div
                    className="ec-grid ec-grid--timed"
                    style={{
                      gridTemplateColumns: `repeat(${weeksToShow}, 1fr)`,
                      gridTemplateRows: `repeat(${timeRows.length}, ${rowHeight}px)`
                    }}
                  >
                    {multiPacked.length === 0 && (
                      <div className="today-line" style={{ left: `${((todayColumn - 1) / weeksToShow) * 100}%` }}>
                        <div className="today-label">Today</div>
                      </div>
                    )}

                    {timeRows.map((row, rowIndex) =>
                      row.events.map(event => {
                        const rawStart = event.startWeek + todayColumn;
                        const start = Math.max(1, rawStart);
                        const end = Math.min(weeksToShow + 1, rawStart + event.duration);
                        const span = Math.max(1, end - start);

                        let tooltipText = event.title;
                        if (event.type === 'codeforces') {
                          tooltipText += ` (${event.contestType})`;
                          tooltipText += ` · Phase: ${event.phase}`;
                        }

                        return (
                          <div
                            key={event.id}
                            className="ec-bar"
                            style={{
                              gridColumn: `${start} / span ${span}`,
                              gridRow: rowIndex + 1,
                              background: event.gradient
                            }}
                            onClick={() => event.detailLink && window.open(event.detailLink, '_blank', 'noopener,noreferrer')}
                            title={tooltipText}
                          >
                            <span className="event-title">{event.title}</span>
                            <div className="ec-tooltip">{tooltipText}</div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Slide-over drawer: opt-in/opt-out checklist, was formerly its own "Timeline" tab */}
      {showEventManager && (
        <>
          <div className="ec-drawer-overlay" onClick={() => setShowEventManager(false)} />
          <div className="ec-drawer">
            <div className="ec-drawer-header">
              <h3>Manage events</h3>
              <button className="ec-drawer-close" onClick={() => setShowEventManager(false)} aria-label="Close">✕</button>
            </div>
            <div className="tl-event-list">
              {codeforcesContests.length === 0 && !loading && (
                <p className="tl-empty">No events to display.</p>
              )}
              {codeforcesContests.map((event) => {
                const enabled = isEventEnabled(enabledEvents, event.id);
                const accent = getAccentColor(event);
                return (
                  <div
                    key={event.id}
                    className={`tl-bubble ${enabled ? 'tl-bubble--enabled' : 'tl-bubble--disabled'}`}
                    style={{ '--accent': accent }}
                    onClick={() => toggleEvent(event.id)}
                    title={enabled ? 'Click to remove from calendar' : 'Click to add to calendar'}
                  >
                    <input
                      type="checkbox"
                      className="tl-checkbox"
                      checked={enabled}
                      onChange={() => toggleEvent(event.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Toggle "${event.title}" on calendar`}
                    />
                    <div className="tl-bubble-body">
                      <span className="tl-bubble-title">{event.title}</span>
                      <span className="tl-bubble-meta">
                        {event.contestType} &middot; {event.phase} &middot;{' '}
                        {event.startDate
                          ? new Date(event.startDate).toLocaleDateString()
                          : 'TBA'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Timeline;
