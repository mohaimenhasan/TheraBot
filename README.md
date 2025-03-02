# Mental Health Coach WhatsApp Chatbot

A WhatsApp chatbot that serves as a mental health coach, built using Azure OpenAI and Twilio's WhatsApp API. This AI-powered chatbot provides mental health support, coping strategies based on Cognitive Behavioral Therapy (CBT), and mood tracking.

## Features

### Core Features
- **Mental Health Support**: Provides compassionate, evidence-based mental health guidance and support
- **CBT-Based Therapy**: Uses Cognitive Behavioral Therapy principles to help identify and reframe negative thought patterns
- **Mood Tracking**: Tracks user mood over time and provides insights on patterns
- **Daily Coping Exercises**: Suggests actionable exercises for managing stress, anxiety, and other challenges
- **Positive Affirmations**: Delivers personalized positive affirmations to boost mental well-being

### Technical Features
- **Twilio WhatsApp API Integration**: Reliable WhatsApp communication through Twilio's platform
- **Azure OpenAI Integration**: Powered by Azure OpenAI for natural, empathetic conversations
- **Conversation Memory**: Maintains conversation context for more helpful responses
- **Command System**: Useful commands for accessing features like mood history
- **Premium User Support**: Enhanced features for premium subscribers

## Prerequisites

- Azure account with OpenAI access
- Azure subscription with at least $200 monthly credits
- Twilio account with WhatsApp API access
- Node.js environment (v14 or higher)

## Monetization Options

This chatbot includes built-in support for the following monetization strategies:

1. **Freemium Model**:
   - Basic version: Free access to mental health conversations and basic coping exercises
   - Premium version: Extended conversation history, detailed mood tracking, and advanced features

2. **Corporate Wellness Packages**:
   - API for managing multiple users
   - Admin dashboard for employee wellness tracking (requires additional implementation)
   - Bulk user management for corporate clients

3. **Professional Therapist Referrals**:
   - Integration points available for referring users to professional therapy
   - Can be configured to connect with real therapists through a partnership program

## Quick Start

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Copy `.env.example` to `.env` and update with your Azure OpenAI and Twilio credentials
4. Start the application:
   ```
   npm start
   ```
5. Set up a Twilio webhook pointing to your application's `/api/whatsapp/incoming` endpoint
6. Test your bot by sending a message to your Twilio WhatsApp number

## Setting Up Twilio WhatsApp

1. Sign up for a Twilio account at [https://www.twilio.com](https://www.twilio.com)
2. Activate the Twilio Sandbox for WhatsApp in your Twilio console
3. Add your Twilio account SID, auth token, and WhatsApp number to your `.env` file
4. Configure the webhook URL in Twilio to point to your application's `/api/whatsapp/incoming` endpoint
5. Follow Twilio's instructions to connect your WhatsApp number to the sandbox

## User Commands

Users can interact with the chatbot using the following commands:

- `/help` - Show all available commands
- `/mood` - View mood history and trends
- `/exercise` - Get a random coping exercise
- `/affirmation` - Receive a positive affirmation
- `/upgrade` - Learn about premium features
- `/clear` - Clear conversation history

Users can also track their mood by sending messages like "My mood is 7/10" or request specific help with phrases like "I need help with anxiety" or "Give me a coping exercise for stress."

## CBT Approach

The chatbot implements Cognitive Behavioral Therapy principles:

1. **Identifying Negative Thoughts**: Helps users recognize unhelpful thinking patterns
2. **Challenging Distortions**: Guides users to question and reframe irrational thoughts
3. **Behavioral Activation**: Encourages small positive actions to improve mood
4. **Coping Strategies**: Provides evidence-based techniques for managing difficult emotions
5. **Positive Reinforcement**: Acknowledges and encourages progress

## Production Deployment

For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Security and Privacy

- All conversations are private and secure
- Data is stored in memory by default (production deployments should use a database)
- No personal information is shared with third parties
- Users can clear their conversation history at any time

## License

MIT 