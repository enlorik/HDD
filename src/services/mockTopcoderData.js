/**
 * Mock Topcoder challenges data for testing and development
 * Includes all four contest phases: registration/submission, review, appeals, and completion
 */

export const mockTopcoderChallenges = [
  {
    id: 'tc-12345',
    name: 'Build a React Dashboard',
    registrationEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week from now
    submissionEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 2 weeks from now
    // Phase dates for timeline visualization (with 1-day buffer between phases)
    reviewStartDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), // Review starts 1 day after submission
    appealsStartDate: new Date(Date.now() + 17 * 24 * 60 * 60 * 1000).toISOString(), // Appeals start 2 days after review
    completionDate: new Date(Date.now() + 19 * 24 * 60 * 60 * 1000).toISOString(), // Contest ends 2 days after appeals
    track: 'Dev',
    type: 'Code Challenge',
    prizeSets: [{ prizes: [{ value: 1000 }] }],
    technologies: ['React', 'JavaScript', 'CSS'],
    tags: ['Frontend', 'UI'],
    overview: 'Build an interactive dashboard using React',
    detailLink: 'https://www.topcoder.com/challenges/tc-12345'
  },
  {
    id: 'tc-12346',
    name: 'Design Mobile App UI',
    registrationEndDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
    submissionEndDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days from now
    // Phase dates for timeline visualization (with 1-day buffer between phases)
    reviewStartDate: new Date(Date.now() + 11 * 24 * 60 * 60 * 1000).toISOString(), // Review starts 1 day after submission
    appealsStartDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(), // Appeals start 1 day after review
    completionDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // Contest ends 2 days after appeals
    track: 'Des',
    type: 'Design Challenge',
    prizeSets: [{ prizes: [{ value: 800 }] }],
    technologies: ['Figma', 'UI/UX'],
    tags: ['Design', 'Mobile'],
    overview: 'Create a modern mobile app interface design',
    detailLink: 'https://www.topcoder.com/challenges/tc-12346'
  },
  {
    id: 'tc-12347',
    name: 'ML Model for Prediction',
    registrationEndDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
    submissionEndDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(), // 3 weeks from now
    // Phase dates for timeline visualization (with 1-day buffer between phases)
    reviewStartDate: new Date(Date.now() + 22 * 24 * 60 * 60 * 1000).toISOString(), // Review starts 1 day after submission
    appealsStartDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(), // Appeals start 3 days after review
    completionDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(), // Contest ends 3 days after appeals
    track: 'DS',
    type: 'Algorithm Challenge',
    prizeSets: [{ prizes: [{ value: 1500 }] }],
    technologies: ['Python', 'TensorFlow', 'Machine Learning'],
    tags: ['Data Science', 'AI'],
    overview: 'Develop a machine learning model for predictive analytics',
    detailLink: 'https://www.topcoder.com/challenges/tc-12347'
  }
];
