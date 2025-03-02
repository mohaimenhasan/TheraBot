/**
 * WhatsApp Debug Script
 * 
 * A minimal implementation with extra debugging for WhatsApp Web.js
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Ensure session directory exists
const sessionDir = './debug_session';
if (!fs.existsSync(sessionDir)) {
  fs.mkdirSync(sessionDir, { recursive: true });
  console.log(`Created session directory: ${sessionDir}`);
}

// Set debug level
console.log('Setting up WhatsApp Web.js with debug logging...');
process.env.DEBUG = 'whatsapp-web.js:*,puppeteer:*';

console.log('WhatsApp Web.js Version:', require('whatsapp-web.js').version);
console.log('Puppeteer Version:', require('puppeteer-core').version);

// Initialize WhatsApp client with minimal configuration
const client = new Client({
  puppeteer: {
    headless: false, // Use non-headless for easier debugging
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ],
    // Skip custom executable path
  },
  authStrategy: new LocalAuth({
    dataPath: sessionDir
  }),
  webVersion: '2.2318.11'
});

// Add verbose logging for all events
client.on('qr', (qr) => {
  console.log('QR RECEIVED. EVENT FIRED: qr');
  console.log('========== SCAN THIS QR CODE ==========');
  qrcode.generate(qr, { small: true });
});

client.on('loading_screen', (percent, message) => {
  console.log('LOADING SCREEN', percent, message);
});

client.on('authenticated', () => {
  console.log('AUTHENTICATED. EVENT FIRED: authenticated');
});

client.on('auth_failure', (msg) => {
  console.error('AUTHENTICATION FAILURE:', msg);
});

client.on('ready', () => {
  console.log('CLIENT IS READY. EVENT FIRED: ready');
});

client.on('message', (msg) => {
  // Check for status broadcasts first with minimal logging
  if (msg.from === 'status@broadcast') {
    console.log(`[Status Update] Skipped broadcast from ${msg._data.author || 'unknown'}`);
    return;
  }
  
  console.log('MESSAGE RECEIVED', msg.body);
  console.log('From:', msg.from, 'Author:', msg._data.author || 'N/A');
  
  // Echo back the message
  msg.reply('You said: ' + msg.body)
    .then(() => console.log('Message sent successfully'))
    .catch(err => console.error('Failed to send message:', err));
});

client.on('disconnected', (reason) => {
  console.log('Client was disconnected', reason);
});

// Try to get the page when available
let attempts = 0;
const getPage = () => {
  if (attempts > 10) return;
  
  try {
    if (client.pupPage) {
      console.log('Successfully got puppeteer page!');
    } else {
      attempts++;
      console.log(`Attempting to get page (${attempts}/10)...`);
      setTimeout(getPage, 5000);
    }
  } catch (error) {
    console.error('Error getting page:', error);
    attempts++;
    setTimeout(getPage, 5000);
  }
};

// Initialize WhatsApp client
console.log('Starting WhatsApp client (Debug Mode)...');
client.initialize()
  .then(() => {
    console.log('Client initialize promise resolved');
    setTimeout(getPage, 5000);
  })
  .catch(err => {
    console.error('Failed to initialize client:', err);
  });

// Log when script is interrupted
process.on('SIGINT', () => {
  console.log('Interrupted. Closing...');
  client.destroy()
    .then(() => console.log('Client destroyed'))
    .catch(err => console.error('Error while destroying client:', err))
    .finally(() => process.exit(0));
}); 