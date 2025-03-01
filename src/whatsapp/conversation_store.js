/**
 * Conversation and user data store
 * In a production environment, this should be replaced with a database
 */

// In-memory storage for conversations
const conversations = new Map();

// In-memory storage for user data
const userData = new Map();

// Maximum number of messages to keep in history per user
const MAX_HISTORY_LENGTH = 10;

// Premium user max history length
const PREMIUM_MAX_HISTORY_LENGTH = 50;

/**
 * Save a message exchange to the conversation history
 * @param {string} userId - The user's WhatsApp ID
 * @param {string} userMessage - The message from the user
 * @param {string} botResponse - The response from the bot
 */
async function saveConversation(userId, userMessage, botResponse) {
  // Get existing conversation or create a new one
  const history = conversations.get(userId) || [];
  
  // Add new messages
  history.push({ role: 'user', content: userMessage });
  history.push({ role: 'assistant', content: botResponse });
  
  // Check for mood tracking data
  const moodRegex = /^(?:my mood is|i feel|i am feeling|mood)[:\s]*([1-9]|10)(?:\/10)?$/i;
  const moodMatch = userMessage.match(moodRegex);
  
  if (moodMatch) {
    const moodScore = parseInt(moodMatch[1]);
    saveMoodData(userId, moodScore);
  }
  
  // Get user data or create default
  const user = userData.get(userId) || { isPremium: false, lastActivity: Date.now() };
  
  // Update last activity
  user.lastActivity = Date.now();
  userData.set(userId, user);
  
  // Determine max history length based on premium status
  const maxLength = user.isPremium ? PREMIUM_MAX_HISTORY_LENGTH : MAX_HISTORY_LENGTH;
  
  // Trim history if it exceeds the maximum length
  if (history.length > maxLength * 2) {
    // Keep the most recent messages, but always keep the first system message if it exists
    const systemMessage = history[0].role === 'system' ? [history[0]] : [];
    const recentMessages = history.slice(-(maxLength * 2));
    conversations.set(userId, [...systemMessage, ...recentMessages]);
  } else {
    conversations.set(userId, history);
  }
}

/**
 * Save user mood data
 * @param {string} userId - The user's WhatsApp ID
 * @param {number} moodScore - The mood score (1-10)
 */
async function saveMoodData(userId, moodScore) {
  // Get user data or create default
  const user = userData.get(userId) || { 
    isPremium: false, 
    lastActivity: Date.now(),
    moodData: []
  };
  
  // Add mood data point
  if (!user.moodData) {
    user.moodData = [];
  }
  
  user.moodData.push({
    score: moodScore,
    timestamp: Date.now()
  });
  
  // Store updated user data
  userData.set(userId, user);
}

/**
 * Get user's mood history
 * @param {string} userId - The user's WhatsApp ID
 * @returns {Array} - Array of mood data points
 */
async function getMoodHistory(userId) {
  const user = userData.get(userId);
  return user && user.moodData ? user.moodData : [];
}

/**
 * Set premium status for a user
 * @param {string} userId - The user's WhatsApp ID
 * @param {boolean} isPremium - Whether the user is premium
 */
async function setPremiumStatus(userId, isPremium) {
  // Get user data or create default
  const user = userData.get(userId) || { 
    isPremium: false, 
    lastActivity: Date.now() 
  };
  
  // Update premium status
  user.isPremium = isPremium;
  
  // Store updated user data
  userData.set(userId, user);
}

/**
 * Check if user is premium
 * @param {string} userId - The user's WhatsApp ID
 * @returns {boolean} - Whether the user is premium
 */
async function isPremiumUser(userId) {
  const user = userData.get(userId);
  return user ? user.isPremium : false;
}

/**
 * Get conversation history for a user
 * @param {string} userId - The user's WhatsApp ID
 * @returns {Array} - Array of conversation messages
 */
async function getConversationHistory(userId) {
  return conversations.get(userId) || [];
}

/**
 * Clear conversation history for a user
 * @param {string} userId - The user's WhatsApp ID
 */
async function clearConversationHistory(userId) {
  conversations.delete(userId);
}

module.exports = {
  saveConversation,
  getConversationHistory,
  clearConversationHistory,
  saveMoodData,
  getMoodHistory,
  setPremiumStatus,
  isPremiumUser
}; 