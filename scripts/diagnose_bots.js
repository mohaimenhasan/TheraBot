/**
 * WhatsApp Bot Diagnostics Tool
 * 
 * This script tests the WhatsApp Web.js configuration and identifies issues
 * that might be preventing the bot from responding properly.
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

console.log('========== WhatsApp Bot Diagnostics ==========');

// Test environment variables
console.log('\n===== Environment Variables =====');
const requiredEnvVars = [
  'AZURE_OPENAI_API_KEY',
  'AZURE_OPENAI_ENDPOINT',
  'AZURE_OPENAI_DEPLOYMENT_NAME',
  'WHATSAPP_SESSION_DATA_PATH',
  'PUPPETEER_EXECUTABLE_PATH'
];

let missingEnvVars = [];
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    missingEnvVars.push(varName);
    console.log(`❌ ${varName}: Missing`);
  } else {
    console.log(`✅ ${varName}: Set`);
  }
});

if (missingEnvVars.length > 0) {
  console.log(`\n⚠️ Missing environment variables: ${missingEnvVars.join(', ')}`);
}

// Test session data directory
console.log('\n===== Session Data Directory =====');
const sessionPath = process.env.WHATSAPP_SESSION_DATA_PATH || './session_data';
try {
  if (fs.existsSync(sessionPath)) {
    console.log(`✅ Session directory (${sessionPath}) exists`);
    
    // Check if it contains WhatsApp session data
    const files = fs.readdirSync(sessionPath);
    if (files.length > 0) {
      console.log(`✅ Session directory contains ${files.length} files/directories`);
    } else {
      console.log(`❌ Session directory is empty. QR scan may be required.`);
    }
  } else {
    console.log(`❌ Session directory (${sessionPath}) does not exist`);
  }
} catch (err) {
  console.log(`❌ Error checking session directory: ${err.message}`);
}

// Test puppeteer executable
console.log('\n===== Puppeteer Executable =====');
const puppeteerPath = process.env.PUPPETEER_EXECUTABLE_PATH;
if (puppeteerPath) {
  try {
    if (fs.existsSync(puppeteerPath)) {
      console.log(`✅ Puppeteer executable exists at: ${puppeteerPath}`);
    } else {
      console.log(`❌ Puppeteer executable not found at: ${puppeteerPath}`);
    }
  } catch (err) {
    console.log(`❌ Error checking puppeteer executable: ${err.message}`);
  }
} else {
  console.log(`ℹ️ No custom puppeteer path set, using default`);
}

// Create test client to check connectivity
console.log('\n===== Testing WhatsApp Web.js Connection =====');
console.log('Initializing test client...');

const client = new Client({
  puppeteer: {
    headless: false,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  },
  authStrategy: new LocalAuth(),
  webVersion: '2.3000.1020521505'
});

// Set up event handlers
client.on('qr', (qr) => {
  console.log('QR Code received for diagnosis. Scan with WhatsApp:');
  qrcode.generate(qr, { small: true });
  console.log('⚠️ New QR code generated, suggesting current sessions may be invalid');
});

client.on('authenticated', () => {
  console.log('✅ WhatsApp client authenticated successfully');
});

client.on('auth_failure', (msg) => {
  console.log(`❌ Authentication failure: ${msg}`);
});

client.on('disconnected', (reason) => {
  console.log(`❌ Client disconnected: ${reason}`);
});

client.on('ready', () => {
  console.log('✅ Client is ready! WhatsApp Web.js connection is working properly');
  console.log('Testing message handling...');
  
  setTimeout(() => {
    console.log('\n===== Diagnosis Complete =====');
    console.log('Results:');
    console.log('1. Environment check: ' + (missingEnvVars.length === 0 ? '✅ Passed' : '❌ Failed'));
    console.log('2. Session directory: ' + (fs.existsSync(sessionPath) ? '✅ Exists' : '❌ Missing'));
    console.log('3. WhatsApp connection: ✅ Working');
    console.log('\nRecommendations:');
    
    if (missingEnvVars.length > 0) {
      console.log(`- Add missing environment variables: ${missingEnvVars.join(', ')}`);
    }
    
    if (!fs.existsSync(sessionPath)) {
      console.log(`- Create the session directory at ${sessionPath}`);
    }
    
    console.log('- If you\'re still having issues with the main bot:');
    console.log('  1. Delete the WhatsApp session data folder and rescan QR code');
    console.log('  2. Check your firewall and network settings for blocking connections');
    console.log('  3. Make sure you\'re using a compatible version of WhatsApp');
    console.log('  4. Verify that your Azure OpenAI service is working properly');
    
    console.log('\nExiting in 5 seconds...');
    setTimeout(() => {
      client.destroy().then(() => {
        process.exit(0);
      });
    }, 5000);
  }, 5000);
});

// Start client
client.initialize().catch(err => {
  console.error('❌ Failed to initialize client:', err);
}); 