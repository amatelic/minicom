#!/usr/bin/env node

/**
 * Interactive Vercel deployment for MiniCom monorepo.
 *
 * This script:
 * - Builds shared workspace packages.
 * - Creates/links Vercel projects.
 * - Syncs app .env.local values to Vercel (production).
 * - Produces deployable app bundles without workspace:* deps.
 * - Deploys visitor and agent apps sequentially.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

const log = {
  info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✔${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✖${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bright}${colors.blue}▸ ${msg}${colors.reset}\n`),
  step: (num, msg) => console.log(`${colors.bright}${colors.blue}${num}.${colors.reset} ${msg}`),
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question, defaultValue = "") {
  return new Promise((resolve) => {
    const prompt = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
    rl.question(prompt, (answer) => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

function exec(cmd, options = {}) {
  try {
    return execSync(cmd, {
      encoding: "utf-8",
      stdio: options.silent ? "pipe" : "inherit",
      ...options,
    });
  } catch (error) {
    if (!options.ignoreError) {
      throw error;
    }
    return null;
  }
}

function shellEscape(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function commandExists(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function parseEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) {
    return env;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalIndex = trimmed.indexOf("=");
    if (equalIndex === -1) continue;

    const key = trimmed.slice(0, equalIndex).trim();
    let value = trimmed.slice(equalIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }

  return env;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function isValidEnvKey(key) {
  return /^[A-Z0-9_]+$/.test(key);
}

function upsertVercelEnv(key, value) {
  if (!isValidEnvKey(key)) {
    throw new Error(`Invalid environment variable key: ${key}`);
  }

  exec(`vercel env rm ${key} production --yes`, { silent: true, ignoreError: true });
  exec(`printf %s ${shellEscape(value)} | vercel env add ${key} production`, { silent: true });
}

function checkVercelProject(projectName) {
  const output = exec("vercel project ls", { silent: true, ignoreError: true }) || "";
  return output.includes(projectName);
}

function ensureVercelProject(projectName) {
  const exists = checkVercelProject(projectName);
  if (exists) {
    log.info("  Project exists. Linking...");
    exec(`vercel link --project ${shellEscape(projectName)} --yes`, { silent: true });
    return;
  }

  log.info("  Creating new project...");
  exec(`vercel project add ${shellEscape(projectName)}`, { silent: true });
  exec(`vercel link --project ${shellEscape(projectName)} --yes`, { silent: true });
}

function copyWorkspacePackages(rootDir, deployAppDir) {
  const packagesToCopy = ["chat-core", "chat-ui"];
  for (const packageName of packagesToCopy) {
    const sourceDir = path.join(rootDir, "packages", packageName);
    const targetDir = path.join(deployAppDir, "packages", packageName);

    fs.rmSync(targetDir, { recursive: true, force: true });
    fs.cpSync(sourceDir, targetDir, {
      recursive: true,
      force: true,
      filter: (sourcePath) => {
        return (
          !sourcePath.includes(`${path.sep}node_modules${path.sep}`) &&
          !sourcePath.endsWith(`${path.sep}node_modules`) &&
          !sourcePath.endsWith(`${path.sep}tsconfig.tsbuildinfo`)
        );
      },
    });
  }
}

function rewriteWorkspaceDepsToLocalFiles(deployAppDir) {
  const appPkgPath = path.join(deployAppDir, "package.json");
  const chatCorePkgPath = path.join(deployAppDir, "packages", "chat-core", "package.json");
  const chatUiPkgPath = path.join(deployAppDir, "packages", "chat-ui", "package.json");

  const appPkg = readJson(appPkgPath);
  appPkg.dependencies = appPkg.dependencies || {};
  appPkg.dependencies["@minicom/chat-core"] = "file:packages/chat-core";
  appPkg.dependencies["@minicom/chat-ui"] = "file:packages/chat-ui";
  appPkg.devDependencies = appPkg.devDependencies || {};
  appPkg.devDependencies.typescript = "^5";
  appPkg.devDependencies["@types/node"] = "^20";
  appPkg.devDependencies["@types/react"] = "^19";
  appPkg.devDependencies["@types/react-dom"] = "^19";
  appPkg.devDependencies["@types/react-motion"] = "^0.0.40";
  appPkg.devDependencies["@tailwindcss/postcss"] = "^4";
  appPkg.devDependencies.tailwindcss = "^4";
  writeJson(appPkgPath, appPkg);

  const chatUiPkg = readJson(chatUiPkgPath);
  chatUiPkg.dependencies = chatUiPkg.dependencies || {};
  chatUiPkg.dependencies["@minicom/chat-core"] = "file:../chat-core";
  writeJson(chatUiPkgPath, chatUiPkg);
}

function validateNoWorkspaceProtocol(deployAppDir) {
  const packageJsonFiles = [];

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".vercel") {
          continue;
        }
        walk(fullPath);
      } else if (entry.isFile() && entry.name === "package.json") {
        packageJsonFiles.push(fullPath);
      }
    }
  }

  walk(deployAppDir);
  const violations = [];
  for (const pkgPath of packageJsonFiles) {
    const pkg = readJson(pkgPath);
    const sections = [
      ["dependencies", pkg.dependencies || {}],
      ["devDependencies", pkg.devDependencies || {}],
      ["peerDependencies", pkg.peerDependencies || {}],
      ["optionalDependencies", pkg.optionalDependencies || {}],
    ];
    for (const [sectionName, deps] of sections) {
      for (const [name, version] of Object.entries(deps)) {
        if (typeof version === "string" && version.startsWith("workspace:")) {
          violations.push(`${path.relative(deployAppDir, pkgPath)} -> ${sectionName}.${name}=${version}`);
        }
      }
    }
  }

  if (violations.length) {
    throw new Error(`Deploy package still contains workspace: dependencies: ${violations.join("; ")}`);
  }
}

function copyVercelLinkMetadata(sourceAppDir, deployAppDir) {
  const sourceVercelDir = path.join(sourceAppDir, ".vercel");
  const sourceProjectFile = path.join(sourceVercelDir, "project.json");
  if (!fs.existsSync(sourceProjectFile)) return;

  const targetVercelDir = path.join(deployAppDir, ".vercel");
  fs.mkdirSync(targetVercelDir, { recursive: true });
  fs.copyFileSync(sourceProjectFile, path.join(targetVercelDir, "project.json"));

  const sourceReadme = path.join(sourceVercelDir, "README.txt");
  if (fs.existsSync(sourceReadme)) {
    fs.copyFileSync(sourceReadme, path.join(targetVercelDir, "README.txt"));
  }
}

function writeNpmRcForVercel(deployAppDir) {
  fs.writeFileSync(path.join(deployAppDir, ".npmrc"), "legacy-peer-deps=true\n");
}

function rewriteTsconfigExtends(tsconfigPath, tsconfigBasePath) {
  if (!fs.existsSync(tsconfigPath)) return;
  const tsconfig = readJson(tsconfigPath);
  if (typeof tsconfig.extends !== "string") return;
  if (!tsconfig.extends.endsWith("tsconfig.base.json")) return;

  let relativeBasePath = path.relative(path.dirname(tsconfigPath), tsconfigBasePath);
  relativeBasePath = relativeBasePath.replace(/\\/g, "/");
  if (!relativeBasePath.startsWith(".")) {
    relativeBasePath = `./${relativeBasePath}`;
  }

  tsconfig.extends = relativeBasePath;
  writeJson(tsconfigPath, tsconfig);
}

function syncTsconfigBaseForDeploy(rootDir, deployAppDir) {
  const sourceBase = path.join(rootDir, "tsconfig.base.json");
  const targetBase = path.join(deployAppDir, "tsconfig.base.json");
  if (!fs.existsSync(sourceBase)) return;

  fs.copyFileSync(sourceBase, targetBase);
  rewriteTsconfigExtends(path.join(deployAppDir, "tsconfig.json"), targetBase);
  rewriteTsconfigExtends(path.join(deployAppDir, "packages", "chat-core", "tsconfig.json"), targetBase);
  rewriteTsconfigExtends(path.join(deployAppDir, "packages", "chat-ui", "tsconfig.json"), targetBase);
}

function writeVercelConfig(deployAppDir) {
  const vercelConfig = {
    installCommand: "npm install --legacy-peer-deps",
    buildCommand: "npm run build",
    framework: "nextjs",
  };
  writeJson(path.join(deployAppDir, "vercel.json"), vercelConfig);
}

function prepareDeployableApp(rootDir, appPackageName, sourceAppDir, deployAppDir) {
  fs.rmSync(deployAppDir, { recursive: true, force: true });
  exec(`pnpm --filter ${appPackageName} deploy --prod ${deployAppDir}`, { silent: false });
  copyWorkspacePackages(rootDir, deployAppDir);
  rewriteWorkspaceDepsToLocalFiles(deployAppDir);
  copyVercelLinkMetadata(sourceAppDir, deployAppDir);
  writeNpmRcForVercel(deployAppDir);
  syncTsconfigBaseForDeploy(rootDir, deployAppDir);
  writeVercelConfig(deployAppDir);
  validateNoWorkspaceProtocol(deployAppDir);
}

async function main() {
  log.header("🚀 MiniCom Vercel Deployment");

  log.step(1, "Checking prerequisites...\n");
  if (!commandExists("node")) {
    throw new Error("Node.js is not installed.");
  }
  if (!commandExists("pnpm")) {
    throw new Error("pnpm is not installed.");
  }
  if (!commandExists("vercel")) {
    throw new Error("Vercel CLI is not installed.");
  }
  log.success(`Node.js ${exec("node --version", { silent: true }).trim()}`);
  log.success(`pnpm ${exec("pnpm --version", { silent: true }).trim()}`);
  log.success(`Vercel CLI ${exec("vercel --version", { silent: true }).trim()}`);

  log.step(2, "Checking Vercel authentication...\n");
  const username = exec("vercel whoami", { silent: true, ignoreError: true });
  if (!username) {
    throw new Error("Not logged in to Vercel. Run `vercel login`.");
  }
  log.success(`Authenticated as: ${colors.bright}${username.trim()}${colors.reset}`);

  log.step(3, "Building shared packages...\n");
  log.info("Building @minicom/chat-core...");
  exec("pnpm --filter @minicom/chat-core build", { silent: true });
  log.success("chat-core built successfully");
  log.info("Building @minicom/chat-ui...");
  exec("pnpm --filter @minicom/chat-ui build", { silent: true });
  log.success("chat-ui built successfully");

  log.step(4, "Configuring deployment settings...\n");
  const visitorProject = await ask("  Visitor Vercel project", "minicom-visitor");
  const visitorDomain = await ask("  Visitor custom domain (optional)", "");
  const agentProject = await ask("  Agent Vercel project", "minicom-agent");
  const agentDomain = await ask("  Agent custom domain (optional)", "");

  log.step(5, "Setting up Vercel projects...\n");
  const rootDir = process.cwd();
  const visitorDir = path.join(rootDir, "apps", "visitor");
  const agentDir = path.join(rootDir, "apps", "agent");

  log.info(`Setting up visitor app (${visitorProject})...`);
  process.chdir(visitorDir);
  ensureVercelProject(visitorProject);
  upsertVercelEnv("ENABLE_PNPM", "1");
  const visitorEnv = parseEnvFile(path.join(visitorDir, ".env.local"));
  if (Object.keys(visitorEnv).length > 0) {
    log.info("  Syncing environment variables...");
    for (const [key, value] of Object.entries(visitorEnv)) {
      upsertVercelEnv(key, value);
    }
  }
  log.success(`Visitor project ready: ${colors.bright}${visitorProject}${colors.reset}`);

  log.info(`\nSetting up agent app (${agentProject})...`);
  process.chdir(agentDir);
  ensureVercelProject(agentProject);
  upsertVercelEnv("ENABLE_PNPM", "1");
  const agentEnv = parseEnvFile(path.join(agentDir, ".env.local"));
  if (Object.keys(agentEnv).length > 0) {
    log.info("  Syncing environment variables...");
    for (const [key, value] of Object.entries(agentEnv)) {
      upsertVercelEnv(key, value);
    }
  }
  log.success(`Agent project ready: ${colors.bright}${agentProject}${colors.reset}`);

  log.step(6, "Deployment summary\n");
  console.log(`${colors.bright}Visitor App:${colors.reset}`);
  console.log(`  Project: ${visitorProject}`);
  console.log(`  Directory: apps/visitor`);
  if (visitorDomain) console.log(`  Domain: ${visitorDomain}`);
  console.log(`  Env vars: ${Object.keys(visitorEnv).length} synced\n`);
  console.log(`${colors.bright}Agent App:${colors.reset}`);
  console.log(`  Project: ${agentProject}`);
  console.log(`  Directory: apps/agent`);
  if (agentDomain) console.log(`  Domain: ${agentDomain}`);
  console.log(`  Env vars: ${Object.keys(agentEnv).length} synced\n`);

  const confirm = await ask("Proceed with deployment? (yes/no)", "yes");
  if (confirm.toLowerCase() !== "yes") {
    log.warning("Deployment cancelled.");
    return;
  }

  log.step(7, "Preparing deployable packages...\n");
  const deployRoot = path.join(rootDir, "dist");
  fs.mkdirSync(deployRoot, { recursive: true });
  const visitorDeployDir = path.join(deployRoot, "visitor");
  const agentDeployDir = path.join(deployRoot, "agent");

  log.info("Preparing visitor app for deployment...");
  prepareDeployableApp(rootDir, "@minicom/visitor", visitorDir, visitorDeployDir);
  log.success("Visitor package prepared");

  log.info("Preparing agent app for deployment...");
  prepareDeployableApp(rootDir, "@minicom/agent", agentDir, agentDeployDir);
  log.success("Agent package prepared");

  log.step(8, "Deploying to Vercel...\n");

  log.info(`Deploying visitor app (${visitorProject})...`);
  process.chdir(visitorDeployDir);
  exec(`vercel link --project ${shellEscape(visitorProject)} --yes`, { silent: true });
  exec("vercel --prod --yes", { silent: false });
  if (visitorDomain) {
    exec(`vercel domains add ${shellEscape(visitorDomain)}`, { silent: true, ignoreError: true });
  }
  log.success("Visitor app deployed successfully!");

  log.info(`\nDeploying agent app (${agentProject})...`);
  process.chdir(agentDeployDir);
  exec(`vercel link --project ${shellEscape(agentProject)} --yes`, { silent: true });
  exec("vercel --prod --yes", { silent: false });
  if (agentDomain) {
    exec(`vercel domains add ${shellEscape(agentDomain)}`, { silent: true, ignoreError: true });
  }
  log.success("Agent app deployed successfully!");

  log.header("✨ Deployment Complete!");
  log.success("Both apps have been deployed to Vercel.");
}

main()
  .catch((error) => {
    log.error(`Deployment failed: ${error.message}`);
    process.exit(1);
  })
  .finally(() => {
    rl.close();
  });
