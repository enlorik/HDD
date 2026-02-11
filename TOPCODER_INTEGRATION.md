# Topcoder Integration Guide

This document provides details on how the Topcoder challenges are integrated into the HDD timeline calendar.

## Overview

The HDD application now fetches and displays active Topcoder challenges from the Topcoder API v5 alongside existing hardcoded events in the timeline view.

## Features

### 1. Automatic Challenge Fetching
- Challenges are fetched automatically when the Timeline component loads
- API endpoint: `https://api.topcoder.com/v5/challenges`
- Filters: Active challenges across Dev, Design, Data Science, and QA tracks
- Refresh interval: Daily via GitHub Actions workflow

### 2. Visual Representation
Challenges are displayed as colored event bars in the timeline:
- **Development**: Blue gradient (`#4a9eff` to `#6bb5ff`)
- **Design**: Orange gradient (`#ff6b3d` to `#ff8c5c`)
- **Data Science**: Purple gradient (`#9c4aff` to `#b56bff`)
- **QA**: Green gradient (`#4aff8c` to `#6bffaa`)

### 3. Interactive Elements
- Click any challenge bar to open the challenge details on Topcoder.com
- Hover over bars to see challenge name and track
- All external links open securely with `noopener` and `noreferrer` flags

### 4. Resilient Architecture
- **Fallback mechanism**: When the API is unavailable, the app uses mock data
- **Error handling**: Failed API calls are logged but don't break the UI
- **Loading states**: Shows loading indicator while fetching challenges

## Technical Details

### Service Layer (`src/services/topcoderService.js`)
The service provides two main functions:

1. **`fetchTopcoderChallenges()`**
   - Fetches active challenges from Topcoder API
   - Automatically falls back to mock data on error
   - Returns formatted challenge objects

2. **`formatChallengesForTimeline()`**
   - Converts challenge data to timeline event format
   - Calculates week offsets and durations
   - Assigns track-specific color gradients

### Mock Data (`src/services/mockTopcoderData.js`)
Contains sample challenges for:
- Development (React Dashboard)
- Design (Mobile App UI)
- Data Science (ML Model)

Used for testing and when the API is unavailable.

### Timeline Component (`src/components/Timeline.jsx`)
- Fetches challenges on component mount
- Combines with hardcoded events
- Renders both as timeline bars
- Handles click events to open challenge details

## Using Mock Data

To use mock data instead of the live API (useful for development):

1. Open `src/services/topcoderService.js`
2. Change `USE_MOCK_DATA` constant to `true`:
   ```javascript
   const USE_MOCK_DATA = true; // Set to true to use mock data instead of API
   ```
3. The application will now use mock data without making API calls

## Automated Updates

### GitHub Actions Workflow
Location: `.github/workflows/update-topcoder.yml`

**Schedule**: Daily at midnight UTC (00:00)

**Manual Trigger**: Can be triggered manually from the Actions tab

**What it does**:
1. Checks out the repository
2. Sets up Node.js 20 LTS
3. Installs dependencies
4. Builds the application
5. Verifies the integration works

**Permissions**: Minimal (`contents: read`)

## API Response Format

The Topcoder API returns challenge objects with the following structure:
```json
{
  "id": "challenge-id",
  "name": "Challenge Name",
  "registrationEndDate": "2024-01-15T00:00:00.000Z",
  "submissionEndDate": "2024-01-22T00:00:00.000Z",
  "track": "DEVELOP",
  "type": "Code Challenge",
  "prizeSets": [...],
  "technologies": [...],
  "tags": [...]
}
```

## Customization

### Adding New Tracks
To support additional Topcoder tracks:

1. Update the API query parameters in `fetchTopcoderChallenges()`
2. Add a new gradient color in `formatChallengesForTimeline()`
3. Update the README documentation

### Changing Update Frequency
To change how often challenges are refreshed:

1. Edit `.github/workflows/update-topcoder.yml`
2. Modify the cron schedule:
   ```yaml
   schedule:
     - cron: '0 */6 * * *'  # Every 6 hours
   ```

## Troubleshooting

### Challenges Not Appearing
1. Check browser console for API errors
2. Verify the API endpoint is accessible
3. Mock data should appear as fallback if API fails

### Incorrect Colors
- Verify the `track` field in API response matches expected values
- Check `formatChallengesForTimeline()` for track name mappings

### Links Not Working
- Ensure challenge objects have valid `id` fields
- Check that detail links are being generated correctly

## Security Considerations

1. **External Links**: All links use `noopener,noreferrer` to prevent security vulnerabilities
2. **API Calls**: Made client-side with no authentication required
3. **Workflow Permissions**: GitHub Actions uses minimal required permissions
4. **No Secrets**: Integration doesn't require or store any API keys

## Future Enhancements

Potential improvements for the Topcoder integration:

- Cache challenge data in localStorage for better performance
- Add filtering by track or prize amount
- Show more detailed information in tooltips
- Implement server-side caching with periodic updates
- Add user preferences for which tracks to display
- Display prize amounts on timeline bars
