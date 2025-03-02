/**
 * Test Send Message Script
 * 
 * This script allows testing sending messages via the WhatsApp bot
 * without needing to use the WhatsApp app.
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const dotenv = require('dotenv');
const path = require('path');
const readline = require('readline');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Setup readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Initialize WhatsApp client with the same config as the main app
const client = new Client({
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  },
  authStrategy: new LocalAuth({
    dataPath: process.env.WHATSAPP_SESSION_DATA_PATH || './session_data'
  }),
  webVersion: '2.2318.11',
  webVersionCache: {
    type: 'none'
  }
});

// WhatsApp client event handlers
client.on('qr', (qr) => {
  console.log('QR Code received, scan it with your WhatsApp app:');
  qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
  console.log('WhatsApp client authenticated');
});

client.on('auth_failure', msg => {
  console.error('Authentication failure:', msg);
  process.exit(1);
});

client.on('disconnected', (reason) => {
  console.log('Client was disconnected:', reason);
  process.exit(1);
});

client.on('ready', async () => {
  console.log('WhatsApp client is ready');
  console.log('------------------------------');
  
  // Get own number - Fixed: use client.info.wid._serialized instead of getWid()
  try {
    const myNumber = client.info.wid._serialized;
    console.log(`Your WhatsApp ID: ${myNumber}`);
  } catch (error) {
    console.log('Could not get your WhatsApp ID, but you can still send messages');
    console.log('Error:', error.message);
  }
  console.log('------------------------------');
  
  // Function to send a test message
  const sendTestMessage = async () => {
    rl.question('Enter the recipient number (with country code, no spaces/symbols, e.g., 15551234567): ', async (recipient) => {
      // Format the number
      if (!recipient.includes('@c.us')) {
        recipient = `${recipient}@c.us`;
      }
      
      rl.question('Enter the message to send: ', async (message) => {
        try {
          console.log(`Sending message to ${recipient}...`);
          await client.sendMessage(recipient, message);
          console.log('Message sent successfully!');
          
          // Check own number to tell user how to test with their own number
          try {
            const myNumber = client.info.wid._serialized;
            if (recipient === myNumber) {
              console.log('\nYou sent a message to yourself, check your WhatsApp to see if you received it.');
            }
          } catch (error) {
            // Skip if we can't get the user's number
          }
          
          rl.question('Send another message? (y/n): ', (answer) => {
            if (answer.toLowerCase() === 'y') {
              sendTestMessage();
            } else {
              console.log('Shutting down...');
              client.destroy().then(() => {
                process.exit(0);
              });
            }
          });
        } catch (error) {
          console.error('Error sending message:', error);
          rl.question('Try again? (y/n): ', (answer) => {
            if (answer.toLowerCase() === 'y') {
              sendTestMessage();
            } else {
              console.log('Shutting down...');
              client.destroy().then(() => {
                process.exit(0);
              });
            }
          });
        }
      });
    });
  };
  
  // Monitor for incoming messages
  client.on('message', (message) => {
    // Check for status broadcasts first with minimal logging
    if (message.from === 'status@broadcast') {
      console.log(`[Status Update] Skipped broadcast from ${message._data.author || 'unknown'}`);
      return;
    }
    
    console.log('\n------------------------------');
    console.log('Incoming message:');
    console.log(`From: ${message.from}`);
    console.log(`Author: ${message._data.author || 'N/A'}`);
    console.log(`Type: ${message.type}, isGroup: ${message.isGroup || false}, fromMe: ${message.fromMe}`);
    console.log(`Body: ${message.body}`);
    console.log('------------------------------\n');
  });
  
  // Start the test
  sendTestMessage();
});

// Initialize WhatsApp client
console.log('Starting test send message script...');
client.initialize().catch(err => {
  console.error('Failed to initialize WhatsApp client:', err);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  rl.close();
  await client.destroy();
  process.exit(0);
}); 