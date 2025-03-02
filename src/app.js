const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');
const twilio = require('twilio');
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

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Twilio WhatsApp number
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER;

// Predefined commands
const COMMANDS = {
  HELP: '/help',
  UPGRADE: '/upgrade',
  MOOD_HISTORY: '/mood',
  CLEAR: '/clear',
  EXERCISE: '/exercise',
  AFFIRMATION: '/affirmation'
};

// API endpoint for incoming WhatsApp messages from Twilio
app.post('/api/whatsapp/incoming', async (req, res) => {
  try {
    console.log('Received incoming message from Twilio');
    
    // Extract message details from Twilio webhook
    const messageBody = req.body.Body;
    const from = req.body.From; // This will be in the format 'whatsapp:+1234567890'
    
    if (!messageBody || !from) {
      console.error('Missing message body or sender information');
      return res.status(400).send('Bad Request: Missing message parameters');
    }

    console.log('-------------------------------------------');
    console.log(`New message received: ${messageBody}`);
    console.log(`From: ${from}`);
    console.log('-------------------------------------------');

    // Create TwiML response
    const twiml = new twilio.twiml.MessagingResponse();
    
    // Process the message (similar to the previous WhatsApp Web.js implementation)
    try {
      // Handle commands
      if (messageBody.startsWith('/')) {
        await handleCommand(from, messageBody, twiml);
        return res.status(200).send(twiml.toString());
      }
      
      // Get user premium status
      const userIsPremium = await isPremiumUser(from);
      
      // Get conversation history
      const conversationHistory = await getConversationHistory(from);
      
      // Process message with Azure OpenAI with retry
      console.log('Processing message with Azure OpenAI...');
      
      const response = await retryOperation(
        async () => processMessage(messageBody, conversationHistory),
        3, // Max retries
        2000 // Base delay in ms
      );
      
      console.log('Received response from Azure OpenAI:', response.substring(0, 50) + '...');
      
      // Save the conversation
      await saveConversation(from, messageBody, response);
      
      // Send response back to user
      twiml.message(response);
      return res.status(200).send(twiml.toString());
      
    } catch (error) {
      console.error('Error processing message:', error);
      twiml.message('I apologize, but I encountered an error while processing your message. Please try again later.');
      return res.status(200).send(twiml.toString());
    }
  } catch (error) {
    console.error('Error handling incoming message:', error);
    return res.status(500).send('Internal Server Error');
  }
});

// Direct API for sending WhatsApp messages (useful for system-initiated messages)
async function sendWhatsAppMessage(to, message) {
  try {
    console.log(`Sending message to ${to}`);
    
    // Ensure the 'to' number is in the correct format for Twilio WhatsApp
    const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    
    // Send message using Twilio client
    const result = await twilioClient.messages.create({
      from: twilioWhatsAppNumber,
      to: formattedTo,
      body: message
    });
    
    console.log(`Message sent successfully, SID: ${result.sid}`);
    return result;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    throw error;
  }
}

// Handle commands
async function handleCommand(userId, messageBody, twiml = null) {
  console.log(`Processing command: ${messageBody}`);
  
  try {
    const command = messageBody.trim().toLowerCase();
    
    if (command.startsWith(COMMANDS.HELP)) {
      const helpMessage = await sendHelpMessage(userId);
      if (twiml) {
        twiml.message(helpMessage);
      } else {
        await sendWhatsAppMessage(userId, helpMessage);
      }
    } 
    else if (command.startsWith(COMMANDS.UPGRADE)) {
      const upgradeInfo = await sendUpgradeInfo(userId);
      if (twiml) {
        twiml.message(upgradeInfo);
      } else {
        await sendWhatsAppMessage(userId, upgradeInfo);
      }
    }
    else if (command.startsWith(COMMANDS.MOOD_HISTORY)) {
      const moodHistory = await sendMoodHistory(userId);
      if (twiml) {
        twiml.message(moodHistory);
      } else {
        await sendWhatsAppMessage(userId, moodHistory);
      }
    }
    else if (command.startsWith(COMMANDS.CLEAR)) {
      await clearConversationHistory(userId);
      const clearMessage = "Your conversation history has been cleared. We're starting fresh! 🌱";
      if (twiml) {
        twiml.message(clearMessage);
      } else {
        await sendWhatsAppMessage(userId, clearMessage);
      }
    }
    else if (command.startsWith(COMMANDS.EXERCISE)) {
      const exerciseResponse = await handleExerciseRequest({ from: userId, body: messageBody });
      if (twiml) {
        twiml.message(exerciseResponse);
      } else {
        await sendWhatsAppMessage(userId, exerciseResponse);
      }
    }
    else if (command.startsWith(COMMANDS.AFFIRMATION)) {
      const affirmationResponse = await handleAffirmationRequest({ from: userId, body: messageBody });
      if (twiml) {
        twiml.message(affirmationResponse);
      } else {
        await sendWhatsAppMessage(userId, affirmationResponse);
      }
    }
    else {
      const unknownCommandMessage = "I don't recognize that command. Type /help for a list of available commands.";
      if (twiml) {
        twiml.message(unknownCommandMessage);
      } else {
        await sendWhatsAppMessage(userId, unknownCommandMessage);
      }
    }
  } catch (error) {
    console.error('Error handling command:', error);
    const errorMessage = "I encountered an error while processing your command. Please try again later.";
    if (twiml) {
      twiml.message(errorMessage);
    } else {
      await sendWhatsAppMessage(userId, errorMessage);
    }
  }
}

// Help message function
async function sendHelpMessage(userId) {
  const helpMessage = `
*MindfulHelper Commands* 📱

/help - Show this help message
/clear - Clear your conversation history
/mood - View your mood history
/exercise - Get a coping exercise
/affirmation - Get a positive affirmation
/upgrade - Learn about premium features

You can also just chat with me normally about anything that's on your mind. I'm here to support you! 💙
  `;
  
  return helpMessage;
}

// Upgrade info function
async function sendUpgradeInfo(userId) {
  // Check if already premium
  const isPremium = await isPremiumUser(userId);
  
  if (isPremium) {
    return `
You're already a premium user! 🌟

Premium benefits you're enjoying:
• Extended conversation history (50 vs 10 messages)
• Priority response during peak times
• Advanced mood tracking insights
• Custom exercise recommendations

Thank you for your support! 💙
    `;
  } else {
    return `
*Upgrade to Premium* ✨

Benefits:
• Extended conversation history (50 vs 10 messages)
• Priority response during peak times
• Advanced mood tracking insights
• Custom exercise recommendations

To upgrade, please visit our website: www.mindfulhelper.com/upgrade
    `;
  }
}

// Mood history function
async function sendMoodHistory(userId) {
  const moodData = await getMoodHistory(userId);
  
  if (!moodData || moodData.length === 0) {
    return "You haven't shared any mood data yet. You can track your mood by telling me 'My mood is [1-10]' anytime.";
  }
  
  // Sort mood data by timestamp
  const sortedMoodData = [...moodData].sort((a, b) => a.timestamp - b.timestamp);
  
  // Format the mood history
  let moodHistoryText = "*Your Mood History* 📊\n\n";
  
  sortedMoodData.slice(-10).forEach((entry) => {
    const date = new Date(entry.timestamp);
    const formattedDate = `${date.getMonth() + 1}/${date.getDate()}`;
    const emoji = getMoodEmoji(entry.score);
    
    moodHistoryText += `${formattedDate}: ${entry.score}/10 ${emoji}\n`;
  });
  
  return moodHistoryText;
}

// Get emoji based on mood score
function getMoodEmoji(score) {
  if (score >= 9) return "😁";
  if (score >= 7) return "😊";
  if (score >= 5) return "😐";
  if (score >= 3) return "😔";
  return "😢";
}

// Exercise request handler
async function handleExerciseRequest(message) {
  const conversationHistory = await getConversationHistory(message.from);
  
  // Add a specific instruction for the AI to provide an exercise
  const response = await processMessage("[EXERCISE REQUEST] Please provide a helpful mental health coping exercise", conversationHistory);
  
  // Save this interaction to conversation history
  await saveConversation(message.from, message.body, response);
  
  return response;
}

// Affirmation request handler
async function handleAffirmationRequest(message) {
  const conversationHistory = await getConversationHistory(message.from);
  
  // Add a specific instruction for the AI to provide an affirmation
  const response = await processMessage("[AFFIRMATION REQUEST] Please provide a positive and supportive affirmation", conversationHistory);
  
  // Save this interaction to conversation history
  await saveConversation(message.from, message.body, response);
  
  return response;
}

// Admin API to set a user's premium status
app.post('/api/admin/set-premium', async (req, res) => {
  const { apiKey, userId, isPremium } = req.body;
  
  // Validate admin API key
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
  }
  
  try {
    await setPremiumStatus(userId, isPremium);
    return res.status(200).json({ success: true, message: `Premium status for ${userId} set to ${isPremium}` });
  } catch (error) {
    console.error('Error setting premium status:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'mental-health-coach' });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Twilio WhatsApp number: ${twilioWhatsAppNumber}`);
  console.log(`Twilio webhook URL: [your-domain]/api/whatsapp/incoming`);
});

// Export functions for testing
module.exports = {
  app,
  sendWhatsAppMessage,
  handleCommand
}; 