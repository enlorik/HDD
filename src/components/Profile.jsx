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
  const [codeforcesHandle, setCodeforcesHandle] = useState(() => loadProfile().codeforcesHandle || '');
  const [saved, setSaved] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    const profile = { codeforcesHandle };
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
          Configure your Codeforces handle. It is stored locally in your browser and used to personalise daily problem recommendations.
        </p>

        <form className="profile-form" onSubmit={handleSave}>
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
