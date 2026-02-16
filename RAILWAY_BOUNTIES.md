# Railway Bounties Scraping Documentation

This document provides comprehensive information about the Railway bounties scraping feature implementation.

## Overview

The Railway bounties scraper automatically fetches template bounties from [Railway Station](https://station.railway.com/bounties?bountyFilter=template) and displays them on the HDD bounty page. The scraper runs daily via GitHub Actions and stores the scraped data in a JSON file.

## Architecture

### Components

1. **Python Scraper Script** (`scripts/scrape_railway_bounties.py`)
   - Fetches bounty data from Railway Station
   - Parses HTML to extract bounty information
   - Saves data to `public/railway-bounties.json`
   - Handles errors and prevents duplicates

2. **GitHub Actions Workflow** (`.github/workflows/update-railway-bounties.yml`)
   - Runs daily at midnight UTC
   - Can be manually triggered
   - Commits updates to the repository

3. **React Component Integration** (`src/components/Bounty.jsx`)
   - Loads Railway bounties from JSON file
   - Displays them in a separate section
   - Maintains existing hardcoded bounties

## File Structure

```
HDD/
├── scripts/
│   ├── scrape_railway_bounties.py    # Main scraper script
│   └── requirements.txt               # Python dependencies
├── .github/
│   └── workflows/
│       └── update-railway-bounties.yml  # Daily scraping workflow
├── public/
│   └── railway-bounties.json          # Scraped bounty data
└── src/
    └── components/
        ├── Bounty.jsx                 # Updated component
        └── Bounty.css                 # Updated styles
```

## Setup Instructions

### Local Setup

#### Prerequisites

- Python 3.7 or higher
- pip (Python package manager)
- Node.js and npm (for running the React app)

#### Installation

1. **Install Python dependencies:**

   ```bash
   cd scripts
   pip install -r requirements.txt
   ```

   Or install globally:
   
   ```bash
   pip install requests beautifulsoup4
   ```

2. **Run the scraper manually:**

   ```bash
   python3 scripts/scrape_railway_bounties.py
   ```

   This will:
   - Fetch bounties from Railway Station
   - Parse the HTML content
   - Save results to `public/railway-bounties.json`
   - Display logging information

3. **Verify the output:**

   ```bash
   cat public/railway-bounties.json
   ```

4. **Run the React app to see the results:**

   ```bash
   npm install
   npm run dev
   ```

   Visit `http://localhost:5173/bounty` to see the bounties.

### GitHub Actions Setup

The workflow is already configured and will run automatically. However, you need to ensure:

1. **Repository permissions:**
   - Go to Settings > Actions > General
   - Under "Workflow permissions", ensure "Read and write permissions" is selected
   - Check "Allow GitHub Actions to create and approve pull requests"

2. **Manual trigger:**
   - Go to Actions tab
   - Select "Update Railway Bounties"
   - Click "Run workflow"

## Scraper Details

### How It Works

1. **Fetching:**
   - Uses `requests` library with retry logic (3 attempts)
   - Includes proper User-Agent headers
   - 30-second timeout per request
   - 5-second delay between retries

2. **Parsing:**
   - Uses BeautifulSoup4 to parse HTML
   - Looks for common bounty element patterns
   - Extracts: title, description, reward, tags
   - Adds metadata: source, URL, timestamp

3. **Duplicate Prevention:**
   - Compares new bounties with existing ones by title
   - Preserves existing bounties
   - Only adds new unique bounties

4. **Error Handling:**
   - Gracefully handles network failures
   - Preserves existing data on failure
   - Logs all operations for debugging
   - Returns appropriate exit codes

### Data Format

The scraper outputs JSON in this format:

```json
{
  "bounties": [
    {
      "id": "railway-1-1234567890",
      "title": "Bounty Title",
      "description": "Bounty description text",
      "reward": "$500",
      "status": "UNSOLVED",
      "difficulty": "Medium",
      "category": "Railway Template Bounties",
      "tags": ["Railway", "Template"],
      "source": "Railway",
      "url": "https://station.railway.com/bounties?bountyFilter=template",
      "scraped_at": "2024-01-01T00:00:00.000000"
    }
  ],
  "last_updated": "2024-01-01T00:00:00.000000",
  "count": 1
}
```

## Extending the Scraper

### Updating HTML Selectors

If Railway changes their website structure, you'll need to update the parsing logic:

1. **Inspect the Railway bounties page:**
   - Open the page in a browser
   - Right-click and select "Inspect"
   - Find the HTML elements containing bounty information

2. **Update the parser in `scrape_railway_bounties.py`:**

   ```python
   def parse_bounties(html_content: str) -> List[Dict]:
       # ... existing code ...
       
       # Update these selectors based on the actual HTML structure
       bounty_elements = soup.find_all('div', class_='actual-bounty-class')
       
       for element in bounty_elements:
           title_elem = element.find('h2', class_='actual-title-class')
           desc_elem = element.find('p', class_='actual-description-class')
           reward_elem = element.find('span', class_='actual-reward-class')
           # ... extract data ...
   ```

3. **Test the changes:**
   
   ```bash
   python3 scripts/scrape_railway_bounties.py
   ```

### Adding New Fields

To add new data fields:

1. **Update the parser:**

   ```python
   bounty = {
       # ... existing fields ...
       'new_field': element.find('div', class_='new-field-class').get_text(strip=True),
   }
   ```

2. **Update the React component:**

   ```jsx
   <div className="bounty-new-field">
     {bounty.new_field}
   </div>
   ```

3. **Update the CSS if needed:**

   ```css
   .bounty-new-field {
     /* styles */
   }
   ```

### Changing Scraping Frequency

To change how often the scraper runs:

1. **Edit `.github/workflows/update-railway-bounties.yml`:**

   ```yaml
   schedule:
     # Examples:
     - cron: '0 */6 * * *'    # Every 6 hours
     - cron: '0 0,12 * * *'    # Twice daily (midnight and noon)
     - cron: '0 0 * * 0'       # Weekly on Sunday
   ```

2. **Cron syntax reference:**
   - `*` = any value
   - `*/n` = every n units
   - `0 0 * * *` = daily at midnight UTC
   - [Crontab Guru](https://crontab.guru/) for help

## Viewing Results

### On the Website

1. **Start the development server:**

   ```bash
   npm run dev
   ```

2. **Navigate to the bounty page:**
   - Open `http://localhost:5173/bounty`
   - Railway bounties appear in a separate section at the top
   - Existing hardcoded bounties appear below

### In the JSON File

View the raw data:

```bash
cat public/railway-bounties.json
```

Or use a JSON formatter:

```bash
python -m json.tool public/railway-bounties.json
```

### GitHub Actions Logs

1. Go to the Actions tab in your repository
2. Select a workflow run
3. Click on the job to see detailed logs
4. Review the scraper output and any errors

## Troubleshooting

### Common Issues

#### 1. No bounties scraped

**Symptoms:** JSON file shows empty bounties array

**Solutions:**
- Check if the Railway website structure has changed
- Inspect the HTML selectors in the parser
- Review the scraper logs for parsing errors
- Test manually with: `python3 scripts/scrape_railway_bounties.py`

#### 2. Network errors

**Symptoms:** "Failed to fetch" errors in logs

**Solutions:**
- Check internet connectivity
- Verify the Railway website is accessible
- The scraper will preserve existing data on failure
- Wait for the next scheduled run

#### 3. Workflow not running

**Symptoms:** No automatic updates

**Solutions:**
- Verify workflow file is in `.github/workflows/`
- Check repository permissions (Settings > Actions)
- Ensure the repository is not archived
- Try manual trigger from Actions tab

#### 4. Changes not committed

**Symptoms:** Scraper runs but no commit appears

**Solutions:**
- Verify "Workflow permissions" include write access
- Check if there were actual changes to commit
- Review the "Check for changes" step in workflow logs

#### 5. Module not found errors

**Symptoms:** Import errors when running the script

**Solutions:**
```bash
pip install requests beautifulsoup4
# Or use the requirements file
pip install -r scripts/requirements.txt
```

### Debug Mode

Run the scraper with verbose logging:

```bash
python3 scripts/scrape_railway_bounties.py 2>&1 | tee scraper.log
```

This saves all output to `scraper.log` for analysis.

## Security Considerations

1. **No credentials required:** The scraper accesses public data only
2. **Rate limiting:** Built-in retry delays prevent overwhelming the server
3. **Safe HTML parsing:** BeautifulSoup sanitizes input
4. **No sensitive data:** All scraped data is public information

## Performance

- **Execution time:** Typically 2-5 seconds
- **Data size:** Minimal (a few KB per run)
- **GitHub Actions:** Uses ~1 minute of workflow time per run
- **Impact on site:** Minimal (one request per day)

## Maintenance

### Regular Tasks

1. **Monitor workflow runs:**
   - Check Actions tab weekly
   - Review any failed runs
   - Update selectors if parsing fails

2. **Update dependencies:**
   ```bash
   pip list --outdated
   pip install --upgrade requests beautifulsoup4
   ```

3. **Review bounty data:**
   - Check for duplicate entries
   - Verify data quality
   - Remove stale bounties if needed

### Best Practices

1. Always test scraper changes locally before committing
2. Keep the scraper simple and maintainable
3. Document any selector changes
4. Monitor for Railway website updates
5. Preserve backward compatibility in data format

## Future Enhancements

Potential improvements:

1. **Enhanced parsing:**
   - Extract more metadata (deadlines, requirements)
   - Support multiple bounty types
   - Add difficulty detection

2. **Better error handling:**
   - Email notifications on failures
   - Retry with exponential backoff
   - Fallback to cached data

3. **UI improvements:**
   - Filter by category/difficulty
   - Sort by reward/date
   - Search functionality
   - Direct links to Railway bounties

4. **Analytics:**
   - Track bounty trends
   - Monitor completion rates
   - Generate statistics

## Support

For issues or questions:

1. Check this documentation
2. Review scraper logs
3. Inspect the Railway website structure
4. Open an issue in the repository

## License

This scraper is part of the HDD project. All rights reserved.
