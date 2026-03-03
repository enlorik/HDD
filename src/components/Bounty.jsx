import { useState, useEffect } from 'react';
import './Bounty.css';
import { fetchCodeforcesContests } from '../services/codeforcesService';

function Bounty() {
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCodeforcesContests()
      .then(data => {
        setContests(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading Codeforces contests:', err);
        setError('Failed to load contests.');
        setLoading(false);
      });
  }, []);

  const getTypeColor = (type) => {
    switch (type) {
      case 'CF':
        return '#4a9eff';
      case 'IOI':
        return '#ff6b3d';
      case 'ICPC':
        return '#9c4aff';
      default:
        return '#999';
    }
  };

  return (
    <div className="bounty-container">
      <div className="bounty-content">
        {loading && (
          <div className="bounty-loading">Loading Codeforces contests...</div>
        )}

        {!loading && error && (
          <div className="bounty-empty">{error}</div>
        )}

        {!loading && !error && contests.length === 0 && (
          <div className="bounty-empty">No active Codeforces contests found.</div>
        )}

        {!loading && contests.length > 0 && (
          <div className="bounty-section">
            <h2 className="bounty-section-title">Codeforces Contests</h2>
            <div className="bounty-grid">
              {contests.map((contest) => (
                <div
                  key={contest.id}
                  className="bounty-card"
                  onClick={() => window.open(contest.detailLink, '_blank', 'noopener,noreferrer')}
                  style={{ borderColor: getTypeColor(contest.type) }}
                >
                  <div className="bounty-card-badges">
                    <span
                      className="bounty-track"
                      style={{ color: getTypeColor(contest.type) }}
                    >
                      {contest.type}
                    </span>
                  </div>
                  <div className="bounty-card-header">
                    <h3 className="bounty-card-title">{contest.name}</h3>
                  </div>
                  <p className="bounty-card-description">
                    Phase: {contest.phase}{' '}
                    <span aria-hidden="true">&middot;</span>{' '}
                    Start:{' '}
                    {contest.startTimeSeconds
                      ? new Date(contest.startTimeSeconds * 1000).toLocaleDateString()
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
