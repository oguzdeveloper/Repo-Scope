#!/usr/bin/env node

const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const { t, setLanguage, getLanguage, languages } = require('./i18n');
const { parseGitHubUrl, getRepo, getProfile } = require('./services/github');
const { analyzeRepo, analyzeProfile, suggestProjects } = require('./services/ai');
const { addProject, removeProject, getProjects } = require('./services/storage');
const config = require('./config');

// ═══════════════════════════════════════════
// UI Helpers
// ═══════════════════════════════════════════
function showHeader() {
  console.clear();
  console.log('');
  console.log(chalk.cyan.bold('  ╔══════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('  ║') + chalk.white.bold('  🔭 RepoScope                           ') + chalk.cyan.bold('║'));
  console.log(chalk.cyan.bold('  ║') + chalk.gray('  GitHub Proje Analiz & Öneri Aracı      ') + chalk.cyan.bold('║'));
  console.log(chalk.cyan.bold('  ╚══════════════════════════════════════════╝'));
  console.log('');
}

function divider() {
  console.log(chalk.cyan('  ──────────────────────────────────────────'));
}

// ═══════════════════════════════════════════
// Main Menu
// ═══════════════════════════════════════════
async function mainMenu() {
  showHeader();
  const i18n = t();

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: i18n.messages.whatToDo || 'Ne yapmak istiyorsunuz?',
      choices: [
        { name: `🔍  ${i18n.commands.analyze}`, value: 'analyze' },
        { name: `💾  ${i18n.commands.save}`, value: 'save' },
        { name: `📋  ${i18n.commands.list}`, value: 'list' },
        { name: `💡  ${i18n.commands.suggest}`, value: 'suggest' },
        { name: `🗑️   ${i18n.commands.remove}`, value: 'remove' },
        { name: `🌐  ${i18n.commands.lang}`, value: 'lang' },
        new inquirer.Separator(),
        { name: `❌  ${i18n.messages.exit || 'Çıkış'}`, value: 'exit' },
      ],
    },
  ]);

  switch (action) {
    case 'analyze': await handleAnalyze(); break;
    case 'save': await handleSave(); break;
    case 'list': handleList(); break;
    case 'suggest': await handleSuggest(); break;
    case 'remove': await handleRemove(); break;
    case 'lang': await handleLang(); break;
    case 'exit': console.log(chalk.gray('  👋 Görüşürüz!')); process.exit(0);
  }

  // After action, ask to return to menu
  console.log('');
  const { again } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'again',
      message: i18n.messages.backToMenu || 'Ana menüye dönmek ister misiniz?',
      default: true,
    },
  ]);

  if (again) {
    await mainMenu();
  } else {
    console.log(chalk.gray('  👋 Görüşürüz!'));
  }
}

// ═══════════════════════════════════════════
// ANALYZE
// ═══════════════════════════════════════════
async function handleAnalyze() {
  const i18n = t();

  if (!config.FIREWORKS_API_KEY) {
    console.log(chalk.red(`\n  ${i18n.messages.noApiKey}`));
    return;
  }

  const { url } = await inquirer.prompt([
    { type: 'input', name: 'url', message: '🔗 GitHub linki:' },
  ]);

  const parsed = parseGitHubUrl(url);
  if (!parsed) {
    console.log(chalk.red(`\n  ${i18n.messages.invalidUrl}`));
    return;
  }

  // Step 1: Fetch from GitHub
  const spinner = ora({ text: `  ${i18n.messages.fetching}`, spinner: 'dots' }).start();
  let repoData = null;
  let profileData = null;

  try {
    if (parsed.type === 'repo') {
      repoData = await getRepo(parsed.owner, parsed.repo);
    } else {
      profileData = await getProfile(parsed.owner);
    }
    spinner.succeed(chalk.green('  Veriler alındı!'));
  } catch (error) {
    spinner.fail(chalk.red('  GitHub hatası!'));
    if (error.response && error.response.status === 404) {
      console.log(chalk.red(`  ${i18n.messages.notFound}`));
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      console.log(chalk.red(`  ${i18n.messages.networkError}`));
    } else {
      console.log(chalk.red(`  ❌ Hata: ${error.message}`));
    }
    return;
  }

  // Step 2: Display info
  console.log('');
  if (repoData) {
    divider();
    console.log(chalk.white.bold(`  📦 ${repoData.fullName}`));
    divider();
    console.log(`  ${chalk.gray('Açıklama')}: ${repoData.description}`);
    console.log(`  ${chalk.gray('Dil')}: ${chalk.yellow(repoData.language || 'N/A')}`);
    console.log(`  ${chalk.gray('⭐')}: ${repoData.stars}  ${chalk.gray('🍴')}: ${repoData.forks}`);
    if (repoData.topics.length > 0) {
      console.log(`  ${chalk.gray('Konular')}: ${repoData.topics.map(tp => chalk.blue(`#${tp}`)).join(' ')}`);
    }
    divider();
  } else {
    divider();
    console.log(chalk.white.bold(`  👤 ${profileData.name} (@${profileData.username})`));
    divider();
    console.log(`  ${chalk.gray('Bio')}: ${profileData.bio}`);
    console.log(`  ${chalk.gray('Repolar')}: ${profileData.publicRepos}  ${chalk.gray('Takipçi')}: ${profileData.followers}`);
    divider();

    if (profileData.repos.length > 0) {
      console.log(chalk.white.bold('\n  📚 Öne Çıkan Repolar:'));
      profileData.repos.slice(0, 5).forEach((r, i) => {
        console.log(`  ${chalk.cyan(`${i + 1}.`)} ${chalk.white(r.name)} - ${chalk.gray(r.description || '')}`);
        console.log(`     ${chalk.yellow(r.language || '?')} ⭐${r.stars}`);
      });
    }
  }

  // Step 3: AI Analysis (separate error handling)
  console.log('');
  const aiSpinner = ora({ text: `  ${i18n.messages.thinking}`, spinner: 'dots' }).start();

  try {
    let analysis;
    if (repoData) {
      analysis = await analyzeRepo(repoData);
    } else {
      analysis = await analyzeProfile(profileData);
    }
    aiSpinner.succeed(chalk.green('  AI analizi tamamlandı!'));
    console.log('');
    console.log(chalk.white(analysis));
  } catch (error) {
    aiSpinner.fail(chalk.red('  AI hatası!'));
    if (error.response) {
      const status = error.response.status;
      const msg = error.response.data?.error?.message || error.response.data?.message || '';
      console.log(chalk.red(`  ❌ AI API Hatası (${status}): ${msg || error.message}`));
      if (status === 401) {
        console.log(chalk.yellow('  💡 API anahtarınızı kontrol edin (.env dosyası)'));
      } else if (status === 404) {
        console.log(chalk.yellow('  💡 Model bulunamadı. Model adını kontrol edin.'));
      }
    } else {
      console.log(chalk.red(`  ❌ Hata: ${error.message}`));
    }
  }
}

// ═══════════════════════════════════════════
// SAVE
// ═══════════════════════════════════════════
async function handleSave() {
  const i18n = t();

  const { url } = await inquirer.prompt([
    { type: 'input', name: 'url', message: '🔗 Kaydetmek istediğiniz repo linki:' },
  ]);

  const parsed = parseGitHubUrl(url);
  if (!parsed || parsed.type !== 'repo') {
    console.log(chalk.red(`\n  ${i18n.messages.invalidUrl}`));
    return;
  }

  const spinner = ora({ text: `  ${i18n.messages.fetching}`, spinner: 'dots' }).start();

  try {
    const repoData = await getRepo(parsed.owner, parsed.repo);
    const project = {
      name: repoData.fullName,
      description: repoData.description,
      url: repoData.url,
      language: repoData.language,
      languages: repoData.languages,
      stars: repoData.stars,
      forks: repoData.forks,
      topics: repoData.topics,
      field: detectField(repoData),
    };

    const added = addProject(project);
    spinner.stop();

    if (added) {
      console.log(chalk.green(`\n  ${i18n.messages.saved}`));
      console.log(`  ${chalk.gray('İsim')}: ${chalk.white(project.name)}`);
      console.log(`  ${chalk.gray('Alan')}: ${chalk.yellow(project.field)}`);
    } else {
      console.log(chalk.yellow(`\n  ${i18n.messages.projectExists}`));
    }
  } catch (error) {
    spinner.fail();
    if (error.response && error.response.status === 404) {
      console.log(chalk.red(`  ${i18n.messages.notFound}`));
    } else {
      console.log(chalk.red(`  ❌ Hata: ${error.message}`));
    }
  }
}

// ═══════════════════════════════════════════
// LIST
// ═══════════════════════════════════════════
function handleList() {
  const i18n = t();
  const projects = getProjects();

  if (projects.length === 0) {
    console.log(chalk.yellow(`\n  ${i18n.messages.noProjects}`));
    return;
  }

  console.log('');
  divider();
  console.log(chalk.white.bold(`  📋 Kayıtlı Projeler (${projects.length})`));
  divider();
  console.log('');

  projects.forEach((p, i) => {
    console.log(`  ${chalk.cyan.bold(`[${i + 1}]`)} ${chalk.white.bold(p.name)}`);
    console.log(`      ${chalk.gray(p.description || 'Açıklama yok')}`);
    console.log(`      ${chalk.yellow(p.field)} | ⭐ ${p.stars} | ${chalk.gray(p.languages.join(', '))}`);
    console.log('');
  });
}

// ═══════════════════════════════════════════
// SUGGEST
// ═══════════════════════════════════════════
async function handleSuggest() {
  const i18n = t();

  if (!config.FIREWORKS_API_KEY) {
    console.log(chalk.red(`\n  ${i18n.messages.noApiKey}`));
    return;
  }

  const projects = getProjects();
  if (projects.length === 0) {
    console.log(chalk.yellow(`\n  ${i18n.messages.noProjects}`));
    return;
  }

  const { query } = await inquirer.prompt([
    {
      type: 'input',
      name: 'query',
      message: '💡 Ne tür bir proje arıyorsunuz? (boş = genel öneri):',
    },
  ]);

  const spinner = ora({ text: `  ${i18n.messages.suggesting}`, spinner: 'dots' }).start();

  try {
    const suggestions = await suggestProjects(projects, query);
    spinner.succeed(chalk.green('  Öneriler hazır!'));
    console.log('');
    console.log(chalk.white(suggestions));
  } catch (error) {
    spinner.fail();
    console.log(chalk.red(`  ❌ Hata: ${error.message}`));
  }
}

// ═══════════════════════════════════════════
// REMOVE
// ═══════════════════════════════════════════
async function handleRemove() {
  const i18n = t();
  const projects = getProjects();

  if (projects.length === 0) {
    console.log(chalk.yellow(`\n  ${i18n.messages.noProjects}`));
    return;
  }

  const choices = projects.map((p) => ({
    name: `${p.name} (${p.field})`,
    value: p.url,
  }));

  const { project, confirm } = await inquirer.prompt([
    {
      type: 'list',
      name: 'project',
      message: '🗑️  Silmek istediğiniz proje:',
      choices,
    },
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Emin misiniz?',
      default: false,
    },
  ]);

  if (confirm) {
    removeProject(project);
    console.log(chalk.green(`\n  ${i18n.messages.removed}`));
  } else {
    console.log(chalk.gray(`\n  ${i18n.messages.cancelled}`));
  }
}

// ═══════════════════════════════════════════
// LANGUAGE
// ═══════════════════════════════════════════
async function handleLang() {
  const { lang } = await inquirer.prompt([
    {
      type: 'list',
      name: 'lang',
      message: '🌐 Dil / Language:',
      choices: [
        { name: 'Türkçe', value: 'tr' },
        { name: 'English', value: 'en' },
      ],
    },
  ]);

  setLanguage(lang);
  const i18n = t();
  console.log(chalk.green(`\n  ${i18n.messages.langChanged}${lang === 'tr' ? 'Türkçe' : 'English'}`));
}

// ═══════════════════════════════════════════
// Helper: Detect project field/category
// ═══════════════════════════════════════════
function detectField(repoData) {
  const text = `${repoData.description} ${repoData.topics.join(' ')} ${repoData.readme}`.toLowerCase();
  const langs = repoData.languages.map(l => l.toLowerCase());

  const fields = {
    'Web Frontend': ['react', 'vue', 'angular', 'svelte', 'nextjs', 'frontend', 'ui', 'css', 'tailwind', 'webpack'],
    'Web Backend': ['express', 'fastapi', 'django', 'flask', 'nestjs', 'api', 'rest', 'graphql', 'server', 'backend'],
    'Mobile': ['react-native', 'flutter', 'swift', 'kotlin', 'android', 'ios', 'mobile'],
    'AI/ML': ['machine-learning', 'deep-learning', 'ai', 'neural', 'tensorflow', 'pytorch', 'nlp', 'llm', 'gpt', 'model'],
    'DevOps': ['docker', 'kubernetes', 'ci-cd', 'terraform', 'ansible', 'devops', 'deploy', 'infrastructure'],
    'Data': ['database', 'data', 'analytics', 'pandas', 'sql', 'etl', 'pipeline', 'bigdata'],
    'Security': ['security', 'crypto', 'encryption', 'auth', 'vulnerability', 'pentest'],
    'CLI/Tools': ['cli', 'tool', 'utility', 'command-line', 'terminal', 'automation'],
    'Game': ['game', 'unity', 'unreal', 'godot', 'gamedev', '3d', '2d'],
    'Blockchain': ['blockchain', 'web3', 'smart-contract', 'solidity', 'ethereum', 'defi'],
  };

  let bestMatch = 'General';
  let bestScore = 0;

  for (const [field, keywords] of Object.entries(fields)) {
    let score = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword)) score++;
      if (langs.includes(keyword)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = field;
    }
  }

  return bestMatch;
}

// ═══════════════════════════════════════════
// Quick commands (optional shorthand)
// ═══════════════════════════════════════════
const arg = process.argv[2];

if (!arg) {
  // No argument = interactive menu
  mainMenu();
} else if (arg === '-h' || arg === '--help') {
  showHeader();
  console.log(chalk.white('  Kullanım / Usage:\n'));
  console.log(chalk.cyan('    node src/index.js') + chalk.gray('          → İnteraktif menü'));
  console.log(chalk.cyan('    node src/index.js') + chalk.yellow(' <github-link>') + chalk.gray('  → Direkt analiz'));
  console.log('');
  console.log(chalk.gray('  Sadece çalıştırın, menüden seçin. Hepsi bu! 🎯'));
  console.log('');
} else {
  // Direct URL passed = quick analyze
  (async () => {
    showHeader();
    const i18n = t();
    const parsed = parseGitHubUrl(arg);

    if (!parsed) {
      console.log(chalk.red(`  ${i18n.messages.invalidUrl}`));
      process.exit(1);
    }

    if (!config.FIREWORKS_API_KEY) {
      console.log(chalk.red(`  ${i18n.messages.noApiKey}`));
      process.exit(1);
    }

    // Step 1: Fetch from GitHub
    const spinner = ora({ text: `  ${i18n.messages.fetching}`, spinner: 'dots' }).start();
    let repoData = null;
    let profileData = null;

    try {
      if (parsed.type === 'repo') {
        repoData = await getRepo(parsed.owner, parsed.repo);
      } else {
        profileData = await getProfile(parsed.owner);
      }
      spinner.succeed(chalk.green('  Veriler alındı!'));
    } catch (error) {
      spinner.fail(chalk.red('  GitHub hatası!'));
      if (error.response && error.response.status === 404) {
        console.log(chalk.red(`  ${i18n.messages.notFound}`));
      } else {
        console.log(chalk.red(`  ❌ Hata: ${error.message}`));
      }
      process.exit(1);
    }

    // Step 2: Display info
    console.log('');
    if (repoData) {
      divider();
      console.log(chalk.white.bold(`  📦 ${repoData.fullName}`));
      divider();
      console.log(`  ${chalk.gray('Açıklama')}: ${repoData.description}`);
      console.log(`  ${chalk.gray('Dil')}: ${chalk.yellow(repoData.language || 'N/A')}`);
      console.log(`  ⭐ ${repoData.stars}  🍴 ${repoData.forks}`);
      divider();
    } else {
      divider();
      console.log(chalk.white.bold(`  👤 ${profileData.name} (@${profileData.username})`));
      divider();
    }

    // Step 3: AI Analysis
    console.log('');
    const aiSpinner = ora({ text: `  ${i18n.messages.thinking}`, spinner: 'dots' }).start();

    try {
      let analysis;
      if (repoData) {
        analysis = await analyzeRepo(repoData);
      } else {
        analysis = await analyzeProfile(profileData);
      }
      aiSpinner.succeed(chalk.green('  AI analizi tamamlandı!'));
      console.log('');
      console.log(chalk.white(analysis));
    } catch (error) {
      aiSpinner.fail(chalk.red('  AI hatası!'));
      if (error.response) {
        const status = error.response.status;
        const msg = error.response.data?.error?.message || error.response.data?.message || '';
        console.log(chalk.red(`  ❌ AI API Hatası (${status}): ${msg || error.message}`));
        if (status === 401) {
          console.log(chalk.yellow('  💡 API anahtarınızı kontrol edin (.env dosyası)'));
        }
      } else {
        console.log(chalk.red(`  ❌ Hata: ${error.message}`));
      }
    }
  })();
}
