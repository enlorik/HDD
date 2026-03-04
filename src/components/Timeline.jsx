import { useState, useEffect } from 'react';
import './Timeline.css';
import { fetchCodeforcesContests, formatContestsForTimeline } from '../services/codeforcesService';

// localStorage key for persisting timeline event opt-in state
const STORAGE_KEY = 'timeline-event-enabled';

function Timeline() {
  const [currentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('events-calendar');
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

  return (
    <div className="timeline-container">
      {/* Tab Navigation */}
      <div className="timeline-tabs">
        <button 
          className={`timeline-tab ${activeTab === 'events-calendar' ? 'active' : ''}`}
          onClick={() => setActiveTab('events-calendar')}
        >
          Events Calendar
        </button>
        <button 
          className={`timeline-tab ${activeTab === 'schedule' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedule')}
        >
          Schedule
        </button>
        <button 
          className={`timeline-tab ${activeTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          Timeline
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

      {/* Events Calendar Tab */}
      {activeTab === 'events-calendar' && (
        <div className="timeline-content">
          <div className="timeline-grid">
            {/* Week headers */}
            <div className="week-headers">
              {weeks.map((week, index) => (
                <div key={week} className="week-header">
                  <div className="week-label">Week {week}</div>
                  <div className="week-date">{getWeekLabel(index - 3)}</div>
                </div>
              ))}
            </div>

            {/* Today line */}
            <div className="today-line" style={{ left: `${(3 / weeksToShow) * 100}%` }}>
              <div className="today-label">Today</div>
            </div>

            {/* Events (only those opted-in via the Timeline tab) */}
            <div className="events-container">
              {visibleEvents.map((event, index) => {
                const leftPercent = ((event.startWeek + 3) / weeksToShow) * 100;
                const widthPercent = (event.duration / weeksToShow) * 100;

                // Build tooltip text
                let tooltipText = event.title;
                if (event.type === 'codeforces') {
                  tooltipText += ` (${event.contestType})`;
                  tooltipText += `\nPhase: ${event.phase}`;
                }
                
                return (
                  <div
                    key={event.id}
                    className="event-bar"
                    style={{
                      left: `${leftPercent}%`,
                      width: `${widthPercent}%`,
                      background: event.gradient,
                      top: `${index * 70 + 10}px`
                    }}
                    onClick={() => event.detailLink && window.open(event.detailLink, '_blank', 'noopener,noreferrer')}
                    title={tooltipText}
                  >
                    <span className="event-title">{event.title}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Timeline Tab — event list with opt-in checkboxes and click-to-remove */}
      {activeTab === 'timeline' && (
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
                /* Clicking the bubble toggles the event off/on the calendar */
                onClick={() => toggleEvent(event.id)}
                title={enabled ? 'Click to remove from calendar' : 'Click to add to calendar'}
              >
                {/* Checkbox to opt-in / opt-out; click handled by the bubble wrapper */}
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
      )}

      {/* Schedule Tab — placeholder */}
      {activeTab === 'schedule' && (
        <div className="timeline-content">
          <div className="timeline-status">
            <p>Schedule view coming soon.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Timeline;
