import { useState, useEffect } from 'react';
import './Bounty.css';
import { fetchTopcoderChallenges } from '../services/topcoderService';

function Bounty() {
  const [selectedBounty, setSelectedBounty] = useState(null);
  const [topcoderChallenges, setTopcoderChallenges] = useState([]);
  const [loadingTopcoder, setLoadingTopcoder] = useState(true);
  
  // Load Topcoder challenges from the API
  useEffect(() => {
    fetchTopcoderChallenges()
      .then(challenges => {
        setTopcoderChallenges(challenges);
        setLoadingTopcoder(false);
      })
      .catch(error => {
        console.error('Error loading Topcoder challenges:', error);
        setLoadingTopcoder(false);
      });
  }, []);
  
  // Hardcoded bounty data - only UNSOLVED bounties are shown
  const hardcodedBounties = [
    {
      id: 1,
      title: 'Fix Authentication Bug',
      description: 'Users are unable to log in when using special characters in their password. Need to sanitize input and fix the validation logic.',
      reward: '$500',
      status: 'UNSOLVED',
      difficulty: 'Medium',
      category: 'Security Bounties',
      tags: ['Backend', 'Security']
    },
    {
      id: 2,
      title: 'Improve API Performance',
      description: 'The /api/users endpoint is taking too long to respond. Need to optimize database queries and add caching.',
      reward: '$1000',
      status: 'UNSOLVED',
      difficulty: 'Hard',
      category: 'Performance Optimization',
      tags: ['Backend', 'Performance']
    },
    {
      id: 3,
      title: 'Responsive Design Issues',
      description: 'The dashboard does not render correctly on mobile devices. Need to fix CSS and make it responsive.',
      reward: '$300',
      status: 'UNSOLVED',
      difficulty: 'Easy',
      category: 'UI/UX Design',
      tags: ['Frontend', 'CSS']
    },
    {
      id: 4,
      title: 'Add Dark Mode Toggle',
      description: 'Implement a dark mode toggle that persists user preference in localStorage.',
      reward: '$400',
      status: 'UNSOLVED',
      difficulty: 'Medium',
      category: 'Feature Development',
      tags: ['Frontend', 'UI/UX']
    },
    {
      id: 5,
      title: 'Database Migration Script',
      description: 'Create a migration script to move data from MongoDB to PostgreSQL while maintaining data integrity.',
      reward: '$800',
      status: 'UNSOLVED',
      difficulty: 'Hard',
      category: 'Database Management',
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
        return '#f4ff3a';
      default:
        return '#999';
    }
  };

  const getTrackColor = (track) => {
    switch (track) {
      case 'Dev':
      case 'DEVELOP':
        return '#4a9eff';
      case 'Des':
      case 'DESIGN':
        return '#ff6b3d';
      case 'DS':
      case 'DATA_SCIENCE':
        return '#9c4aff';
      case 'QA':
        return '#4aff8c';
      default:
        return '#999';
    }
  };

  const getTopcoderReward = (prizeSets) => {
    if (!prizeSets || prizeSets.length === 0) return 'TBD';
    const firstPrize = prizeSets[0]?.prizes?.[0]?.value;
    return firstPrize ? `$${firstPrize.toLocaleString()}` : 'TBD';
  };

  const getTopcoderTags = (challenge) => {
    return [...(challenge.technologies || []), ...(challenge.tags || [])].slice(0, 4);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'TBD';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'TBD';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="bounty-container">
      <div className="bounty-content">
        {loadingTopcoder && (
          <div className="bounty-loading">Loading Topcoder challenges...</div>
        )}

        {!loadingTopcoder && topcoderChallenges.length > 0 && (
          <div className="bounty-section">
            <h2 className="bounty-section-title">Topcoder Challenges</h2>
            <div className="bounty-grid">
              {topcoderChallenges.map((challenge) => {
                const tags = getTopcoderTags(challenge);
                const reward = getTopcoderReward(challenge.prizeSets);
                const trackColor = getTrackColor(challenge.track);
                return (
                  <div
                    key={challenge.id}
                    className="bounty-card"
                    onClick={() => window.open(challenge.detailLink, '_blank', 'noopener,noreferrer')}
                    style={{ borderColor: trackColor }}
                  >
                    <div className="bounty-card-badges">
                      <span className="bounty-reward" aria-label={`Reward: ${reward}`}>
                        <span className="coin-icon" aria-hidden="true">$</span>
                        {reward}
                      </span>
                      <span
                        className="bounty-track-badge"
                        style={{ backgroundColor: trackColor }}
                        aria-label={`Track: ${challenge.track}`}
                      >
                        {challenge.track}
                      </span>
                    </div>
                    <div className="bounty-card-header">
                      <h3 className="bounty-card-title">{challenge.name}</h3>
                    </div>
                    <p className="bounty-card-description">
                      {challenge.overview || 'View challenge on Topcoder for details.'}
                    </p>
                    <div className="bounty-card-dates">
                      <span className="bounty-date-item">
                        <span className="bounty-date-label">Reg. Ends:</span>
                        <span className="bounty-date-value">{formatDate(challenge.registrationEndDate)}</span>
                      </span>
                      <span className="bounty-date-item">
                        <span className="bounty-date-label">Sub. Ends:</span>
                        <span className="bounty-date-value">{formatDate(challenge.submissionEndDate)}</span>
                      </span>
                    </div>
                    {tags.length > 0 && (
                      <div className="bounty-card-tags">
                        {tags.map((tag, index) => (
                          <span key={index} className="bounty-tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        <div className="bounty-section">
          <h2 className="bounty-section-title">Available Bounties</h2>
          <div className="bounty-grid">
            {hardcodedBounties.map((bounty) => (
              <div
                key={bounty.id}
                className="bounty-card"
                onClick={() => handleCardClick(bounty)}
                style={{ borderColor: getDifficultyColor(bounty.difficulty) }}
              >
                <div className="bounty-card-badges">
                  <span className="bounty-reward" aria-label={`Reward: ${bounty.reward}`}>
                    <span className="coin-icon" aria-hidden="true">$</span>
                    {bounty.reward}
                  </span>
                </div>
                <div className="bounty-card-header">
                  <h3 className="bounty-card-title">{bounty.title}</h3>
                </div>
                <p className="bounty-card-description">
                  {bounty.description}
                </p>
                {bounty.tags && bounty.tags.length > 0 && (
                  <div className="bounty-card-tags">
                    {bounty.tags.map((tag, index) => (
                      <span key={index} className="bounty-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
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
