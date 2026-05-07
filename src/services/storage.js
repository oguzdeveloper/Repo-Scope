const fs = require('fs');
const config = require('../config');

function loadProjects() {
  try {
    if (fs.existsSync(config.STORAGE_FILE)) {
      const data = fs.readFileSync(config.STORAGE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {}
  return [];
}

function saveProjects(projects) {
  fs.writeFileSync(config.STORAGE_FILE, JSON.stringify(projects, null, 2));
}

function addProject(project) {
  const projects = loadProjects();
  // Check if already exists
  const exists = projects.find((p) => p.url === project.url);
  if (exists) return false;
  projects.push({
    ...project,
    savedAt: new Date().toISOString(),
  });
  saveProjects(projects);
  return true;
}

function removeProject(url) {
  const projects = loadProjects();
  const filtered = projects.filter((p) => p.url !== url);
  if (filtered.length === projects.length) return false;
  saveProjects(filtered);
  return true;
}

function getProjects() {
  return loadProjects();
}

module.exports = { addProject, removeProject, getProjects };
