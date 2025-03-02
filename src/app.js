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

// Utility function for retrying operations with exponential backoff
async function retryOperation(operation, maxRetries = 3, baseDelay = 1000) {
  let retries = 0;
  let lastError;

  while (retries < maxRetries) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      retries++;
      console.error(`Operation failed (attempt ${retries}/${maxRetries}):`, error.message);
      
      if (retries >= maxRetries) {
        break;
      }
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, retries - 1) * (0.5 + Math.random() * 0.5);
      console.log(`Retrying in ${Math.round(delay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Initialize Express app
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize WhatsApp client
const client = new Client({
  puppeteer: {
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
      '--ignore-certificate-errors',
      '--ignore-certificate-errors-spki-list',
      '--disable-web-security',
      '--disable-features=site-per-process',
      '--allow-running-insecure-content',
      '--enable-features=NetworkService',
      // Additional args for stability
      '--disable-extensions',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-component-extensions-with-background-pages',
      '--disable-hang-monitor',
      '--disable-prompt-on-repost',
      '--disable-client-side-phishing-detection',
      '--metrics-recording-only',
      '--no-default-browser-check',
      '--password-store=basic'
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    // Add timeout settings
    defaultViewport: null,
    timeout: 180000, // Increase timeout to 3 minutes
    protocolTimeout: 180000, // Protocol timeout
  },
  authStrategy: new LocalAuth(),
  webVersion: '2.3000.1020521505',
  webVersionCache: {
    type: 'none'
  },
  // Improved client options
  qrMaxRetries: 5,
  restartOnAuthFail: true,
  takeoverOnConflict: true,
  killClientOnLogout: true,
  disableSpins: true, // Reduce console noise
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
});

// Additional logging for puppeteer
let browser;
let isDisconnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;

// Wait for client to be ready before accessing browser
client.on('ready', async () => {
  console.log('WhatsApp client is ready');
  reconnectAttempts = 0; // Reset reconnect attempts on successful connection
  
  // Get browser instance
  try {
    browser = await client.pupPage.browser();
    console.log('Puppeteer browser reference acquired');
    
    browser.on('disconnected', () => {
      console.log('Puppeteer browser disconnected');
      // Set flag for watchdog
      isDisconnected = true;
    });
  } catch (error) {
    console.error('Failed to get browser reference:', error);
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

// Add additional event handlers for better diagnostics
client.on('auth_failure', msg => {
  console.error('AUTHENTICATION FAILURE:', msg);
  // Don't immediately restart on auth failure - this can cause a loop
});

client.on('disconnected', (reason) => {
  console.log('Client was disconnected:', reason);
  
  reconnectAttempts++;
  if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
    console.error(`Exceeded maximum reconnection attempts (${MAX_RECONNECT_ATTEMPTS}). Please restart the application manually.`);
    return;
  }
  
  console.log(`Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
  
  // Use increasing delays for reconnection attempts
  const delay = 5000 * Math.pow(2, reconnectAttempts - 1);
  console.log(`Waiting ${delay/1000} seconds before reconnection...`);
  
  setTimeout(() => {
    // Close browser if it exists
    if (browser) {
      try {
        browser.close().catch(err => console.log('Error closing browser:', err.message));
      } catch (err) {
        console.log('Error during browser close attempt:', err.message);
      }
    }
    
    // Reinitialize client
    try {
      client.initialize().catch(err => {
        console.error('Failed to reinitialize client:', err.message);
      });
    } catch (err) {
      console.error('Exception during client reinitialization:', err.message);
    }
  }, delay);
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
  console.log('Message event triggered');  // Debugging log
  console.log(`Received message from: ${message.from}`);
  console.log(`Message content: ${message.body}`);

  // Check for status broadcasts first
  if (message.from === 'status@broadcast') {
    // Simple minimal logging for status broadcasts
    console.log(`[Status Update] Skipped broadcast from ${message._data.author || 'unknown'}`);
    return;
  }
  
  // Only log detailed information for non-status messages
  console.log('-------------------------------------------');
  console.log(`New message received: ${message.body}`);
  console.log(`From: ${message.from}, Author: ${message._data.author || 'N/A'}`);
  console.log(`Type: ${message.type}, isGroup: ${message.isGroup}, fromMe: ${message.fromMe}`);
  console.log(`ID: ${message.id.id}`);
  console.log('-------------------------------------------');
  
  try {    
    // Handle commands
    if (message.body.startsWith('/')) {
      await handleCommand(message);
      return;
    }
    
    // Get user premium status
    const userIsPremium = await isPremiumUser(message.from);
    
    // Get conversation history
    const conversationHistory = await getConversationHistory(message.from);
    
    // Process message with Azure OpenAI with retry
    console.log('Processing message with Azure OpenAI...');
    
    const response = await retryOperation(
      async () => processMessage(message.body, conversationHistory),
      3, // Max retries
      2000 // Base delay in ms
    );
    
    console.log('Received response from Azure OpenAI:', response.substring(0, 50) + '...');
    
    // Save the conversation
    await saveConversation(message.from, message.body, response);
    
    // Send response back to user with retry
    console.log(`Sending response to ${message.from}`);
    await retryOperation(
      async () => client.sendMessage(message.from, response),
      3, // Max retries
      1000 // Base delay in ms
    );
    
    console.log(`Response sent to ${message.from}: ${response.substring(0, 50)}...`);
  } catch (error) {
    console.error('Error processing message:', error);
    try {
      await retryOperation(
        async () => client.sendMessage(
          message.from, 
          "I'm sorry, I'm having trouble processing your message right now. Please try again later."
        ),
        2 // Max retries
      );
    } catch (sendError) {
      console.error('Failed to send error message after all retries:', sendError);
    }
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

// Initialize WhatsApp client with proper error handling
async function initializeWhatsAppClient() {
  console.log('Initializing WhatsApp client...');
  
  try {
    await client.initialize();
    console.log('WhatsApp client initialization completed');
  } catch (err) {
    console.error('Failed to initialize WhatsApp client:', err.message);
    
    // Attempt recovery after a delay
    console.log('Attempting to reinitialize in 10 seconds...');
    setTimeout(() => {
      try {
        // Ensure browser is closed if it exists
        if (browser) {
          browser.close().catch(err => console.log('Error closing browser:', err.message));
        }
        
        // Try initialization again
        client.initialize().catch(initError => {
          console.error('Reinitialization failed:', initError.message);
          console.log('Please restart the application manually.');
        });
      } catch (initError) {
        console.error('Exception during reinitialization:', initError.message);
      }
    }, 10000);
  }
}

// Start the client initialization
initializeWhatsAppClient();

// Browser connection watchdog - improved version
const checkBrowserConnection = async () => {
  try {
    if (!browser) {
      // Skip if browser not initialized
      return;
    }

    let isConnected = false;
    try {
      isConnected = browser.isConnected();
    } catch (error) {
      console.log('Error checking browser connection:', error.message);
      isConnected = false;
    }

    if (isConnected) {
      if (isDisconnected) {
        console.log('Browser reconnected successfully');
        isDisconnected = false;
      }
    } else {
      console.log('Browser disconnected, attempting to reinitialize client');
      isDisconnected = true;
      
      // Only try to reinitialize if we haven't exceeded max attempts
      if (reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log(`Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
        
        try {
          await client.destroy();
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
          client.initialize().catch(err => console.error('Error during reinitialization:', err.message));
        } catch (error) {
          console.error('Error reinitializing client:', error.message);
        }
      } else {
        console.log('Maximum reconnection attempts reached. Please restart the application manually.');
      }
    }
  } catch (error) {
    console.error('Error in browser connection watchdog:', error.message);
  }
};

// Run the connection check every 5 minutes
setInterval(checkBrowserConnection, 5 * 60 * 1000);

// API routes for admin
app.get('/', (req, res) => {
  res.send('Mental Health Coach WhatsApp Bot is running!');
});

// Add a test route for Azure OpenAI
app.get('/test-openai', async (req, res) => {
  try {
    console.log('Testing Azure OpenAI connection...');
    const testResponse = await processMessage('Hello, can you help me with my anxiety?', []);
    res.json({ 
      success: true, 
      message: 'Azure OpenAI is working properly', 
      response: testResponse 
    });
  } catch (error) {
    console.error('Error testing Azure OpenAI:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Azure OpenAI test failed', 
      error: error.message 
    });
  }
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