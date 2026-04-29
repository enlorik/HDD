import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchAllDailyProblems, CF_TAGS } from '../services/codeforcesService';
import './DailyProblems.css';

const STORAGE_KEY = 'hdd-user-profile';
const SELECTED_TAGS_KEY = 'hdd-selected-tags';

function loadHandle() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved).codeforcesHandle || '') : '';
  } catch {
    return '';
  }
}

function loadSelectedTags() {
  try {
    const saved = localStorage.getItem(SELECTED_TAGS_KEY);
    if (saved) {
      const tags = JSON.parse(saved);
      if (Array.isArray(tags) && tags.length > 0) return tags;
    }
  } catch {
    // fall through
  }
  // Default to first 5 tags
  return CF_TAGS.slice(0, 5).map(t => t.tag);
}

function saveSelectedTags(tags) {
  try {
    localStorage.setItem(SELECTED_TAGS_KEY, JSON.stringify(tags));
  } catch {
    // ignore
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

function ProblemCard({ displayName, problem, error, onRefresh, refreshing }) {
  if (error) {
    return (
      <div className="daily-card daily-card--error">
        <div className="daily-card-tag">{displayName}</div>
        <div className="daily-card-error-msg" role="alert">⚠ Failed to load – try refreshing</div>
        <div className="daily-card-actions">
          <button
            className="daily-refresh-btn"
            onClick={onRefresh}
            disabled={refreshing}
          >
            🔄 Refresh
          </button>
        </div>
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="daily-card daily-card--empty">
        <div className="daily-card-tag">{displayName}</div>
        <div className="daily-card-empty-msg">No eligible problems found</div>
        <div className="daily-card-actions">
          <button
            className="daily-refresh-btn"
            onClick={onRefresh}
            disabled={refreshing}
          >
            🔄 Refresh
          </button>
        </div>
      </div>
    );
  }

  const cfUrl = `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`;

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
      <div className="daily-card-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <a
          href={cfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="daily-solve-btn"
        >
          Solve on Codeforces ↗
        </a>
        <button
          className="daily-refresh-btn"
          onClick={onRefresh}
          disabled={refreshing}
          title="Get a different problem from this category"
        >
          🔄
        </button>
      </div>
    </div>
  );
}

function CategorySelector({ selectedTags, onTagsChange, availableTags }) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempSelection, setTempSelection] = useState(selectedTags);

  const handleToggleTag = (tag) => {
    if (tempSelection.includes(tag)) {
      setTempSelection(tempSelection.filter(t => t !== tag));
    } else {
      if (tempSelection.length < 5) {
        setTempSelection([...tempSelection, tag]);
      }
    }
  };

  const handleSave = () => {
    if (tempSelection.length > 0) {
      onTagsChange(tempSelection);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setTempSelection(selectedTags);
    setIsEditing(false);
  };

  if (!isEditing) {
    const selectedNames = selectedTags
      .map(tag => availableTags.find(t => t.tag === tag)?.displayName || tag)
      .join(', ');

    return (
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--ik-muted)', marginBottom: '0.5rem' }}>
          Selected categories: {selectedNames}
        </div>
        <button className="daily-refresh-btn" onClick={() => setIsEditing(true)}>
          ✏️ Change Categories
        </button>
      </div>
    );
  }

  return (
    <div style={{
      marginBottom: '1.5rem',
      padding: '1rem',
      backgroundColor: 'var(--ik-surface)',
      border: '1px solid var(--ik-border)',
      borderRadius: 'var(--ik-radius-sm)'
    }}>
      <div style={{ marginBottom: '0.75rem', fontSize: '0.9rem', fontWeight: '600', color: 'var(--ik-text)' }}>
        Select up to 5 categories ({tempSelection.length}/5):
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '0.5rem',
        marginBottom: '1rem'
      }}>
        {availableTags.map(({ tag, displayName }) => {
          const isSelected = tempSelection.includes(tag);
          return (
            <label
              key={tag}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem',
                backgroundColor: isSelected ? 'var(--ik-yellow-dim)' : 'var(--ik-card)',
                border: `1px solid ${isSelected ? 'var(--ik-yellow)' : 'var(--ik-border)'}`,
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                transition: 'all 0.15s'
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => handleToggleTag(tag)}
                disabled={!isSelected && tempSelection.length >= 5}
              />
              <span style={{ color: 'var(--ik-text)' }}>{displayName}</span>
            </label>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          className="daily-refresh-btn"
          onClick={handleSave}
          disabled={tempSelection.length === 0}
          style={{
            backgroundColor: 'var(--ik-yellow)',
            color: '#1a1a1a',
            borderColor: 'var(--ik-yellow)'
          }}
        >
          ✓ Save Selection
        </button>
        <button className="daily-refresh-btn" onClick={handleCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function DailyProblems() {
  const [handle] = useState(loadHandle);
  const [selectedTags, setSelectedTags] = useState(loadSelectedTags);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offsets, setOffsets] = useState({});
  const [refreshingTag, setRefreshingTag] = useState(null);

  const load = useCallback(async (tagsToLoad = selectedTags, offsetsToUse = {}) => {
    setLoading(true);
    setError(null);
    try {
      const results = await fetchAllDailyProblems(handle || null, tagsToLoad, offsetsToUse);
      setItems(results);
    } catch (err) {
      console.error('[DailyProblems] Load failed:', err);
      setError('Failed to load problems — please try refreshing.');
    } finally {
      setLoading(false);
    }
  }, [handle, selectedTags]);

  useEffect(() => {
    load();
  }, [load]);

  const handleTagsChange = (newTags) => {
    setSelectedTags(newTags);
    saveSelectedTags(newTags);
    setOffsets({});
    load(newTags, {});
  };

  const handleRefreshSingle = async (tag) => {
    setRefreshingTag(tag);
    const newOffsets = { ...offsets, [tag]: (offsets[tag] || 0) + 1 };
    setOffsets(newOffsets);

    try {
      const results = await fetchAllDailyProblems(handle || null, selectedTags, newOffsets);
      setItems(results);
    } catch (err) {
      console.error(`[DailyProblems] Refresh failed for tag "${tag}":`, err);
    } finally {
      setRefreshingTag(null);
    }
  };

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

          <CategorySelector
            selectedTags={selectedTags}
            onTagsChange={handleTagsChange}
            availableTags={CF_TAGS}
          />

          <button
            className="daily-refresh-btn"
            onClick={() => {
              setOffsets({});
              load(selectedTags, {});
            }}
            disabled={loading}
          >
            🔄 Refresh All
          </button>
        </div>

        {loading ? (
          <div className="daily-loading">Loading daily problems…</div>
        ) : error ? (
          <div className="daily-error-banner" role="alert">{error}</div>
        ) : (
          <div className="daily-grid">
            {items.map(({ tag, displayName, problem, error: tagError }) => (
              <ProblemCard
                key={tag}
                displayName={displayName}
                problem={problem}
                error={tagError}
                onRefresh={() => handleRefreshSingle(tag)}
                refreshing={refreshingTag === tag}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default DailyProblems;
