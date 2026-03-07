import { useState } from 'react';
import './Profile.css';

const STORAGE_KEY = 'hdd-user-profile';

function loadProfile() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function Profile() {
  const [timusUsername, setTimusUsername] = useState(() => loadProfile().timusUsername || '');
  const [timusJudgeId, setTimusJudgeId] = useState(() => loadProfile().timusJudgeId || '');
  const [codeforcesHandle, setCodeforcesHandle] = useState(() => loadProfile().codeforcesHandle || '');
  const [saved, setSaved] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    const profile = { timusUsername, timusJudgeId, codeforcesHandle };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      console.error('Failed to save profile to localStorage');
    }
  };

  return (
    <div className="profile-container">
      <div className="profile-content">
        <h1 className="profile-title">Profile Settings</h1>
        <p className="profile-subtitle">
          Configure your competitive programming usernames. These are stored locally in your browser.
        </p>

        <form className="profile-form" onSubmit={handleSave}>
          <section className="profile-section">
            <h2 className="profile-section-title">Timus Online Judge</h2>
            <div className="profile-field">
              <label className="profile-label" htmlFor="timus-username">
                Username
              </label>
              <input
                id="timus-username"
                className="profile-input"
                type="text"
                value={timusUsername}
                onChange={e => setTimusUsername(e.target.value)}
                placeholder="e.g. johndoe"
                autoComplete="off"
              />
              <p className="profile-hint">
                Your Timus display name (shown in rankings and standings).
              </p>
            </div>
            <div className="profile-field">
              <label className="profile-label" htmlFor="timus-judge-id">
                Judge ID
              </label>
              <input
                id="timus-judge-id"
                className="profile-input"
                type="text"
                inputMode="numeric"
                value={timusJudgeId}
                onChange={e => setTimusJudgeId(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 123456"
                autoComplete="off"
              />
              <p className="profile-hint">
                Your numeric Timus Judge ID. Used to pre-fill the submission page.
                Find it on your{' '}
                <a
                  href="https://acm.timus.ru/author.aspx"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="profile-link"
                >
                  Timus author page
                </a>.
              </p>
            </div>
          </section>

          <section className="profile-section">
            <h2 className="profile-section-title">Codeforces</h2>
            <div className="profile-field">
              <label className="profile-label" htmlFor="codeforces-handle">
                Handle
              </label>
              <input
                id="codeforces-handle"
                className="profile-input"
                type="text"
                value={codeforcesHandle}
                onChange={e => setCodeforcesHandle(e.target.value)}
                placeholder="e.g. tourist"
                autoComplete="off"
              />
              <p className="profile-hint">
                Your Codeforces handle.
              </p>
            </div>
          </section>

          <div className="profile-actions">
            <button type="submit" className="profile-save-btn">
              Save Profile
            </button>
            {saved && (
              <span className="profile-saved-msg">✓ Profile saved!</span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default Profile;
