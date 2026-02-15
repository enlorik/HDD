#!/usr/bin/env python3
"""
Railway Bounties Scraper

Scrapes template bounties from Railway Station (https://station.railway.com/bounties?bountyFilter=template)
and saves them to a JSON file for display on the bounty page.

Usage:
    python3 scripts/scrape_railway_bounties.py

Output:
    public/railway-bounties.json - JSON file containing scraped bounty data

Requirements:
    - requests
    - beautifulsoup4
"""

import json
import os
import sys
import time
from datetime import datetime
from typing import List, Dict, Optional
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Constants
RAILWAY_BOUNTIES_URL = "https://station.railway.com/bounties?bountyFilter=template"
OUTPUT_FILE = "public/railway-bounties.json"
MAX_RETRIES = 3
RETRY_DELAY = 5  # seconds

def fetch_with_retry(url: str, max_retries: int = MAX_RETRIES) -> Optional[str]:
    """
    Fetch URL content with retry logic.
    
    Args:
        url: URL to fetch
        max_retries: Maximum number of retry attempts
        
    Returns:
        HTML content as string or None if all retries fail
    """
    try:
        import requests
    except ImportError:
        logger.error("requests library not found. Install with: pip install requests")
        return None
        
    for attempt in range(max_retries):
        try:
            logger.info(f"Fetching {url} (attempt {attempt + 1}/{max_retries})")
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            
            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()
            
            logger.info(f"Successfully fetched {url}")
            return response.text
            
        except requests.exceptions.RequestException as e:
            logger.warning(f"Attempt {attempt + 1} failed: {e}")
            
            if attempt < max_retries - 1:
                logger.info(f"Retrying in {RETRY_DELAY} seconds...")
                time.sleep(RETRY_DELAY)
            else:
                logger.error(f"All {max_retries} attempts failed")
                return None
    
    return None

def parse_bounties(html_content: str) -> List[Dict]:
    """
    Parse HTML content to extract bounty information.
    
    Args:
        html_content: HTML content from Railway bounties page
        
    Returns:
        List of bounty dictionaries
    """
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        logger.error("beautifulsoup4 library not found. Install with: pip install beautifulsoup4")
        return []
    
    bounties = []
    
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Note: This is a placeholder parsing logic.
        # The actual selectors need to be updated based on the real HTML structure
        # of the Railway bounties page.
        
        # Try to find bounty cards/items
        # Common patterns: class names like 'bounty', 'card', 'bounty-card', etc.
        bounty_elements = soup.find_all(['div', 'article'], class_=lambda x: x and ('bounty' in x.lower() or 'card' in x.lower()))
        
        if not bounty_elements:
            # Try alternative selectors
            bounty_elements = soup.find_all(['div', 'article'])
        
        logger.info(f"Found {len(bounty_elements)} potential bounty elements")
        
        for idx, element in enumerate(bounty_elements):
            try:
                # Extract bounty information
                # These selectors are placeholders and need to be updated
                title_elem = element.find(['h1', 'h2', 'h3', 'h4'], class_=lambda x: x and 'title' in x.lower()) or element.find(['h1', 'h2', 'h3', 'h4'])
                desc_elem = element.find(['p', 'div'], class_=lambda x: x and 'description' in x.lower()) or element.find('p')
                reward_elem = element.find(class_=lambda x: x and 'reward' in x.lower())
                
                # Skip if we can't find basic information
                if not title_elem:
                    continue
                
                bounty = {
                    'id': f'railway-{idx + 1}-{int(time.time())}',
                    'title': title_elem.get_text(strip=True) if title_elem else 'Unknown Title',
                    'description': desc_elem.get_text(strip=True) if desc_elem else 'No description available',
                    'reward': reward_elem.get_text(strip=True) if reward_elem else 'TBD',
                    'status': 'UNSOLVED',
                    'difficulty': 'Medium',  # Default difficulty
                    'category': 'Railway Template Bounties',
                    'tags': ['Railway', 'Template'],
                    'source': 'Railway',
                    'url': RAILWAY_BOUNTIES_URL,
                    'scraped_at': datetime.now().isoformat()
                }
                
                bounties.append(bounty)
                logger.info(f"Parsed bounty: {bounty['title']}")
                
            except Exception as e:
                logger.warning(f"Failed to parse bounty element {idx}: {e}")
                continue
        
        logger.info(f"Successfully parsed {len(bounties)} bounties")
        
    except Exception as e:
        logger.error(f"Error parsing HTML content: {e}")
        return []
    
    return bounties

def load_existing_bounties(filepath: str) -> Dict:
    """
    Load existing bounties from JSON file.
    
    Args:
        filepath: Path to JSON file
        
    Returns:
        Dictionary with existing bounties data
    """
    if not os.path.exists(filepath):
        return {'bounties': [], 'last_updated': None}
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            logger.info(f"Loaded {len(data.get('bounties', []))} existing bounties")
            return data
    except Exception as e:
        logger.warning(f"Failed to load existing bounties: {e}")
        return {'bounties': [], 'last_updated': None}

def remove_duplicates(new_bounties: List[Dict], existing_bounties: List[Dict]) -> List[Dict]:
    """
    Remove duplicate bounties by comparing titles.
    
    Args:
        new_bounties: Newly scraped bounties
        existing_bounties: Previously saved bounties
        
    Returns:
        List of unique bounties (combining new and existing)
    """
    # Create a set of existing titles for quick lookup
    existing_titles = {b['title'].lower().strip() for b in existing_bounties}
    
    # Filter out duplicates from new bounties
    unique_new = [b for b in new_bounties if b['title'].lower().strip() not in existing_titles]
    
    logger.info(f"Found {len(unique_new)} new bounties (filtered {len(new_bounties) - len(unique_new)} duplicates)")
    
    # Combine existing and new unique bounties
    all_bounties = existing_bounties + unique_new
    
    return all_bounties

def save_bounties(bounties: List[Dict], filepath: str) -> bool:
    """
    Save bounties to JSON file.
    
    Args:
        bounties: List of bounty dictionaries
        filepath: Path to output JSON file
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Ensure directory exists
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        # Prepare data structure
        data = {
            'bounties': bounties,
            'last_updated': datetime.now().isoformat(),
            'count': len(bounties)
        }
        
        # Write to file
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Successfully saved {len(bounties)} bounties to {filepath}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to save bounties: {e}")
        return False

def main():
    """Main execution function."""
    logger.info("Starting Railway bounties scraper")
    logger.info(f"Target URL: {RAILWAY_BOUNTIES_URL}")
    logger.info(f"Output file: {OUTPUT_FILE}")
    
    # Fetch HTML content
    html_content = fetch_with_retry(RAILWAY_BOUNTIES_URL)
    
    if not html_content:
        logger.error("Failed to fetch bounties page")
        
        # Check if we have existing data to preserve
        existing_data = load_existing_bounties(OUTPUT_FILE)
        if existing_data['bounties']:
            logger.info(f"Preserving {len(existing_data['bounties'])} existing bounties")
            # Update timestamp to indicate attempted fetch
            existing_data['last_attempted'] = datetime.now().isoformat()
            with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
                json.dump(existing_data, f, indent=2, ensure_ascii=False)
        
        sys.exit(1)
    
    # Parse bounties
    new_bounties = parse_bounties(html_content)
    
    if not new_bounties:
        logger.warning("No bounties were parsed from the page")
        logger.info("This could mean:")
        logger.info("  1. The page structure has changed")
        logger.info("  2. There are no active template bounties")
        logger.info("  3. The HTML selectors need to be updated")
        
        # Preserve existing data if available
        existing_data = load_existing_bounties(OUTPUT_FILE)
        if existing_data['bounties']:
            logger.info(f"Preserving {len(existing_data['bounties'])} existing bounties")
            existing_data['last_attempted'] = datetime.now().isoformat()
            with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
                json.dump(existing_data, f, indent=2, ensure_ascii=False)
        
        sys.exit(0)
    
    # Load existing bounties
    existing_data = load_existing_bounties(OUTPUT_FILE)
    existing_bounties = existing_data.get('bounties', [])
    
    # Remove duplicates
    all_bounties = remove_duplicates(new_bounties, existing_bounties)
    
    # Save to file
    success = save_bounties(all_bounties, OUTPUT_FILE)
    
    if success:
        logger.info("Scraping completed successfully")
        logger.info(f"Total bounties: {len(all_bounties)}")
        sys.exit(0)
    else:
        logger.error("Failed to save bounties")
        sys.exit(1)

if __name__ == '__main__':
    main()
