const axios = require('axios');
const config = require('../config');
const { getLanguage } = require('../i18n');

const fireworksApi = axios.create({
  baseURL: config.FIREWORKS_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.FIREWORKS_API_KEY}`,
  },
});

/**
 * Send a chat completion request to Fireworks AI
 */
async function chat(messages) {
  const response = await fireworksApi.post('/chat/completions', {
    model: config.FIREWORKS_MODEL,
    messages,
    max_tokens: 2048,
    temperature: 0.7,
  });

  return response.data.choices[0].message.content;
}

/**
 * Analyze a repository and provide a detailed explanation
 */
async function analyzeRepo(repoData) {
  const lang = getLanguage();
  const langInstruction = lang === 'tr'
    ? 'Yanıtını Türkçe olarak ver.'
    : 'Respond in English.';

  const messages = [
    {
      role: 'system',
      content: `You are RepoScope, an expert GitHub project analyzer. You analyze repositories and provide clear, insightful explanations about what the project does, its tech stack, architecture, and potential use cases. ${langInstruction}`,
    },
    {
      role: 'user',
      content: `Analyze this GitHub repository and provide a comprehensive explanation:

Repository: ${repoData.fullName}
Description: ${repoData.description}
Main Language: ${repoData.language}
All Languages: ${repoData.languages.join(', ')}
Stars: ${repoData.stars} | Forks: ${repoData.forks}
Topics: ${repoData.topics.join(', ')}
Created: ${repoData.createdAt}
Last Updated: ${repoData.updatedAt}

README (excerpt):
${repoData.readme}

Please provide:
1. What this project does (brief summary)
2. Tech stack and architecture
3. Key features
4. Who would use this and why
5. Project quality assessment (based on stars, activity, documentation)`,
    },
  ];

  return chat(messages);
}

/**
 * Analyze a user profile
 */
async function analyzeProfile(profileData) {
  const lang = getLanguage();
  const langInstruction = lang === 'tr'
    ? 'Yanıtını Türkçe olarak ver.'
    : 'Respond in English.';

  const repoSummary = profileData.repos
    .map((r) => `- ${r.name}: ${r.description} [${r.language}] ⭐${r.stars}`)
    .join('\n');

  const messages = [
    {
      role: 'system',
      content: `You are RepoScope, an expert GitHub profile analyzer. You analyze developer profiles and provide insights about their expertise, interests, and notable projects. ${langInstruction}`,
    },
    {
      role: 'user',
      content: `Analyze this GitHub profile:

Username: ${profileData.username}
Name: ${profileData.name}
Bio: ${profileData.bio}
Public Repos: ${profileData.publicRepos}
Followers: ${profileData.followers} | Following: ${profileData.following}

Top Repositories:
${repoSummary}

Please provide:
1. Developer's main expertise areas
2. Key projects and their significance
3. Technology preferences
4. Overall profile assessment`,
    },
  ];

  return chat(messages);
}

/**
 * Suggest projects based on saved projects and user query
 */
async function suggestProjects(savedProjects, userQuery) {
  const lang = getLanguage();
  const langInstruction = lang === 'tr'
    ? 'Yanıtını Türkçe olarak ver.'
    : 'Respond in English.';

  const projectSummary = savedProjects
    .map((p) => `- ${p.name} (${p.field}): ${p.description} [${p.languages.join(', ')}] ⭐${p.stars}`)
    .join('\n');

  const queryPart = userQuery
    ? `\nUser is specifically looking for: ${userQuery}`
    : '';

  const messages = [
    {
      role: 'system',
      content: `You are RepoScope, a project recommendation expert. Based on a user's saved projects, you identify their interests and suggest similar or complementary open-source projects they might find useful. Suggest real, existing GitHub projects with their URLs. ${langInstruction}`,
    },
    {
      role: 'user',
      content: `Based on my saved projects, suggest 5 similar or related open-source projects I might be interested in.

My saved projects:
${projectSummary}
${queryPart}

For each suggestion provide:
1. Project name and GitHub URL
2. What it does
3. Why it matches my interests
4. Tech stack`,
    },
  ];

  return chat(messages);
}

module.exports = { analyzeRepo, analyzeProfile, suggestProjects };
