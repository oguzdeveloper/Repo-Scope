const tr = require('./tr');
const en = require('./en');
const config = require('../config');
const fs = require('fs');

const languages = { tr, en };

function getLanguage() {
  try {
    if (fs.existsSync(config.CONFIG_FILE)) {
      const cfg = JSON.parse(fs.readFileSync(config.CONFIG_FILE, 'utf-8'));
      if (cfg.language) return cfg.language;
    }
  } catch (e) {}
  return config.LANGUAGE;
}

function setLanguage(lang) {
  let cfg = {};
  try {
    if (fs.existsSync(config.CONFIG_FILE)) {
      cfg = JSON.parse(fs.readFileSync(config.CONFIG_FILE, 'utf-8'));
    }
  } catch (e) {}
  cfg.language = lang;
  fs.writeFileSync(config.CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

function t() {
  const lang = getLanguage();
  return languages[lang] || languages['tr'];
}

module.exports = { t, getLanguage, setLanguage, languages };
