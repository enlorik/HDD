import { useState, useEffect } from 'react';
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

  const weekRowHeight = 64;
  const labelColWidth = 100;
  const laneColWidth = 140;
  const todayRow = 4; // visible weeks start at currentWeek-3, so "now" is the 4th row

  // Only events whose [startWeek, startWeek+duration) interval actually
  // overlaps the displayed window belong on the grid at all - without this,
  // a contest starting 7+ weeks out would get force-placed into a row
  // beyond the 10 explicit grid rows, silently misaligning everything
  // after it (caught in code review, not by eye, on the old column-based
  // version of this same bug - same guard applies here, just transposed).
  const windowStart = 1 - todayRow;
  const windowEnd = weeksToShow - todayRow + 1;
  const windowEvents = visibleEvents.filter(
    e => e.startWeek < windowEnd && e.startWeek + e.duration > windowStart
  );

  // Weeks are now the (unbounded, naturally-scrollable) vertical axis and
  // lanes are the (bounded - almost always 1-2, rarely 3+) horizontal axis.
  // A multi-week event becomes grid-row: start/span duration - the exact
  // same mechanic the old column-based version used for grid-column, just
  // transposed, so multi-week "practice contest" events need no special
  // case at all.
  const { packed: packedEvents, laneCount } = packIntoLanes(windowEvents);

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

      {/* Gantt-style events calendar: weeks as grid rows (the unbounded axis,
          scrolls vertically like the rest of the page), lanes as grid columns
          (the bounded axis - usually 1-2, rarely 3+ simultaneous events) */}
      <div className="timeline-content">
        <div className="ec-wrap">
          {/* Horizontal scroll is a safety net for a rare lane-count spike,
              not the primary interaction - most of the time laneCount is
              1-2 and this container never needs to scroll at all. */}
          <div className="ec-scroll">
            <div
              className="ec-scroll-inner"
              style={{ minWidth: `${labelColWidth + Math.max(laneCount, 1) * laneColWidth}px` }}
            >
              <div
                className="ec-grid"
                style={{
                  gridTemplateColumns: `${labelColWidth}px repeat(${Math.max(laneCount, 1)}, minmax(${laneColWidth}px, 1fr))`,
                  gridTemplateRows: `repeat(${weeksToShow}, ${weekRowHeight}px)`
                }}
              >
                {/* Highlight the current week's full row before anything else renders on top */}
                <div
                  className="today-row-highlight"
                  style={{ gridRow: todayRow, gridColumn: `1 / -1` }}
                />

                {weeks.map((week, index) => (
                  <div
                    key={week}
                    className={`week-row-label ${index + 1 === todayRow ? 'week-row-label--today' : ''}`}
                    style={{ gridRow: index + 1, gridColumn: 1 }}
                  >
                    <div className="week-label">Week {week}</div>
                    <div className="week-date">{getWeekLabel(index - 3)}</div>
                    {index + 1 === todayRow && <div className="today-badge">Today</div>}
                  </div>
                ))}

                {packedEvents.map(event => {
                  const rawStart = event.startWeek + todayRow;
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
                        gridColumn: event.lane + 2,
                        gridRow: `${start} / span ${span}`,
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
