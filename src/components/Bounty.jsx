import { useState, useEffect } from 'react';
import './Bounty.css';
import { fetchTopcoderChallenges, formatChallengesForTimeline } from '../services/topcoderService';

function Bounty() {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTopcoderChallenges()
      .then(raw => {
        setChallenges(formatChallengesForTimeline(raw));
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading Topcoder challenges:', err);
        setError('Failed to load challenges.');
        setLoading(false);
      });
  }, []);

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

  return (
    <div className="bounty-container">
      <div className="bounty-content">
        {loading && (
          <div className="bounty-loading">Loading Topcoder challenges...</div>
        )}

        {!loading && error && (
          <div className="bounty-empty">{error}</div>
        )}

        {!loading && !error && challenges.length === 0 && (
          <div className="bounty-empty">No active Topcoder challenges found.</div>
        )}

        {!loading && challenges.length > 0 && (
          <div className="bounty-section">
            <h2 className="bounty-section-title">Topcoder Challenges</h2>
            <div className="bounty-grid">
              {challenges.map((challenge) => (
                <div
                  key={challenge.id}
                  className="bounty-card"
                  onClick={() => window.open(challenge.detailLink, '_blank', 'noopener,noreferrer')}
                  style={{ borderColor: getTrackColor(challenge.track) }}
                >
                  <div className="bounty-card-badges">
                    <span
                      className="bounty-track"
                      style={{ color: getTrackColor(challenge.track) }}
                    >
                      {challenge.track}
                    </span>
                  </div>
                  <div className="bounty-card-header">
                    <h3 className="bounty-card-title">{challenge.title}</h3>
                  </div>
                  <p className="bounty-card-description">
                    Phase: {challenge.phases?.currentPhase || 'N/A'}{' '}
                    <span aria-hidden="true">&middot;</span>{' '}
                    Deadline:{' '}
                    {challenge.submissionEndDate
                      ? new Date(challenge.submissionEndDate).toLocaleDateString()
                      : 'N/A'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Bounty;
