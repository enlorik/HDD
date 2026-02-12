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
    const challenges = (data || []).map(challenge => {
      // Calculate phase dates (mock placeholders if not provided by API)
      const submissionEnd = new Date(challenge.submissionEndDate);
      const reviewStart = challenge.reviewStartDate ? new Date(challenge.reviewStartDate) : submissionEnd;
      const appealsStart = challenge.appealsStartDate ? new Date(challenge.appealsStartDate) : 
        new Date(reviewStart.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days after review
      const completion = challenge.completionDate ? new Date(challenge.completionDate) : 
        new Date(appealsStart.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days after appeals
      
      return {
        id: challenge.id,
        name: challenge.name || 'Untitled Challenge',
        registrationEndDate: challenge.registrationEndDate,
        submissionEndDate: challenge.submissionEndDate,
        reviewStartDate: reviewStart.toISOString(),
        appealsStartDate: appealsStart.toISOString(),
        completionDate: completion.toISOString(),
        track: challenge.track || 'Unknown',
        type: challenge.type || 'Challenge',
        prizeSets: challenge.prizeSets || [],
        technologies: challenge.technologies || [],
        tags: challenge.tags || [],
        overview: challenge.overview,
        detailLink: `https://www.topcoder.com/challenges/${challenge.id}`
      };
    });
    
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
 * @returns {Array} Array of formatted events for timeline with phase information
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
      // Ensure review starts after submission ends (minimum 1 day buffer if not provided)
      const reviewStart = challenge.reviewStartDate 
        ? new Date(challenge.reviewStartDate)
        : new Date(submissionEnd.getTime() + 24 * 60 * 60 * 1000);
      const appealsStart = new Date(challenge.appealsStartDate || reviewStart.getTime() + 2 * 24 * 60 * 60 * 1000);
      const completion = new Date(challenge.completionDate || appealsStart.getTime() + 2 * 24 * 60 * 60 * 1000);
      
      // Use registration end date as start, completion date as end
      const startWeek = getWeekOffset(registrationEnd, referenceDate);
      const duration = getWeekDuration(registrationEnd, completion);
      
      // Calculate phase durations as percentages of total duration
      const totalDuration = completion - registrationEnd;
      
      // Validate totalDuration to prevent division by zero
      if (totalDuration <= 0) {
        console.warn(`Invalid date range for challenge ${challenge.id}: totalDuration=${totalDuration}`);
        return null; // Skip this challenge
      }
      
      const submissionDuration = Math.max(0, submissionEnd - registrationEnd);
      const reviewDuration = Math.max(0, appealsStart - submissionEnd);
      const appealsDuration = Math.max(0, completion - appealsStart);
      
      // Calculate percentages and normalize to ensure they sum to 100%
      let submissionPercent = (submissionDuration / totalDuration) * 100;
      let reviewPercent = (reviewDuration / totalDuration) * 100;
      let appealsPercent = (appealsDuration / totalDuration) * 100;
      
      // Calculate completion percent to ensure total is exactly 100%
      const calculatedTotal = submissionPercent + reviewPercent + appealsPercent;
      const completionPercent = 100 - calculatedTotal;
      
      // Determine current phase based on current date
      const now = new Date();
      let currentPhase = 'submission';
      if (now >= completion) {
        currentPhase = 'completed';
      } else if (now >= appealsStart) {
        currentPhase = 'appeals';
      } else if (now >= submissionEnd) {
        currentPhase = 'review';
      }
      
      // Determine gradient based on track
      let baseColors;
      switch (challenge.track) {
        case 'DEVELOP':
        case 'Dev':
          baseColors = { start: '#4a9eff', end: '#6bb5ff' }; // Blue
          break;
        case 'DESIGN':
        case 'Des':
          baseColors = { start: '#ff6b3d', end: '#ff8c5c' }; // Orange
          break;
        case 'DATA_SCIENCE':
        case 'DS':
          baseColors = { start: '#9c4aff', end: '#b56bff' }; // Purple
          break;
        case 'QA':
          baseColors = { start: '#4aff8c', end: '#6bffaa' }; // Green
          break;
        default:
          baseColors = { start: '#808080', end: '#a0a0a0' }; // Gray
      }

      return {
        id: `topcoder-${challenge.id}`,
        title: challenge.name,
        startWeek,
        duration,
        gradient: `linear-gradient(90deg, ${baseColors.start} 0%, ${baseColors.end} 100%)`,
        baseColors,
        phases: {
          submission: submissionPercent,
          review: reviewPercent,
          appeals: appealsPercent,
          completion: Math.max(0, completionPercent), // Ensure non-negative
          currentPhase
        },
        type: 'topcoder',
        detailLink: challenge.detailLink,
        registrationEndDate: challenge.registrationEndDate,
        submissionEndDate: challenge.submissionEndDate,
        reviewStartDate: challenge.reviewStartDate,
        appealsStartDate: challenge.appealsStartDate,
        completionDate: challenge.completionDate,
        track: challenge.track
      };
    })
    .filter(event => event !== null); // Filter out invalid challenges
}
