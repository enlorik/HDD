/**
 * Service for fetching active Topcoder challenges
 */

import { mockTopcoderChallenges } from './mockTopcoderData';

const TOPCODER_API_URL = 'https://api.topcoder.com/v5/challenges';
const USE_MOCK_DATA = false; // Set to true to use mock data instead of API

// Track values supported by the Topcoder v5 API
const TRACKS = ['DEVELOP', 'DESIGN', 'DATA_SCIENCE', 'QA'];

/**
 * Fetch active Topcoder challenges from the API
 * Performs one request per track and merges/deduplicates the results.
 * @returns {Promise<Array>} Array of challenge objects
 */
export async function fetchTopcoderChallenges() {
  // Use mock data if configured
  if (USE_MOCK_DATA) {
    console.log('Using mock Topcoder data');
    return Promise.resolve(mockTopcoderChallenges);
  }

  try {
    // Fetch one page per track; the v5 API requires a single track= value per request
    const requests = TRACKS.map(track => {
      const params = new URLSearchParams({
        status: 'Active',
        track,
        perPage: '100'
      });
      return fetch(`${TOPCODER_API_URL}?${params.toString()}`);
    });

    const responses = await Promise.all(requests);

    for (const response of responses) {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    }

    const dataArrays = await Promise.all(responses.map(r => r.json()));

    if (import.meta.env.DEV) {
      dataArrays.forEach((data, i) => {
        console.log(`[Topcoder] Track ${TRACKS[i]}: ${(data || []).length} challenges`);
      });
    }

    // Merge all results and deduplicate by id
    const seen = new Set();
    const merged = [];
    for (const data of dataArrays) {
      for (const challenge of (data || [])) {
        if (!seen.has(challenge.id)) {
          seen.add(challenge.id);
          merged.push(challenge);
        }
      }
    }

    if (import.meta.env.DEV) {
      console.log(`[Topcoder] Total unique challenges: ${merged.length}`);
    }

    // Extract and format relevant challenge data
    const challenges = merged.map(challenge => {
      const submissionEnd = challenge.submissionEndDate ? new Date(challenge.submissionEndDate) : new Date();
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
    if (import.meta.env.DEV) {
      // In development fall back to mock data so the UI remains usable
      console.log('Falling back to mock Topcoder data (DEV mode)');
      return mockTopcoderChallenges;
    }
    // In production re-throw so the UI can display a proper error state
    throw error;
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
      const appealsStart = challenge.appealsStartDate 
        ? new Date(challenge.appealsStartDate)
        : new Date(reviewStart.getTime() + 2 * 24 * 60 * 60 * 1000);
      const completion = challenge.completionDate 
        ? new Date(challenge.completionDate)
        : new Date(appealsStart.getTime() + 2 * 24 * 60 * 60 * 1000);
      
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
      
      // Determine gradient based on track with distinct colors for smooth phase transitions
      let baseColors;
      switch (challenge.track) {
        case 'DEVELOP':
        case 'Dev':
          baseColors = { 
            start: '#4a9eff',  // Blue start
            mid: '#5ca9ff',    // Blue mid
            end: '#6bb5ff'     // Blue end
          };
          break;
        case 'DESIGN':
        case 'Des':
          baseColors = { 
            start: '#ff6b3d',  // Orange start
            mid: '#ff7a4d',    // Orange mid
            end: '#ff8c5c'     // Orange end
          };
          break;
        case 'DATA_SCIENCE':
        case 'DS':
          baseColors = { 
            start: '#9c4aff',  // Purple start
            mid: '#a75aff',    // Purple mid
            end: '#b56bff'     // Purple end
          };
          break;
        case 'QA':
          baseColors = { 
            start: '#4aff8c',  // Green start
            mid: '#5aff9b',    // Green mid
            end: '#6bffaa'     // Green end
          };
          break;
        default:
          baseColors = { 
            start: '#808080',  // Gray start
            mid: '#909090',    // Gray mid
            end: '#a0a0a0'     // Gray end
          };
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
