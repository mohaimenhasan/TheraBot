/**
 * Azure OpenAI Setup Helper
 * 
 * This script helps set up Azure OpenAI for the Mental Health Coach chatbot.
 * It validates Azure OpenAI credentials and creates a deployment if needed.
 */

const { OpenAIClient, AzureKeyCredential } = require('@azure/openai');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Function to prompt for input
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Function to validate Azure OpenAI credentials
async function validateCredentials(endpoint, apiKey) {
  try {
    const client = new OpenAIClient(endpoint, new AzureKeyCredential(apiKey));
    
    // Try to list deployments to validate credentials
    console.log('Testing Azure OpenAI credentials...');
    const deployments = await client.listDeployments();
    
    console.log('✅ Credentials are valid!');
    return { valid: true, deployments: deployments };
  } catch (error) {
    console.error('❌ Error validating credentials:', error.message);
    return { valid: false, error: error.message };
  }
}

// Function to check if a model is deployed
function isModelDeployed(deployments, modelName) {
  if (!deployments) return false;
  
  for (const deployment of deployments) {
    if (deployment.model === modelName) {
      return deployment.name;
    }
  }
  
  return false;
}

// Function to update .env file
function updateEnvFile(key, value) {
  const envPath = path.join(__dirname, '..', '.env');
  
  // Read current .env file or create new if not exists
  let envContent = '';
  try {
    envContent = fs.readFileSync(envPath, 'utf8');
  } catch (error) {
    // File doesn't exist, create empty content
    envContent = '';
  }
  
  // Check if key already exists
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(envContent)) {
    // Update existing key
    envContent = envContent.replace(regex, `${key}=${value}`);
  } else {
    // Add new key
    envContent += `\n${key}=${value}`;
  }
  
  // Write updated content back to file
  fs.writeFileSync(envPath, envContent);
  console.log(`Updated ${key} in .env file`);
}

async function main() {
  console.log('🧠 Azure OpenAI Setup Helper for Mental Health Coach 🧠\n');
  
  // Check if .env file exists
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    // Create .env file from .env.example
    const examplePath = path.join(__dirname, '..', '.env.example');
    if (fs.existsSync(examplePath)) {
      fs.copyFileSync(examplePath, envPath);
      console.log('Created .env file from .env.example');
    } else {
      fs.writeFileSync(envPath, '# Mental Health Coach Environment Variables\n');
      console.log('Created new .env file');
    }
  }
  
  // Get Azure OpenAI credentials
  let endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  let apiKey = process.env.AZURE_OPENAI_API_KEY;
  let deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
  
  // Prompt for credentials if not in .env
  if (!endpoint) {
    endpoint = await prompt('Enter your Azure OpenAI endpoint (https://your-resource-name.openai.azure.com/): ');
    updateEnvFile('AZURE_OPENAI_ENDPOINT', endpoint);
  }
  
  if (!apiKey) {
    apiKey = await prompt('Enter your Azure OpenAI API key: ');
    updateEnvFile('AZURE_OPENAI_API_KEY', apiKey);
  }
  
  // Validate credentials
  const validation = await validateCredentials(endpoint, apiKey);
  
  if (!validation.valid) {
    console.log('\n❌ Invalid Azure OpenAI credentials. Please check your endpoint and API key.');
    rl.close();
    return;
  }
  
  // Check for deployments
  console.log('\nAvailable model deployments:');
  const deployments = validation.deployments;
  
  if (deployments.length === 0) {
    console.log('No deployments found. You need to create a deployment in the Azure portal.');
    console.log('Recommended models: gpt-35-turbo or gpt-4');
  } else {
    deployments.forEach((deployment, index) => {
      console.log(`${index + 1}. ${deployment.name} (${deployment.model})`);
    });
    
    // Check if we need gpt-4 or gpt-35-turbo
    const gpt4Deployment = isModelDeployed(deployments, 'gpt-4');
    const gpt35Deployment = isModelDeployed(deployments, 'gpt-35-turbo');
    
    if (gpt4Deployment) {
      console.log('\n✅ GPT-4 deployment found! This is recommended for best results.');
      
      if (!deploymentName) {
        deploymentName = gpt4Deployment;
        updateEnvFile('AZURE_OPENAI_DEPLOYMENT_NAME', deploymentName);
      }
    } else if (gpt35Deployment) {
      console.log('\n✅ GPT-3.5 Turbo deployment found! This will work well for the chatbot.');
      
      if (!deploymentName) {
        deploymentName = gpt35Deployment;
        updateEnvFile('AZURE_OPENAI_DEPLOYMENT_NAME', deploymentName);
      }
    } else {
      console.log('\n⚠️ No GPT-4 or GPT-3.5 Turbo deployments found.');
      console.log('Please create a deployment in the Azure portal or select another deployment.');
    }
  }
  
  // Prompt for deployment name if not set
  if (!deploymentName) {
    deploymentName = await prompt('\nEnter your Azure OpenAI deployment name: ');
    updateEnvFile('AZURE_OPENAI_DEPLOYMENT_NAME', deploymentName);
  }
  
  console.log('\n✅ Setup complete! Azure OpenAI is configured for the Mental Health Coach.');
  console.log('- Endpoint:', endpoint);
  console.log('- Deployment Name:', deploymentName);
  
  // Remind about Azure credits usage
  console.log('\n💡 Usage Tips:');
  console.log('- Monitor your Azure OpenAI usage to stay within your $200 monthly credits');
  console.log('- Consider implementing token limits per user if needed');
  console.log('- For production, migrate to a database instead of in-memory storage');
  
  rl.close();
}

main().catch(error => {
  console.error('Error in setup script:', error);
  rl.close();
}); 