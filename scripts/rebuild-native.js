const { execSync } = require('child_process');
const path = require('path');

module.exports = async function(context) {
  const appOutDir = context.appOutDir;
  const platform = context.electronPlatformName;
  const arch = context.arch;

  // Determine the backend-ts path
  const resourcesDir = platform === 'darwin'
    ? path.join(appOutDir, 'Skill Checker.app', 'Contents', 'Resources', 'backend-ts')
    : path.join(appOutDir, 'resources', 'backend-ts');

  console.log('Rebuilding native modules for Electron in:', resourcesDir);

  // Get Electron version from context - handle both string and object formats
  let electronVersion = context.electronVersion;
  if (typeof electronVersion === 'object' && electronVersion !== null) {
    electronVersion = electronVersion.version || electronVersion;
  }
  
  // Fallback: read from package.json devDependencies
  if (!electronVersion) {
    try {
      const pkg = require('../package.json');
      electronVersion = pkg.devDependencies?.electron || pkg.dependencies?.electron;
      // Remove ^ or ~ prefix if present
      if (electronVersion) {
        electronVersion = electronVersion.replace(/^[\^~]/, '');
      }
    } catch (e) {
      console.error('Could not determine Electron version');
    }
  }

  console.log('Using Electron version:', electronVersion);

  try {
    // Use @electron/rebuild to rebuild native modules
    execSync(`npx @electron/rebuild -v ${electronVersion} -w better-sqlite3 --module-dir "${resourcesDir}"`, {
      cwd: context.projectDir,
      stdio: 'inherit'
    });
    console.log('Native modules rebuilt successfully');
  } catch (error) {
    console.error('Failed to rebuild native modules:', error);
    throw error;
  }
};
