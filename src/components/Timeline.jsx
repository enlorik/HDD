import { useState } from 'react';
import './Timeline.css';

function Timeline() {
  const [currentDate] = useState(new Date());
  
  // Hardcoded event data
  const events = [
    {
      id: 1,
      title: 'Project Alpha',
      startWeek: -1,
      duration: 3,
      color: '#4a90e2'
    },
    {
      id: 2,
      title: 'Beta Release',
      startWeek: 1,
      duration: 2,
      color: '#e24a90'
    },
    {
      id: 3,
      title: 'Gamma Testing',
      startWeek: 2,
      duration: 4,
      color: '#90e24a'
    },
    {
      id: 4,
      title: 'Delta Deployment',
      startWeek: 4,
      duration: 2,
      color: '#e2904a'
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
    const weekNum = currentWeek + weekOffset;
    return `W${weekNum}`;
  };

  return (
    <div className="timeline-container">
      <div className="timeline-header">
        <h1>Timeline Dashboard</h1>
        <p className="timeline-subtitle">Project Timeline View</p>
      </div>

      <div className="timeline-content">
        <div className="timeline-grid">
          {/* Week headers */}
          <div className="week-headers">
            {weeks.map((week, index) => (
              <div key={week} className="week-header">
                {getWeekLabel(index - 3)}
              </div>
            ))}
          </div>

          {/* Today line */}
          <div className="today-line" style={{ left: `${(3 / weeksToShow) * 100}%` }}>
            <div className="today-label">Today</div>
          </div>

          {/* Events */}
          <div className="events-container">
            {events.map((event, index) => {
              const leftPercent = ((event.startWeek + 3) / weeksToShow) * 100;
              const widthPercent = (event.duration / weeksToShow) * 100;
              
              return (
                <div
                  key={event.id}
                  className="event-bar"
                  style={{
                    left: `${leftPercent}%`,
                    width: `${widthPercent}%`,
                    backgroundColor: event.color,
                    top: `${index * 60 + 10}px`
                  }}
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
