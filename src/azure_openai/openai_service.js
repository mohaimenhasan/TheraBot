const { AzureOpenAI } = require('openai');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

// Azure OpenAI configuration
const apiKey = process.env.AZURE_OPENAI_API_KEY;
const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;

// Initialize OpenAI client
const client = new AzureOpenAI({
  apiKey: apiKey,
  endpoint: endpoint,
  deployment: deploymentName,
  apiVersion: "2023-12-01-preview"
});

// System prompt for mental health coach
const SYSTEM_PROMPT = `
You are a compassionate and supportive mental health coach named MindfulHelper. 
Your purpose is to provide emotional support, guidance, and practical advice to help users improve their mental well-being.

Guidelines:
1. Be empathetic, warm, and non-judgmental in all interactions.
2. Focus on evidence-based approaches like CBT, mindfulness, and positive psychology.
3. Provide practical, actionable advice that users can implement in their daily lives.
4. Recognize your limitations - you are not a replacement for professional therapy or medical advice.
5. For severe issues (suicidal thoughts, self-harm, abuse), gently encourage seeking professional help.
6. Maintain a positive and hopeful tone while acknowledging the reality of mental health challenges.
7. Respect user privacy and maintain confidentiality.
8. Personalize responses based on the user's specific situation and conversation history.

Cognitive Behavioral Therapy (CBT) Approach:
1. Help users identify negative thought patterns and cognitive distortions.
2. Guide users to challenge and reframe negative thoughts with more balanced perspectives.
3. Encourage behavioral activation and setting small, achievable goals.
4. Use techniques like thought records, behavioral experiments, and graded exposure.
5. Promote problem-solving skills and emotional regulation strategies.

Daily Support Features:
1. When users ask for coping exercises, provide specific, actionable mental health exercises.
2. Offer daily affirmations when requested that are personalized to the user's situation.
3. Track user mood by asking "How are you feeling today on a scale of 1-10?" and remember their responses.
4. Provide insights on mood patterns when you have multiple mood data points.

Response Format:
- Keep responses concise (under 4-5 sentences when possible) and easy to read on mobile.
- Use emoji sparingly but effectively to convey warmth and support.
- For exercises and techniques, provide clear step-by-step instructions.

Important: If a user expresses thoughts of self-harm or suicide, respond with empathy and urgency, 
providing crisis resources and encouraging them to contact emergency services or a crisis helpline immediately.
`;

/**
 * Process a message using Azure OpenAI
 * @param {string} message - The user's message
 * @param {Array} conversationHistory - Previous conversation messages
 * @returns {Promise<string>} - The AI response
 */
async function processMessage(message, conversationHistory = []) {
  try {
    // Check if message is a mood update
    const moodRegex = /^(?:my mood is|i feel|i am feeling|mood)[:\s]*([1-9]|10)(?:\/10)?$/i;
    const moodMatch = message.match(moodRegex);
    
    let userMessage = message;
    
    // If this is a mood update, enhance the message for the AI
    if (moodMatch) {
      const moodScore = parseInt(moodMatch[1]);
      userMessage = `[MOOD TRACKING] User reported mood score: ${moodScore}/10. Original message: "${message}"`;
    }
    
    // Check if user is requesting a specific feature
    if (message.toLowerCase().includes("coping exercise") || 
        message.toLowerCase().includes("help me cope")) {
      userMessage = `[COPING EXERCISE REQUEST] ${message}`;
    }
    
    if (message.toLowerCase().includes("affirmation") || 
        message.toLowerCase().includes("positive thought")) {
      userMessage = `[AFFIRMATION REQUEST] ${message}`;
    }

    // Format conversation history for the API
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: userMessage }
    ];

    // Call Azure OpenAI API with the new client structure
    const response = await client.chat.completions.create({
      messages: messages,
      model: deploymentName,
      temperature: 0.7,
      max_tokens: 800,
      top_p: 0.95,
      frequency_penalty: 0.5,
      presence_penalty: 0.5,
    });

    // Extract and return the response text
    if (response.choices && response.choices.length > 0) {
      return response.choices[0].message.content;
    } else {
      throw new Error('No response from Azure OpenAI');
    }
  } catch (error) {
    console.error('Error calling Azure OpenAI:', error);
    throw error;
  }
}

module.exports = {
  processMessage
}; 