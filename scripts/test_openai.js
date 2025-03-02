/**
 * Test script for Azure OpenAI
 * 
 * This script tests the connection to Azure OpenAI and makes sure it's working properly
 * without needing to go through WhatsApp.
 */

const { AzureOpenAI } = require('openai');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Azure OpenAI configuration
const apiKey = process.env.AZURE_OPENAI_API_KEY;
const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;

// System prompt for mental health coach (simplified for testing)
const SYSTEM_PROMPT = `
You are a compassionate and supportive mental health coach named MindfulHelper. 
Your purpose is to provide emotional support, guidance, and practical advice to help users improve their mental well-being.

Keep responses concise and empathetic.
`;

async function testOpenAI() {
  try {
    console.log('Initializing Azure OpenAI client with:');
    console.log(`- Endpoint: ${endpoint}`);
    console.log(`- Deployment: ${deploymentName}`);
    
    // Create Azure OpenAI client
    const client = new AzureOpenAI({
      apiKey: apiKey,
      endpoint: endpoint,
      deployment: deploymentName,
      apiVersion: "2023-12-01-preview"
    });
    
    console.log('\nSending test message to Azure OpenAI...');
    
    // Call Azure OpenAI API
    const response = await client.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: "Hello, I'm feeling anxious today. Can you help me?" }
      ],
      model: deploymentName,
      temperature: 0.7,
      max_tokens: 300
    });
    
    console.log('\n✅ Received response from Azure OpenAI!');
    console.log('\nResponse:');
    console.log(response.choices[0].message.content);
    
    console.log('\nToken usage:');
    console.log(`- Prompt tokens: ${response.usage.prompt_tokens}`);
    console.log(`- Completion tokens: ${response.usage.completion_tokens}`);
    console.log(`- Total tokens: ${response.usage.total_tokens}`);
    
    return true;
  } catch (error) {
    console.error('\n❌ Error calling Azure OpenAI:', error);
    
    // Provide more specific error debugging
    if (error.message.includes('API key')) {
      console.error('\nAPI key error - Check your AZURE_OPENAI_API_KEY in .env');
    } else if (error.message.includes('endpoint')) {
      console.error('\nEndpoint error - Check your AZURE_OPENAI_ENDPOINT in .env');
    } else if (error.message.includes('deployment') || error.message.includes('model')) {
      console.error('\nDeployment error - Check your AZURE_OPENAI_DEPLOYMENT_NAME in .env');
    }
    
    return false;
  }
}

// Run the test
testOpenAI().then(success => {
  if (success) {
    console.log('\n✅ Azure OpenAI test completed successfully!');
  } else {
    console.error('\n❌ Azure OpenAI test failed. Please check the error messages above.');
  }
}); 