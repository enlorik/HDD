/**
 * Mock Topcoder challenges data for testing and development
 */

export const mockTopcoderChallenges = [
  {
    id: 'tc-12345',
    name: 'Build a React Dashboard',
    registrationEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week from now
    submissionEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 2 weeks from now
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
    track: 'DS',
    type: 'Algorithm Challenge',
    prizeSets: [{ prizes: [{ value: 1500 }] }],
    technologies: ['Python', 'TensorFlow', 'Machine Learning'],
    tags: ['Data Science', 'AI'],
    overview: 'Develop a machine learning model for predictive analytics',
    detailLink: 'https://www.topcoder.com/challenges/tc-12347'
  }
];
