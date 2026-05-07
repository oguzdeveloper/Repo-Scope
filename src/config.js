const path = require('path');
const fs = require('fs');

// Load .env file
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DATA_DIR = path.join(__dirname, '..', 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

module.exports = {
  FIREWORKS_API_KEY: process.env.FIREWORKS_API_KEY || '',
  FIREWORKS_BASE_URL: 'https://api.fireworks.ai/inference/v1',
  FIREWORKS_MODEL: 'accounts/fireworks/models/deepseek-v4-pro',
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
  LANGUAGE: process.env.LANGUAGE || 'tr',
  DATA_DIR,
  STORAGE_FILE: path.join(DATA_DIR, 'projects.json'),
  CONFIG_FILE: path.join(DATA_DIR, 'config.json'),
};
