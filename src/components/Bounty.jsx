import { useState } from 'react';
import './Bounty.css';

function Bounty() {
  const [selectedBounty, setSelectedBounty] = useState(null);
  
  // Hardcoded bounty data - only UNSOLVED bounties are shown
  const bounties = [
    {
      id: 1,
      title: 'Fix Authentication Bug',
      description: 'Users are unable to log in when using special characters in their password. Need to sanitize input and fix the validation logic.',
      reward: '$500',
      status: 'UNSOLVED',
      difficulty: 'Medium',
      tags: ['Backend', 'Security']
    },
    {
      id: 2,
      title: 'Improve API Performance',
      description: 'The /api/users endpoint is taking too long to respond. Need to optimize database queries and add caching.',
      reward: '$1000',
      status: 'UNSOLVED',
      difficulty: 'Hard',
      tags: ['Backend', 'Performance']
    },
    {
      id: 3,
      title: 'Responsive Design Issues',
      description: 'The dashboard does not render correctly on mobile devices. Need to fix CSS and make it responsive.',
      reward: '$300',
      status: 'UNSOLVED',
      difficulty: 'Easy',
      tags: ['Frontend', 'CSS']
    },
    {
      id: 4,
      title: 'Add Dark Mode Toggle',
      description: 'Implement a dark mode toggle that persists user preference in localStorage.',
      reward: '$400',
      status: 'UNSOLVED',
      difficulty: 'Medium',
      tags: ['Frontend', 'UI/UX']
    },
    {
      id: 5,
      title: 'Database Migration Script',
      description: 'Create a migration script to move data from MongoDB to PostgreSQL while maintaining data integrity.',
      reward: '$800',
      status: 'UNSOLVED',
      difficulty: 'Hard',
      tags: ['Backend', 'Database']
    }
  ];

  const handleCardClick = (bounty) => {
    setSelectedBounty(bounty);
  };

  const handleClose = () => {
    setSelectedBounty(null);
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'Easy':
        return '#4a9eff';
      case 'Medium':
        return '#ff9800';
      case 'Hard':
        return '#ff1b8d';
      default:
        return '#999';
    }
  };

  return (
    <div className="bounty-container">
      <div className="bounty-header">
        <h1>Bounty Board</h1>
        <p className="bounty-subtitle">Available Challenges</p>
      </div>

      <div className="bounty-content">
        <div className="bounty-grid">
          {bounties.map((bounty) => (
            <div
              key={bounty.id}
              className="bounty-card"
              onClick={() => handleCardClick(bounty)}
            >
              <div className="bounty-card-header">
                <h3 className="bounty-card-title">{bounty.title}</h3>
                <span className="bounty-reward">{bounty.reward}</span>
              </div>
              <p className="bounty-card-description">
                {bounty.description.length > 100 
                  ? bounty.description.substring(0, 100) + '...'
                  : bounty.description
                }
              </p>
              <div className="bounty-card-footer">
                <span
                  className="bounty-difficulty"
                  style={{ backgroundColor: getDifficultyColor(bounty.difficulty) }}
                >
                  {bounty.difficulty}
                </span>
                <div className="bounty-tags">
                  {bounty.tags.map((tag, index) => (
                    <span key={index} className="bounty-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedBounty && (
        <div className="bounty-modal-overlay" onClick={handleClose}>
          <div className="bounty-modal" onClick={(e) => e.stopPropagation()}>
            <button className="bounty-modal-close" onClick={handleClose}>
              ×
            </button>
            <div className="bounty-modal-header">
              <h2>{selectedBounty.title}</h2>
              <span className="bounty-modal-reward">{selectedBounty.reward}</span>
            </div>
            <div className="bounty-modal-body">
              <div className="bounty-modal-meta">
                <span
                  className="bounty-difficulty"
                  style={{ backgroundColor: getDifficultyColor(selectedBounty.difficulty) }}
                >
                  {selectedBounty.difficulty}
                </span>
                <span className="bounty-status">Status: {selectedBounty.status}</span>
              </div>
              <div className="bounty-modal-tags">
                {selectedBounty.tags.map((tag, index) => (
                  <span key={index} className="bounty-tag">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="bounty-modal-description">
                <h3>Description</h3>
                <p>{selectedBounty.description}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Bounty;
