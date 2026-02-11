import { useState, useEffect } from 'react';
import './Timeline.css';
import { fetchTopcoderChallenges, formatChallengesForTimeline } from '../services/topcoderService';

function Timeline() {
  const [currentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('events-calendar');
  const [topcoderChallenges, setTopcoderChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Fetch Topcoder challenges on component mount
  useEffect(() => {
    async function loadChallenges() {
      try {
        setLoading(true);
        const challenges = await fetchTopcoderChallenges();
        const formattedEvents = formatChallengesForTimeline(challenges, currentDate);
        setTopcoderChallenges(formattedEvents);
        setError(null);
      } catch (err) {
        console.error('Failed to load Topcoder challenges:', err);
        setError(null); // Don't show error since we have fallback data
      } finally {
        setLoading(false);
      }
    }
    
    loadChallenges();
  }, [currentDate]);
  
  // Hardcoded event data with new gradient colors
  const events = [
    {
      id: 1,
      title: 'Project Alpha',
      startWeek: -1,
      duration: 3,
      gradient: 'linear-gradient(90deg, #ff6b3d 0%, #ffb03d 100%)'
    },
    {
      id: 2,
      title: 'Beta Release',
      startWeek: 1,
      duration: 2,
      gradient: 'linear-gradient(90deg, #ffb03d 0%, #f4ff3a 100%)'
    },
    {
      id: 3,
      title: 'Gamma Testing',
      startWeek: 2,
      duration: 4,
      gradient: 'linear-gradient(90deg, #ff4d3d 0%, #ff6b3d 100%)'
    },
    {
      id: 4,
      title: 'Delta Deployment',
      startWeek: 4,
      duration: 2,
      gradient: 'linear-gradient(90deg, #ff6b3d 0%, #ffb03d 100%)'
    }
  ];

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

  // Combine hardcoded events with Topcoder challenges
  const allEvents = [...events, ...topcoderChallenges];

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
          <p>Loading Topcoder challenges...</p>
        </div>
      )}
      
      {error && (
        <div className="timeline-status error">
          <p>{error}</p>
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
                  onClick={() => event.detailLink && window.open(event.detailLink, '_blank')}
                  title={event.type === 'topcoder' ? `${event.title} (${event.track})` : event.title}
                >
                  <span className="event-title">{event.title}</span>
                  <span className="event-arrow">›</span>
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
