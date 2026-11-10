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
  const headerRowHeight = 60;
  const dividerRowHeight = 20;
  const todayColumn = 4; // visible weeks start at currentWeek-3, so "now" is the 4th column

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
  // Two events CAN still share both a week and a time (e.g. simultaneous
  // Div.1/Div.2 rounds), so each time-group still needs its own lane pack
  // within itself - otherwise they'd land on identical grid coordinates
  // and silently hide one another (caught in code review).
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
    let rowCursor = 0;
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, events]) => {
        const { packed, laneCount } = packIntoLanes(events);
        const startOffset = rowCursor;
        rowCursor += laneCount;
        return { label, events: packed, startOffset, laneCount };
      });
  })();
  const totalTimedRows = timeRows.reduce((sum, row) => sum + row.laneCount, 0);

  // Everything lives in ONE shared grid now (header row, multi-week rows,
  // timed rows) instead of three separate grids. Separate grids each
  // auto-grow their 1fr columns independently based on their own content,
  // so the same week could end up a different pixel width in the header
  // grid vs the multi-week grid vs the timed grid - misaligning bars under
  // the wrong week header (caught in code review). One grid makes that
  // impossible: there's only one set of column tracks to desync from.
  const hasMultiWeek = multiPacked.length > 0;
  const hasTimed = timeRows.length > 0;
  const hasDivider = hasMultiWeek && hasTimed;
  const multiWeekRowStart = 2;
  const multiWeekRowCount = hasMultiWeek ? multiLaneCount : 0;
  const dividerRow = hasDivider ? multiWeekRowStart + multiWeekRowCount : null;
  const timedRowStart = hasDivider ? dividerRow + 1 : multiWeekRowStart + multiWeekRowCount;
  const gridTemplateRows = [
    `${headerRowHeight}px`,
    ...(hasMultiWeek ? Array(multiWeekRowCount).fill(`${rowHeight}px`) : []),
    ...(hasDivider ? [`${dividerRowHeight}px`] : []),
    ...Array(totalTimedRows).fill(`${rowHeight}px`)
  ].join(' ');

  // On a narrow viewport the grid is wider than the visible scroll container
  // and starts scrolled to week 1 by default - today and every upcoming
  // contest sit off-screen to the right until the user manually scrolls
  // (caught in code review: with all-upcoming data this makes the calendar
  // look empty on first open). Scroll to put one week of past context, then
  // today, at the left edge instead.
  useEffect(() => {
    if (loading || !ecScrollRef.current) return;
    const el = ecScrollRef.current;
    const columnWidth = el.scrollWidth / weeksToShow;
    el.scrollLeft = Math.max(0, (todayColumn - 2) * columnWidth);
  }, [loading, todayColumn, weeksToShow]);

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
          so neither group collides with or crowds out the other. The time
          label column is a genuinely separate, non-scrolling strip beside
          the week grid - not inside the horizontal scroller at all - so it
          can never visually overlap bars that have scrolled underneath it
          (a position:sticky column was tried first, but sticky elements
          only reserve their OWN space at their original position; once the
          week grid scrolled, real bar content slid in underneath the
          "stuck" label with nothing stopping the two from overlapping,
          caught when the label visibly cut off "Codeforces Round" bars). */}
      <div className="timeline-content">
        <div className="ec-wrap">
          <div className="ec-outer">
            <div className="ec-label-strip" style={{ gridTemplateRows }}>
              <div className="ec-label-cell" style={{ gridRow: 1 }} />
              {hasMultiWeek && Array.from({ length: multiWeekRowCount }, (_, i) => (
                <div key={`multi-label-${i}`} className="ec-label-cell" style={{ gridRow: multiWeekRowStart + i }} />
              ))}
              {hasDivider && <div className="ec-divider-line" style={{ gridRow: dividerRow }} />}
              {timeRows.map(row => (
                <div
                  key={row.label}
                  className="time-row-label"
                  style={{ gridRow: `${timedRowStart + row.startOffset} / span ${row.laneCount}` }}
                >
                  {row.label}
                </div>
              ))}
            </div>

            {/* Only the week-columns scroll together horizontally below ~900px -
                a weeks-wide Gantt can't meaningfully compress onto a phone
                screen, so it scrolls like any calendar/schedule app does on
                mobile instead of squashing text illegibly or overflowing the
                page. The label strip beside it never scrolls. */}
            <div className="ec-scroll" ref={ecScrollRef}>
              <div className="ec-scroll-inner" style={{ minWidth: `${weeksToShow * 110}px` }}>
                <div
                  className="ec-grid"
                  style={{
                    gridTemplateColumns: `repeat(${weeksToShow}, 1fr)`,
                    gridTemplateRows
                  }}
                >
                  <div
                    className="today-line"
                    style={{
                      gridRow: '2 / -1',
                      gridColumn: '1 / -1',
                      left: `${((todayColumn - 1) / weeksToShow) * 100}%`
                    }}
                  >
                    <div className="today-label">Today</div>
                  </div>

                  {hasDivider && (
                    <div className="ec-divider-line" style={{ gridRow: dividerRow, gridColumn: '1 / -1' }} />
                  )}

                  {weeks.map((week, index) => (
                    <div key={week} className="week-header" style={{ gridRow: 1, gridColumn: index + 1 }}>
                      <div className="week-label">Week {week}</div>
                      <div className="week-date">{getWeekLabel(index - 3)}</div>
                    </div>
                  ))}

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
                          gridRow: multiWeekRowStart + event.lane,
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

                  {timeRows.map(row =>
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
                            gridRow: timedRowStart + row.startOffset + event.lane,
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
