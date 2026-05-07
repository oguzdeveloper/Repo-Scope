const axios = require('axios');
const config = require('../config');

const githubApi = axios.create({
  baseURL: 'https://api.github.com',
  headers: {
    Accept: 'application/vnd.github.v3+json',
    ...(config.GITHUB_TOKEN && { Authorization: `token ${config.GITHUB_TOKEN}` }),
  },
});

/**
 * Parse a GitHub URL into owner and repo components
 */
function parseGitHubUrl(url) {
  // Remove trailing slash
  url = url.replace(/\/$/, '');

  // Match patterns:
  // https://github.com/user
  // https://github.com/user/repo
  // github.com/user/repo
  const patterns = [
    /(?:https?:\/\/)?github\.com\/([^\/]+)\/([^\/]+)/,
    /(?:https?:\/\/)?github\.com\/([^\/]+)$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      if (match[2]) {
        return { type: 'repo', owner: match[1], repo: match[2].replace('.git', '') };
      }
      return { type: 'profile', owner: match[1] };
    }
  }

  return null;
}

/**
 * Fetch repository information
 */
async function getRepo(owner, repo) {
  const [repoData, languages, readme] = await Promise.all([
    githubApi.get(`/repos/${owner}/${repo}`),
    githubApi.get(`/repos/${owner}/${repo}/languages`).catch(() => ({ data: {} })),
    githubApi.get(`/repos/${owner}/${repo}/readme`).catch(() => null),
  ]);

  let readmeContent = '';
  if (readme && readme.data && readme.data.content) {
    readmeContent = Buffer.from(readme.data.content, 'base64').toString('utf-8');
    // Limit readme to first 3000 chars for AI context
    if (readmeContent.length > 3000) {
      readmeContent = readmeContent.substring(0, 3000) + '...';
    }
  }

  return {
    name: repoData.data.name,
    fullName: repoData.data.full_name,
    description: repoData.data.description || '',
    url: repoData.data.html_url,
    language: repoData.data.language,
    languages: Object.keys(languages.data),
    stars: repoData.data.stargazers_count,
    forks: repoData.data.forks_count,
    topics: repoData.data.topics || [],
    createdAt: repoData.data.created_at,
    updatedAt: repoData.data.updated_at,
    owner: repoData.data.owner.login,
    readme: readmeContent,
  };
}

/**
 * Fetch user profile and their top repositories
 */
async function getProfile(username) {
  const [userData, reposData] = await Promise.all([
    githubApi.get(`/users/${username}`),
    githubApi.get(`/users/${username}/repos?sort=stars&per_page=10`),
  ]);

  const repos = reposData.data.map((r) => ({
    name: r.name,
    description: r.description || '',
    language: r.language,
    stars: r.stargazers_count,
    forks: r.forks_count,
    topics: r.topics || [],
    url: r.html_url,
  }));

  return {
    username: userData.data.login,
    name: userData.data.name || userData.data.login,
    bio: userData.data.bio || '',
    publicRepos: userData.data.public_repos,
    followers: userData.data.followers,
    following: userData.data.following,
    url: userData.data.html_url,
    repos,
  };
}

module.exports = { parseGitHubUrl, getRepo, getProfile };
