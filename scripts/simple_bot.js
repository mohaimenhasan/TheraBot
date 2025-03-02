/**
 * Simple WhatsApp Bot for Testing
 * 
 * A minimal implementation to test WhatsApp connectivity
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { AzureOpenAI } = require('openai');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Azure OpenAI configuration
const apiKey = process.env.AZURE_OPENAI_API_KEY;
const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;

// Initialize OpenAI client
const openaiClient = new AzureOpenAI({
  apiKey: apiKey,
  endpoint: endpoint,
  deployment: deploymentName,
  apiVersion: "2023-12-01-preview"
});

// Initialize WhatsApp client with minimal configuration
const client = new Client({
  puppeteer: {
    headless: true,
    args: ['--no-sandbox'],
  },
  authStrategy: new LocalAuth({
    dataPath: './simple_test_session'
  }),
});

// WhatsApp client event handlers
client.on('qr', (qr) => {
  console.log('QR Code received, scan it with your WhatsApp app:');
  qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
  console.log('WhatsApp client authenticated');
});

client.on('ready', () => {
  console.log('WhatsApp client is ready');
  console.log('Send a message to yourself or to the bot to test it');
  console.log('Bot will reply to all messages, including from yourself');
});

// Handle incoming messages with minimal processing
client.on('message', async (message) => {
  // Check for status broadcasts first
  if (message.from === 'status@broadcast') {
    console.log(`[Status Update] Skipped broadcast from ${message._data.author || 'unknown'}`);
    return;
  }
  
  console.log(`Message received:`, {
    from: message.from,
    body: message.body,
    fromMe: message.fromMe
  });
  
  // We'll respond to ALL other messages, regardless of source
  try {
    // Generate simple response
    const response = message.body.toLowerCase().includes('help') ? 
      "Hello! This is a test bot. I can help with basic mental health support." :
      "I received your message. This is a test response.";
      
    console.log(`Sending response: ${response}`);
    await client.sendMessage(message.from, response);
    console.log('Response sent successfully');
  } catch (error) {
    console.error('Error sending message:', error);
  }
});

// Initialize WhatsApp client
console.log('Starting simple test bot...');
client.initialize().catch(err => {
  console.error('Failed to initialize WhatsApp client:', err);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await client.destroy();
  process.exit(0);
}); 