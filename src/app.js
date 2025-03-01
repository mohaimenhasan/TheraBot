const express = require('express');
const bodyParser = require('body-parser');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const dotenv = require('dotenv');
const path = require('path');
const { processMessage } = require('./azure_openai/openai_service');
const { 
  saveConversation, 
  getConversationHistory, 
  clearConversationHistory,
  getMoodHistory,
  setPremiumStatus,
  isPremiumUser
} = require('./whatsapp/conversation_store');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Initialize Express app
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize WhatsApp client
const client = new Client({
  puppeteer: {
    headless: true,
    args: ['--no-sandbox'],
  },
  authStrategy: new LocalAuth({
    dataPath: process.env.WHATSAPP_SESSION_DATA_PATH || './session_data'
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
});

// Predefined commands
const COMMANDS = {
  HELP: '/help',
  UPGRADE: '/upgrade',
  MOOD_HISTORY: '/mood',
  CLEAR: '/clear',
  EXERCISE: '/exercise',
  AFFIRMATION: '/affirmation'
};

// Handle incoming messages
client.on('message', async (message) => {
  console.log(`New message from ${message.from}: ${message.body}`);
  
  try {
    // Skip messages from groups or if it's from the bot itself
    if (message.from.includes('@g.us') || message.fromMe) {
      return;
    }
    
    // Handle commands
    if (message.body.startsWith('/')) {
      await handleCommand(message);
      return;
    }
    
    // Get user premium status
    const userIsPremium = await isPremiumUser(message.from);
    
    // Get conversation history
    const conversationHistory = await getConversationHistory(message.from);
    
    // Process message with Azure OpenAI
    const response = await processMessage(message.body, conversationHistory);
    
    // Save the conversation
    await saveConversation(message.from, message.body, response);
    
    // Send response back to user
    await client.sendMessage(message.from, response);
    
    console.log(`Response sent to ${message.from}: ${response}`);
  } catch (error) {
    console.error('Error processing message:', error);
    await client.sendMessage(
      message.from, 
      "I'm sorry, I'm having trouble processing your message right now. Please try again later."
    );
  }
});

/**
 * Handle commands
 * @param {object} message - WhatsApp message
 */
async function handleCommand(message) {
  const command = message.body.split(' ')[0].toLowerCase();
  
  switch (command) {
    case COMMANDS.HELP:
      await sendHelpMessage(message.from);
      break;
      
    case COMMANDS.UPGRADE:
      await sendUpgradeInfo(message.from);
      break;
      
    case COMMANDS.MOOD_HISTORY:
      await sendMoodHistory(message.from);
      break;
      
    case COMMANDS.CLEAR:
      await clearConversationHistory(message.from);
      await client.sendMessage(message.from, "Your conversation history has been cleared. I'm still here if you need to talk!");
      break;
      
    case COMMANDS.EXERCISE:
      await handleExerciseRequest(message);
      break;
      
    case COMMANDS.AFFIRMATION:
      await handleAffirmationRequest(message);
      break;
      
    default:
      await client.sendMessage(message.from, `I don't recognize that command. Type ${COMMANDS.HELP} to see available commands.`);
  }
}

/**
 * Send help message with available commands
 * @param {string} userId - WhatsApp user ID
 */
async function sendHelpMessage(userId) {
  const helpMessage = `
*Available Commands:*

${COMMANDS.HELP} - Show this help message
${COMMANDS.UPGRADE} - Get information about premium features
${COMMANDS.MOOD_HISTORY} - View your mood history
${COMMANDS.CLEAR} - Clear your conversation history
${COMMANDS.EXERCISE} - Get a random coping exercise
${COMMANDS.AFFIRMATION} - Get a positive affirmation

You can also type things like:
- "My mood is 7/10" to track your mood
- "I need a coping exercise for anxiety"
- "Give me an affirmation for confidence"
- "I'm feeling stressed, what should I do?"
`;

  await client.sendMessage(userId, helpMessage);
}

/**
 * Send information about premium upgrade
 * @param {string} userId - WhatsApp user ID
 */
async function sendUpgradeInfo(userId) {
  const isPremium = await isPremiumUser(userId);
  
  if (isPremium) {
    await client.sendMessage(userId, "You're already a premium user! Thank you for your support.");
    return;
  }
  
  const upgradeMessage = `
*Upgrade to Premium Features*

Get more from your mental health coach:
✅ Extended conversation history
✅ Detailed mood tracking and analysis
✅ Additional coping exercises and affirmations
✅ Priority response times

Contact us at ${process.env.ADMIN_CONTACT || 'support@example.com'} to upgrade!
`;
  
  await client.sendMessage(userId, upgradeMessage);
}

/**
 * Send mood history to user
 * @param {string} userId - WhatsApp user ID
 */
async function sendMoodHistory(userId) {
  const moodData = await getMoodHistory(userId);
  
  if (!moodData || moodData.length === 0) {
    await client.sendMessage(userId, "You haven't recorded any mood data yet. Try saying 'My mood is 7/10' to start tracking!");
    return;
  }
  
  // Get last 7 mood entries
  const recentMoods = moodData.slice(-7);
  
  // Calculate average mood
  const averageMood = recentMoods.reduce((sum, entry) => sum + entry.score, 0) / recentMoods.length;
  
  // Create message
  let message = "*Your Mood History*\n\n";
  
  recentMoods.forEach(entry => {
    const date = new Date(entry.timestamp);
    message += `${date.toLocaleDateString()}: ${entry.score}/10\n`;
  });
  
  message += `\nAverage mood: ${averageMood.toFixed(1)}/10`;
  
  const isPremium = await isPremiumUser(userId);
  
  if (!isPremium && moodData.length > 7) {
    message += "\n\n_Upgrade to premium to see your complete mood history and detailed analysis!_";
  }
  
  await client.sendMessage(userId, message);
}

/**
 * Handle exercise request
 * @param {object} message - WhatsApp message
 */
async function handleExerciseRequest(message) {
  // Pass the exercise request to the AI
  const userMessage = "[COPING EXERCISE REQUEST] Please provide a coping exercise";
  
  // Get conversation history
  const conversationHistory = await getConversationHistory(message.from);
  
  // Process with OpenAI
  const response = await processMessage(userMessage, conversationHistory);
  
  // Save to conversation
  await saveConversation(message.from, userMessage, response);
  
  // Send response
  await client.sendMessage(message.from, response);
}

/**
 * Handle affirmation request
 * @param {object} message - WhatsApp message
 */
async function handleAffirmationRequest(message) {
  // Pass the affirmation request to the AI
  const userMessage = "[AFFIRMATION REQUEST] Please provide a positive affirmation";
  
  // Get conversation history
  const conversationHistory = await getConversationHistory(message.from);
  
  // Process with OpenAI
  const response = await processMessage(userMessage, conversationHistory);
  
  // Save to conversation
  await saveConversation(message.from, userMessage, response);
  
  // Send response
  await client.sendMessage(message.from, response);
}

// Initialize WhatsApp client
client.initialize().catch(err => {
  console.error('Failed to initialize WhatsApp client:', err);
});

// API routes for admin
app.get('/', (req, res) => {
  res.send('Mental Health Coach WhatsApp Bot is running!');
});

// Route to set premium status (protected by API key)
app.post('/api/users/premium', (req, res) => {
  const apiKey = req.headers['x-api-key'];
  
  // Check if API key is valid
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const { userId, isPremium } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }
  
  // Set premium status
  setPremiumStatus(userId, isPremium === true)
    .then(() => {
      res.json({ success: true });
    })
    .catch(error => {
      console.error('Error setting premium status:', error);
      res.status(500).json({ error: 'Internal server error' });
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await client.destroy();
  process.exit(0);
}); 