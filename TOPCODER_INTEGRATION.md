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

### 2. Visual Representation with Phase Segments
Challenges are displayed as colored event bars in the timeline with **four distinct phase segments**:

#### Track-Specific Base Colors:
- **Development**: Blue gradient (`#4a9eff` to `#6bb5ff`)
- **Design**: Orange gradient (`#ff6b3d` to `#ff8c5c`)
- **Data Science**: Purple gradient (`#9c4aff` to `#b56bff`)
- **QA**: Green gradient (`#4aff8c` to `#6bffaa`)

#### Contest Phases (shown as gradient segments):
Each Topcoder challenge bar is divided into four visual segments representing the contest lifecycle:

1. **Submission Phase** (Full opacity - 100%)
   - Registration through submission deadline
   - Most vibrant color intensity

2. **Review Phase** (80% opacity)
   - Starts after submission deadline
   - Slightly reduced intensity to differentiate from submission
   - 2-day default duration if API doesn't provide review dates

3. **Appeals Phase** (60% opacity)
   - Starts after review completion
   - Further reduced intensity
   - 2-day default duration if API doesn't provide appeals dates

4. **Completion Phase** (40% opacity)
   - Final phase after appeals
   - Most subdued color to indicate contest ending
   - Calculated based on completion date from API

#### Visual Indicators:
- **Phase borders**: 2px dark borders separate each phase segment
- **Active phase highlighting**: The current phase has an enhanced glow effect (3px colored border)
- **Phase legend**: A color-coded legend appears above the timeline showing all phases
- **Enhanced tooltips**: Hover over any Topcoder challenge to see its current phase

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
   - Returns formatted challenge objects with phase dates
   - Calculates mock phase dates when API doesn't provide them

2. **`formatChallengesForTimeline()`**
   - Converts challenge data to timeline event format
   - Calculates week offsets and durations for entire contest
   - Assigns track-specific color gradients
   - **Calculates phase percentages** for visual segmentation
   - **Determines current phase** based on current date
   - Returns events with phase data for rendering

### Mock Data (`src/services/mockTopcoderData.js`)
Contains sample challenges for:
- Development (React Dashboard)
- Design (Mobile App UI)
- Data Science (ML Model)

Each mock challenge includes **complete phase information**:
- `registrationEndDate`: When registration closes
- `submissionEndDate`: When submissions are due
- `reviewStartDate`: When review phase begins
- `appealsStartDate`: When appeals phase begins  
- `completionDate`: When the contest fully completes

Used for testing and when the API is unavailable.

### Timeline Component (`src/components/Timeline.jsx`)
- Fetches challenges on component mount
- Combines with hardcoded events
- **Renders phase-segmented bars** for Topcoder challenges
- **Displays phase legend** above the timeline
- Handles click events to open challenge details
- Shows enhanced tooltips with current phase information

#### Phase Visualization CSS (`src/components/Timeline.css`)
- `.event-bar-phased`: Container for multi-segment event bars
- `.phase-segment`: Individual phase segment styling with borders
- `.phase-active`: Highlights the current active phase
- `.phase-legend`: Legend component showing phase color indicators

## Using Mock Data

To use mock data instead of the live API (useful for development and testing phase visualization):

1. Open `src/services/topcoderService.js`
2. Change `USE_MOCK_DATA` constant to `true`:
   ```javascript
   const USE_MOCK_DATA = true; // Set to true to use mock data instead of API
   ```
3. The application will now use mock data without making API calls

### Testing Phase Visualization with Mock Data

The mock data in `mockTopcoderData.js` includes three challenges with complete phase information:

1. **Build a React Dashboard** (Dev track - Blue)
   - 2-week duration with phases spanning ~3 weeks total
   
2. **Design Mobile App UI** (Design track - Orange)
   - 1-week duration with phases spanning ~2 weeks total
   
3. **ML Model for Prediction** (Data Science track - Purple)
   - 3-week duration with phases spanning ~4 weeks total

Each challenge demonstrates:
- Four distinct phase segments with varying opacity
- Borders separating each phase
- Current phase highlighting
- Accurate tooltip information

To see different phase states, adjust the date calculations in `mockTopcoderData.js` relative to `Date.now()`.

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

### Phase Date Handling

**Note**: The Topcoder API v5 does not provide explicit `reviewStartDate`, `appealsStartDate`, or `completionDate` fields. The application handles this by:

1. **From API data**: Uses `registrationEndDate` and `submissionEndDate` when available
2. **Mock placeholders**: Automatically calculates phase dates:
   - `reviewStartDate` = `submissionEndDate`
   - `appealsStartDate` = `reviewStartDate` + 2 days
   - `completionDate` = `appealsStartDate` + 2 days

These default durations provide reasonable phase visualizations until the API provides more detailed phase information. You can adjust the default phase durations in `topcoderService.js` if needed.

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
- Implement server-side caching with periodic updates
- Add user preferences for which tracks to display
- Display prize amounts on timeline bars
- **Fetch actual phase dates if Topcoder API adds these fields in the future**
- Add phase duration customization in UI settings
- Show phase progress percentage within each segment
