/**
 * Service for fetching active Topcoder challenges
 */

import { mockTopcoderChallenges } from './mockTopcoderData';

const TOPCODER_API_URL = 'https://api.topcoder.com/v5/challenges';
const USE_MOCK_DATA = false; // Set to true to use mock data instead of API

/**
 * Fetch active Topcoder challenges from the API
 * @returns {Promise<Array>} Array of challenge objects
 */
export async function fetchTopcoderChallenges() {
  // Use mock data if configured or if in development mode
  if (USE_MOCK_DATA) {
    console.log('Using mock Topcoder data');
    return Promise.resolve(mockTopcoderChallenges);
  }

  try {
    const params = new URLSearchParams({
      status: 'ACTIVE',
      'tracks[DS]': 'true',
      'tracks[Des]': 'true',
      'tracks[Dev]': 'true',
      'tracks[QA]': 'true'
    });

    const response = await fetch(`${TOPCODER_API_URL}?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Extract and format relevant challenge data
    const challenges = (data || []).map(challenge => ({
      id: challenge.id,
      name: challenge.name || 'Untitled Challenge',
      registrationEndDate: challenge.registrationEndDate,
      submissionEndDate: challenge.submissionEndDate,
      track: challenge.track || 'Unknown',
      type: challenge.type || 'Challenge',
      prizeSets: challenge.prizeSets || [],
      technologies: challenge.technologies || [],
      tags: challenge.tags || [],
      overview: challenge.overview,
      detailLink: `https://www.topcoder.com/challenges/${challenge.id}`
    }));
    
    return challenges;
  } catch (error) {
    console.error('Error fetching Topcoder challenges:', error);
    // Fall back to mock data on error (useful for development/testing)
    console.log('Falling back to mock Topcoder data');
    return mockTopcoderChallenges;
  }
}

/**
 * Format Topcoder challenges for timeline display
 * @param {Array} challenges - Array of challenge objects
 * @param {Date} referenceDate - Reference date for calculating week offsets
 * @returns {Array} Array of formatted events for timeline
 */
export function formatChallengesForTimeline(challenges, referenceDate = new Date()) {
  const getWeekOffset = (targetDate, refDate) => {
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const diff = targetDate - refDate;
    return Math.floor(diff / msPerWeek);
  };

  const getWeekDuration = (startDate, endDate) => {
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const diff = endDate - startDate;
    return Math.max(1, Math.ceil(diff / msPerWeek));
  };

  return challenges
    .filter(challenge => challenge.submissionEndDate)
    .map(challenge => {
      const registrationEnd = new Date(challenge.registrationEndDate);
      const submissionEnd = new Date(challenge.submissionEndDate);
      
      // Use registration end date as start, submission end date as end
      const startWeek = getWeekOffset(registrationEnd, referenceDate);
      const duration = getWeekDuration(registrationEnd, submissionEnd);
      
      // Determine gradient based on track
      let gradient;
      switch (challenge.track) {
        case 'DEVELOP':
        case 'Dev':
          gradient = 'linear-gradient(90deg, #4a9eff 0%, #6bb5ff 100%)'; // Blue
          break;
        case 'DESIGN':
        case 'Des':
          gradient = 'linear-gradient(90deg, #ff6b3d 0%, #ff8c5c 100%)'; // Orange
          break;
        case 'DATA_SCIENCE':
        case 'DS':
          gradient = 'linear-gradient(90deg, #9c4aff 0%, #b56bff 100%)'; // Purple
          break;
        case 'QA':
          gradient = 'linear-gradient(90deg, #4aff8c 0%, #6bffaa 100%)'; // Green
          break;
        default:
          gradient = 'linear-gradient(90deg, #808080 0%, #a0a0a0 100%)'; // Gray
      }

      return {
        id: `topcoder-${challenge.id}`,
        title: challenge.name,
        startWeek,
        duration,
        gradient,
        type: 'topcoder',
        detailLink: challenge.detailLink,
        registrationEndDate: challenge.registrationEndDate,
        submissionEndDate: challenge.submissionEndDate,
        track: challenge.track
      };
    });
}
