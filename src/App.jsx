import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import Timeline from './components/Timeline'
import Bounty from './components/Bounty'
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
            Timeline
          </Link>
          <Link 
            to="/bounty" 
            className={`nav-link ${location.pathname === '/bounty' ? 'active' : ''}`}
          >
            Bounty
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
        </Routes>
      </div>
    </Router>
  )
}

export default App
