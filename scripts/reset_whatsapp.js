/**
 * WhatsApp Reset Tool
 * 
 * This script forcefully cleans up WhatsApp Web.js session data and cache
 * to resolve issues with corrupted sessions and locked files.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Define paths to clean
const pathsToClean = [
  './session_data',
  './simple_test_session',
  './diagnosis_session',
  './debug_session',
  './.wwebjs_auth',
  './.wwebjs_cache'
];

// Function to forcefully kill processes that might be locking files (Windows-specific)
function killChromiumProcesses() {
  try {
    console.log('Attempting to kill any running Chromium/Chrome processes...');
    execSync('taskkill /F /IM chrome.exe /T', { stdio: 'ignore' });
    execSync('taskkill /F /IM chromium.exe /T', { stdio: 'ignore' });
    console.log('Chrome processes terminated.');
  } catch (error) {
    // It's okay if no processes were found to kill
    console.log('No Chrome processes needed to be terminated.');
  }
}

// Function to safely delete a directory with retries for Windows file locking
function forceDeletePath(targetPath) {
  if (!fs.existsSync(targetPath)) {
    console.log(`Path does not exist: ${targetPath}`);
    return;
  }

  // Try standard deletion first
  try {
    console.log(`Deleting ${targetPath}...`);
    fs.rmSync(targetPath, { recursive: true, force: true });
    console.log(`Successfully deleted: ${targetPath}`);
    return;
  } catch (error) {
    console.log(`Standard deletion failed: ${error.message}`);
  }

  // On Windows, try using the rd command which can sometimes handle locked files better
  try {
    console.log(`Attempting to force delete with rd command: ${targetPath}`);
    execSync(`rd /s /q "${targetPath}"`, { stdio: 'ignore' });
    console.log(`Successfully deleted with rd command: ${targetPath}`);
  } catch (error) {
    console.error(`Failed to force delete ${targetPath}: ${error.message}`);
    console.log('You may need to restart your computer to fully release locked files.');
  }
}

// Main cleanup function
async function cleanupWhatsAppSessions() {
  console.log('=== WhatsApp Web.js Session Reset Tool ===');
  console.log('This will delete all session data and cached files.');
  
  // Kill any running Chromium processes first to release file locks
  killChromiumProcesses();
  
  // Wait a moment for processes to fully terminate
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Try to delete each path
  for (const pathToClean of pathsToClean) {
    const absolutePath = path.resolve(pathToClean);
    forceDeletePath(absolutePath);
  }
  
  console.log('\nCleanup completed. You can now restart the bot with:');
  console.log('npm start');
}

// Run the cleanup
cleanupWhatsAppSessions(); 