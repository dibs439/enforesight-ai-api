const fs = require('fs');
const path = require('path');

// Ensure src/convex directory exists
const convexDir = path.join(__dirname, '..', 'src', 'convex');
fs.mkdirSync(convexDir, { recursive: true });

// Remove existing _generated symlink/directory if present
const targetLink = path.join(convexDir, '_generated');
try {
  fs.rmSync(targetLink, { recursive: true, force: true });
} catch {
  // Ignore if it doesn't exist
}

// Create symlink to convex/_generated
// Use 'junction' on Windows for directory symlinks (no admin privileges needed)
const source = path.resolve(__dirname, '..', 'convex', '_generated');
try {
  fs.symlinkSync(source, targetLink, 'junction');
  console.log(`Symlinked ${targetLink} -> ${source}`);
} catch (err) {
  console.warn(`Warning: Could not create symlink: ${err.message}`);
  console.warn('Falling back to directory copy...');
  // Fallback: copy the directory instead
  copyDirSync(source, targetLink);
  console.log(`Copied ${source} -> ${targetLink}`);
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
