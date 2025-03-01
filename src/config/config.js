const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

// Configuration object
const config = {
  // Server configuration
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost'
  },
  
  // Azure OpenAI configuration
  azureOpenAI: {
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2023-05-15'
  },
  
  // WhatsApp configuration
  whatsapp: {
    sessionDataPath: process.env.WHATSAPP_SESSION_DATA_PATH || './session_data'
  },
  
  // Azure Communication Services (for production WhatsApp integration)
  azureCommunication: {
    connectionString: process.env.AZURE_COMMUNICATION_CONNECTION_STRING,
    whatsappPhoneNumber: process.env.AZURE_COMMUNICATION_WHATSAPP_PHONE_NUMBER
  }
};

// Validate required configuration
function validateConfig() {
  const requiredVars = [
    'azureOpenAI.apiKey',
    'azureOpenAI.endpoint',
    'azureOpenAI.deploymentName'
  ];
  
  const missingVars = requiredVars.filter(varPath => {
    const parts = varPath.split('.');
    let current = config;
    for (const part of parts) {
      if (!current[part]) return true;
      current = current[part];
    }
    return false;
  });
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
}

module.exports = {
  config,
  validateConfig
}; 