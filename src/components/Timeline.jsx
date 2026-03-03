import { useState, useEffect } from 'react';
import './Timeline.css';
import { fetchCodeforcesContests, formatContestsForTimeline } from '../services/codeforcesService';

function Timeline() {
  const [currentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('events-calendar');
  const [codeforcesContests, setCodeforcesContests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
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
  
  // Codeforces contests are the only events displayed
  const allEvents = codeforcesContests;

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

          {/* Events */}
          <div className="events-container">
            {allEvents.map((event, index) => {
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
    </div>
  );
}

export default Timeline;
