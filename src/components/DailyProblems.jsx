import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchAllDailyProblems } from '../services/codeforcesService';
import { buildProblemWorkspaceUrl } from '../utils/problemWorkspace';
import './DailyProblems.css';

const STORAGE_KEY = 'hdd-user-profile';

function loadHandle() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved).codeforcesHandle || '') : '';
  } catch {
    return '';
  }
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function ratingBadgeClass(rating) {
  if (!rating) return '';
  if (rating <= 1200) return 'daily-rating-badge--green';
  if (rating <= 1600) return 'daily-rating-badge--blue';
  if (rating <= 2000) return 'daily-rating-badge--orange';
  return 'daily-rating-badge--red';
}

function ProblemCard({ displayName, problem, error }) {
  if (error) {
    return (
      <div className="daily-card daily-card--error">
        <div className="daily-card-tag">{displayName}</div>
        <div className="daily-card-error-msg" role="alert">⚠ Failed to load – try refreshing</div>
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="daily-card daily-card--empty">
        <div className="daily-card-tag">{displayName}</div>
        <div className="daily-card-empty-msg">No eligible problems found</div>
      </div>
    );
  }

  const cfUrl = `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`;
  const workspaceUrl = buildProblemWorkspaceUrl(problem);

  return (
    <div className="daily-card">
      <div className="daily-card-tag">{displayName}</div>
      <div className="daily-card-name">{problem.name}</div>
      <div className="daily-card-meta">
        {problem.rating && (
          <span className={`daily-rating-badge ${ratingBadgeClass(problem.rating)}`}>
            {problem.rating}
          </span>
        )}
        <span className="daily-problem-id">
          {problem.contestId}{problem.index}
        </span>
      </div>
      {problem.tags && problem.tags.length > 0 && (
        <div className="daily-card-tags">
          {problem.tags.map((t, i) => (
            <span key={`${t}-${i}`} className="daily-tag-chip">{t}</span>
          ))}
        </div>
      )}
      <div className="daily-card-actions">
        <Link
          to={workspaceUrl}
          state={{ problem }}
          className="daily-workspace-btn"
        >
          Open Workspace
        </Link>
        <a
          href={cfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="daily-solve-link"
        >
          Codeforces ↗
        </a>
      </div>
    </div>
  );
}

function DailyProblems() {
  const [handle] = useState(loadHandle);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await fetchAllDailyProblems(handle || null);
      setItems(results);
    } catch (err) {
      console.error('[DailyProblems] Load failed:', err);
      setError('Failed to load problems — please try refreshing.');
    } finally {
      setLoading(false);
    }
  }, [handle]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="daily-container">
      <div className="daily-content">
        <div className="daily-header">
          <h1 className="daily-title">Daily Problems</h1>
          <p className="daily-date">Problems for {formatDate(new Date())}</p>
          {!handle && (
            <p className="daily-notice">
              Set your Codeforces handle in{' '}
              <Link to="/profile">Profile</Link>{' '}
              to get personalised problems.
            </p>
          )}
          <button
            className="daily-refresh-btn"
            onClick={load}
            disabled={loading}
          >
            🔄 Refresh
          </button>
        </div>

        {loading ? (
          <div className="daily-loading">Loading daily problems…</div>
        ) : error ? (
          <div className="daily-error-banner" role="alert">{error}</div>
        ) : (
          <div className="daily-grid">
            {items.map(({ tag, displayName, problem, error: tagError }) => (
              <ProblemCard key={tag} displayName={displayName} problem={problem} error={tagError} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default DailyProblems;
