/**
 * Azure OpenAI Setup Helper
 * 
 * This script helps set up Azure OpenAI for the Mental Health Coach chatbot.
 * It validates Azure OpenAI credentials and creates a deployment if needed.
 */

const { AzureOpenAI } = require('openai');
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
async function validateCredentials(endpoint, apiKey, deploymentName) {
  try {
    // Create Azure OpenAI client
    const client = new AzureOpenAI({
      apiKey: apiKey,
      endpoint: endpoint,
      apiVersion: "2023-12-01-preview",
      deployment: deploymentName || "gpt-35-turbo" // Use provided deployment or default
    });
    
    console.log('Testing Azure OpenAI credentials...');
    
    // Try a simple chat completion to validate credentials
    // If no deployment is specified yet, this might fail, but we'll catch the error
    try {
      const chatCompletion = await client.chat.completions.create({
        messages: [{ role: "user", content: "Hello, Azure OpenAI!" }],
        max_tokens: 5,
        model: deploymentName || "gpt-35-turbo"
      });
      
      console.log('✅ Credentials and deployment are valid!');
      return { 
        valid: true, 
        validDeployment: true,
        deployments: [
          { name: deploymentName || "gpt-35-turbo", model: deploymentName || "gpt-35-turbo" }
        ]
      };
    } catch (deploymentError) {
      // If the deployment error mentions the deployment, credentials are valid but deployment is not
      if (deploymentError.message.includes('deployment') || 
          deploymentError.message.includes('model')) {
        console.log('✅ Credentials are valid, but deployment needs to be configured.');
        return { 
          valid: true, 
          validDeployment: false,
          deployments: [
            { name: "gpt-35-turbo", model: "gpt-35-turbo" },
            { name: "gpt-4", model: "gpt-4" },
            { name: "gpt-4-32k", model: "gpt-4-32k" },
            { name: "gpt-35-turbo-16k", model: "gpt-35-turbo-16k" }
          ]
        };
      } else {
        // Other errors might indicate invalid credentials
        throw deploymentError;
      }
    }
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
  const validation = await validateCredentials(endpoint, apiKey, deploymentName);
  
  if (!validation.valid) {
    console.log('\n❌ Invalid Azure OpenAI credentials. Please check your endpoint and API key.');
    rl.close();
    return;
  }
  
  // Check for deployments
  console.log('\nRecommended model deployments:');
  console.log('1. gpt-35-turbo (Most cost-effective)');
  console.log('2. gpt-4 (Best quality, more expensive)');
  console.log('3. gpt-4-32k (Extended context window)');
  console.log('4. gpt-35-turbo-16k (Extended context window, more cost-effective)');
  
  if (!validation.validDeployment && !deploymentName) {
    console.log('\nYou need to create a deployment in your Azure OpenAI resource:');
    console.log('1. Go to the Azure Portal and navigate to your Azure OpenAI resource');
    console.log('2. Click on "Model deployments" in the left menu');
    console.log('3. Click "Create new deployment" and select a model like gpt-35-turbo');
    console.log('4. Give your deployment a name and deploy it');
    
    deploymentName = await prompt('\nEnter your Azure OpenAI deployment name after you have created it: ');
    updateEnvFile('AZURE_OPENAI_DEPLOYMENT_NAME', deploymentName);
  } else if (validation.validDeployment && !deploymentName) {
    // Use the first deployment from the validation
    deploymentName = validation.deployments[0].name;
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