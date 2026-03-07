import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './ProblemDetail.css';
import { fetchTimusProblems, openSubmissionPage, getProblemUrl, TIMUS_LANGUAGES } from '../services/timusService';

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

function saveSolvedProblems(ids) {
  try {
    localStorage.setItem(SOLVED_KEY, JSON.stringify(ids));
  } catch {
    console.error('Failed to save solved problems to localStorage');
  }
}

function ProblemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const problemId = parseInt(id, 10);

  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [judgeId] = useState(() => loadJudgeId());
  const [solvedIds, setSolvedIds] = useState(() => loadSolvedProblems());
  const [selectedLanguage, setSelectedLanguage] = useState(TIMUS_LANGUAGES[0].value);

  useEffect(() => {
    if (isNaN(problemId)) {
      setError('Invalid problem ID.');
      setLoading(false);
      return;
    }
    async function loadProblem() {
      setLoading(true);
      setError(null);
      try {
        const { problems } = await fetchTimusProblems();
        const found = problems.find(p => p.id === problemId);
        if (found) {
          setProblem(found);
        } else {
          setError(`Problem #${problemId} not found.`);
        }
      } catch {
        setError('Failed to load problem data. Please try again later.');
      } finally {
        setLoading(false);
      }
    }
    loadProblem();
  }, [problemId]);

  const isSolved = solvedIds.includes(problemId);

  const toggleSolved = () => {
    setSolvedIds(prev => {
      const updated = prev.includes(problemId)
        ? prev.filter(x => x !== problemId)
        : [...prev, problemId];
      saveSolvedProblems(updated);
      return updated;
    });
  };

  const handleSubmit = () => {
    openSubmissionPage(problemId, judgeId, selectedLanguage);
  };

  return (
    <div className="pd-container">
      <div className="pd-content">
        <button className="pd-back-btn" onClick={() => navigate('/timus')}>
          ← Back to problems
        </button>

        {loading && <div className="pd-loading">Loading problem…</div>}
        {!loading && error && <div className="pd-error">{error}</div>}

        {!loading && !error && problem && (
          <>
            <div className="pd-header">
              <div className="pd-meta">
                <span className="pd-problem-id">#{problem.id}</span>
                <span
                  className="pd-difficulty-badge"
                  style={{ color: DIFFICULTY_COLORS[problem.difficulty] || '#999' }}
                >
                  {DIFFICULTY_LABELS[problem.difficulty] || `Level ${problem.difficulty}`}
                </span>
                <span className="pd-category-badge">{problem.category}</span>
                {isSolved && <span className="pd-solved-badge">✓ Solved</span>}
              </div>
              <h1 className="pd-title">{problem.title}</h1>
              <p className="pd-solved-count">
                Solved by <strong>{problem.solved.toLocaleString()}</strong> users
              </p>
            </div>

            <div className="pd-statement-section">
              <h2 className="pd-section-heading">Problem Statement</h2>
              <p className="pd-statement-note">
                The full problem statement is hosted on the Timus Online Judge website.
              </p>
              <a
                href={getProblemUrl(problem.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="pd-view-btn"
              >
                View on Timus ↗
              </a>
            </div>

            <div className="pd-submit-section">
              <h2 className="pd-section-heading">Submit Solution</h2>

              {!judgeId && (
                <p className="pd-notice">
                  ℹ️ Set your{' '}
                  <a href="/profile" className="pd-link">Timus Judge ID in Profile</a>
                  {' '}to pre-fill your submission.
                </p>
              )}
              {judgeId && (
                <p className="pd-notice pd-notice--ok">
                  Submitting as Judge ID: <strong>{judgeId}</strong>
                </p>
              )}

              <div className="pd-form">
                <div className="pd-field">
                  <label className="pd-label" htmlFor="pd-language">
                    Language
                  </label>
                  <select
                    id="pd-language"
                    className="pd-select"
                    value={selectedLanguage}
                    onChange={e => setSelectedLanguage(e.target.value)}
                  >
                    {TIMUS_LANGUAGES.map(lang => (
                      <option key={lang.value} value={lang.value}>{lang.label}</option>
                    ))}
                  </select>
                  <p className="pd-field-hint">
                    Select your preferred language. You will confirm and paste your code on Timus.
                  </p>
                </div>

                <div className="pd-actions">
                  <button
                    className="pd-submit-btn"
                    onClick={handleSubmit}
                  >
                    Submit on Timus ↗
                  </button>
                  <button
                    className={`pd-solved-btn${isSolved ? ' marked' : ''}`}
                    onClick={toggleSolved}
                  >
                    {isSolved ? '✓ Marked as solved' : '○ Mark as solved'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ProblemDetail;
