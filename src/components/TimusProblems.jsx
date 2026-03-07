import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './TimusProblems.css';
import { fetchTimusProblems, fetchUserSolvedProblems, openSubmissionPage } from '../services/timusService';

const STORAGE_KEY = 'hdd-user-profile';
const SOLVED_KEY = 'timus-solved-problems';

const DIFFICULTY_LABELS = {
  1: 'Easy',
  2: 'Medium',
  3: 'Hard',
  4: 'Expert'
};

const DIFFICULTY_COLORS = {
  1: '#4caf50',
  2: '#4a9eff',
  3: '#ff9800',
  4: '#f44336'
};

function loadJudgeId() {
  try {
    const profile = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return profile.timusJudgeId || null;
  } catch {
    return null;
  }
}

function loadSolvedProblems() {
  try {
    return JSON.parse(localStorage.getItem(SOLVED_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveSolvedProblems(solvedIds) {
  try {
    localStorage.setItem(SOLVED_KEY, JSON.stringify(solvedIds));
  } catch {
    console.error('Failed to save solved problems to localStorage');
  }
}

function TimusProblems() {
  const navigate = useNavigate();
  const [problems, setProblems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [solvedIds, setSolvedIds] = useState(() => loadSolvedProblems());
  const [judgeId, setJudgeId] = useState(() => loadJudgeId());
  const [showSolvedOnly, setShowSolvedOnly] = useState(false);
  const [showUnsolvedOnly, setShowUnsolvedOnly] = useState(() => Boolean(loadJudgeId()));
  const [syncStatus, setSyncStatus] = useState(null); // null | 'syncing' | 'synced' | 'unavailable'

  useEffect(() => {
    async function loadProblems() {
      setLoading(true);
      setError(null);
      try {
        const { problems: fetched, categories: cats } = await fetchTimusProblems(
          selectedCategory === 'all' ? null : selectedCategory
        );
        setProblems(fetched);
        setCategories(cats);
      } catch (err) {
        console.error('Error loading Timus problems:', err);
        setError('Failed to load problems. Please try again later.');
      } finally {
        setLoading(false);
      }
    }
    loadProblems();
  }, [selectedCategory]);

  // Auto-sync solved problems from Timus when judgeId is available
  useEffect(() => {
    if (!judgeId) return;
    setSyncStatus('syncing');
    fetchUserSolvedProblems(judgeId).then(ids => {
      if (ids && ids.size > 0) {
        const newSolved = [...ids];
        setSolvedIds(newSolved);
        saveSolvedProblems(newSolved);
        setSyncStatus('synced');
      } else {
        setSyncStatus('unavailable');
      }
    });
  }, [judgeId]);

  // Reload judgeId whenever the component gains focus (user may have updated profile)
  useEffect(() => {
    const refresh = () => {
      const id = loadJudgeId();
      setJudgeId(id);
      if (id) setShowUnsolvedOnly(true);
    };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  const toggleSolved = (id) => {
    setSolvedIds(prev => {
      const updated = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      saveSolvedProblems(updated);
      return updated;
    });
  };

  const handleSubmit = (e, problem) => {
    e.stopPropagation();
    openSubmissionPage(problem.id, judgeId);
  };

  const handleRowClick = (problemId) => {
    navigate(`/timus/${problemId}`);
  };

  const visibleProblems = problems.filter(p => {
    if (showSolvedOnly) return solvedIds.includes(p.id);
    if (showUnsolvedOnly) return !solvedIds.includes(p.id);
    return true;
  });

  return (
    <div className="timus-container">
      <div className="timus-content">
        <div className="timus-header">
          <h1 className="timus-title">Timus Online Judge</h1>
          {!judgeId && (
            <p className="timus-judge-notice">
              ℹ️ Set your{' '}
              <a href="/profile" className="timus-link">Timus Judge ID in Profile</a>
              {' '}to auto-sync solved problems and pre-fill submissions.
            </p>
          )}
          {judgeId && syncStatus === 'syncing' && (
            <p className="timus-sync-notice timus-sync-notice--loading">
              ⏳ Syncing solved problems from your Timus profile…
            </p>
          )}
          {judgeId && syncStatus === 'synced' && (
            <p className="timus-sync-notice timus-sync-notice--ok">
              ✓ Solved problems synced from Timus (Judge ID: {judgeId})
            </p>
          )}
          {judgeId && syncStatus === 'unavailable' && (
            <p className="timus-sync-notice timus-sync-notice--warn">
              ⚠️ Auto-sync unavailable (CORS). Use the ✓/○ buttons to track solved problems manually.
            </p>
          )}
        </div>

        <div className="timus-filters">
          <div className="timus-filter-group">
            <label className="timus-filter-label">Category</label>
            <select
              className="timus-select"
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="timus-filter-group timus-filter-toggles">
            <button
              className={`timus-toggle-btn${showUnsolvedOnly ? ' active' : ''}`}
              onClick={() => {
                setShowUnsolvedOnly(v => !v);
                setShowSolvedOnly(false);
              }}
            >
              Unsolved only
            </button>
            <button
              className={`timus-toggle-btn${showSolvedOnly ? ' active' : ''}`}
              onClick={() => {
                setShowSolvedOnly(v => !v);
                setShowUnsolvedOnly(false);
              }}
            >
              Solved only
            </button>
          </div>
        </div>

        {loading && (
          <div className="timus-loading">Loading Timus problems…</div>
        )}

        {!loading && error && (
          <div className="timus-empty">{error}</div>
        )}

        {!loading && !error && visibleProblems.length === 0 && (
          <div className="timus-empty">No problems found for the selected filters.</div>
        )}

        {!loading && !error && visibleProblems.length > 0 && (
          <div className="timus-section">
            <h2 className="timus-section-title">
              Problems — easiest first
              <span className="timus-count">{visibleProblems.length}</span>
            </h2>
            <div className="timus-table">
              <div className="timus-table-header">
                <span className="timus-col-id">#</span>
                <span className="timus-col-title">Problem</span>
                <span className="timus-col-difficulty">Difficulty</span>
                <span className="timus-col-solved">Solved by</span>
                <span className="timus-col-actions">Actions</span>
              </div>
              {visibleProblems.map(problem => {
                const isSolved = solvedIds.includes(problem.id);
                return (
                  <div
                    key={problem.id}
                    className={`timus-row timus-row--clickable${isSolved ? ' timus-row--solved' : ''}`}
                    onClick={() => handleRowClick(problem.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && handleRowClick(problem.id)}
                  >
                    <span className="timus-col-id timus-problem-id">{problem.id}</span>
                    <span className="timus-col-title">
                      <span className="timus-problem-link">
                        {problem.title}
                      </span>
                      <span className="timus-category-badge">{problem.category}</span>
                    </span>
                    <span className="timus-col-difficulty">
                      <span
                        className="timus-difficulty-badge"
                        style={{ color: DIFFICULTY_COLORS[problem.difficulty] || '#999' }}
                      >
                        {DIFFICULTY_LABELS[problem.difficulty] || `Level ${problem.difficulty}`}
                      </span>
                    </span>
                    <span className="timus-col-solved timus-solved-count">
                      {problem.solved.toLocaleString()}
                    </span>
                    <span className="timus-col-actions timus-actions">
                      <button
                        className={`timus-btn timus-btn--solved${isSolved ? ' marked' : ''}`}
                        onClick={e => { e.stopPropagation(); toggleSolved(problem.id); }}
                        title={isSolved ? 'Mark as unsolved' : 'Mark as solved'}
                      >
                        {isSolved ? '✓' : '○'}
                      </button>
                      <button
                        className="timus-btn timus-btn--submit"
                        onClick={e => handleSubmit(e, problem)}
                        title="Submit solution on Timus"
                      >
                        Submit
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TimusProblems;
