import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import Timeline from './components/Timeline'
import Bounty from './components/Bounty'
import TimusProblems from './components/TimusProblems'
import ProblemDetail from './components/ProblemDetail'
import Profile from './components/Profile'
import './App.css'

function Navigation() {
  const location = useLocation();
  
  return (
    <nav className="app-nav">
      <div className="app-nav-content">
        <div className="app-logo">HDD</div>
        <div className="app-nav-links">
          <Link 
            to="/" 
            className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
          >
            <span>Timeline</span>
          </Link>
          <Link 
            to="/bounty" 
            className={`nav-link ${location.pathname === '/bounty' ? 'active' : ''}`}
          >
            <span>Bounty</span>
          </Link>
          <Link 
            to="/timus" 
            className={`nav-link ${location.pathname === '/timus' ? 'active' : ''}`}
          >
            <span>Timus</span>
          </Link>
          <Link 
            to="/profile" 
            className={`nav-link ${location.pathname === '/profile' ? 'active' : ''}`}
          >
            <span>Profile</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}

function App() {
  return (
    <Router>
      <div className="app">
        <Navigation />
        <Routes>
          <Route path="/" element={<Timeline />} />
          <Route path="/bounty" element={<Bounty />} />
          <Route path="/timus" element={<TimusProblems />} />
          <Route path="/timus/:id" element={<ProblemDetail />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
