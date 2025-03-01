# Deployment Guide

This guide will help you deploy the Mental Health Coach WhatsApp chatbot using Azure services.

## Prerequisites

1. Azure account with active subscription
2. Access to Azure OpenAI service
3. WhatsApp account
4. Node.js (v14 or higher) installed

## Step 1: Set Up Azure OpenAI

1. **Create an Azure OpenAI resource**:
   - Go to the Azure portal (https://portal.azure.com)
   - Search for "Azure OpenAI" and create a new resource
   - Select your subscription, resource group, region, and name
   - Click "Review + create" and then "Create"

2. **Deploy a model**:
   - Navigate to your Azure OpenAI resource
   - Go to "Model deployments"
   - Click "Create new deployment"
   - Select a model (e.g., "gpt-35-turbo" or "gpt-4")
   - Give it a deployment name (you'll need this for your .env file)
   - Click "Create"

3. **Get API credentials**:
   - In your Azure OpenAI resource, go to "Keys and Endpoint"
   - Copy the endpoint and one of the keys
   - You'll need these for your .env file

## Step 2: Configure the Application

1. **Clone the repository** (if you haven't already)

2. **Create a .env file**:
   - Copy the `.env.example` file to `.env`
   - Fill in the required values:
     ```
     AZURE_OPENAI_API_KEY=your_azure_openai_key
     AZURE_OPENAI_ENDPOINT=your_azure_openai_endpoint
     AZURE_OPENAI_DEPLOYMENT_NAME=your_deployment_name
     ```

3. **Install dependencies**:
   ```
   npm install
   ```

## Step 3: Development Deployment

For development and testing, you can run the application locally:

1. **Start the application**:
   ```
   npm start
   ```

2. **Link WhatsApp**:
   - When the application starts, it will display a QR code in the terminal
   - Open WhatsApp on your phone
   - Go to Settings > Linked Devices
   - Scan the QR code

3. **Test the chatbot**:
   - Send a message to your WhatsApp account from another phone
   - The chatbot should respond based on the Azure OpenAI model

## Step 4: Production Deployment (Optional)

For a production deployment, you have several options:

### Option 1: Azure App Service

1. **Create an App Service**:
   - In the Azure portal, create a new App Service
   - Select Node.js as the runtime stack

2. **Deploy your code**:
   - Set up deployment from GitHub or use Azure CLI
   - Configure environment variables in the App Service Configuration

3. **Configure WhatsApp**:
   - For production, consider using the WhatsApp Business API or Azure Communication Services

### Option 2: Azure Container Apps

1. **Containerize your application**:
   - Create a Dockerfile
   - Build and push the container to Azure Container Registry

2. **Deploy to Container Apps**:
   - Create a new Container App
   - Configure it to use your container image
   - Set environment variables

## Step 5: Monitoring and Scaling

1. **Set up Application Insights** for monitoring
2. **Configure scaling rules** based on your expected traffic
3. **Implement logging** for troubleshooting

## Cost Management

With your $200 monthly Azure credits:

1. **Azure OpenAI costs**:
   - Pay-as-you-go based on token usage
   - Monitor usage to stay within budget
   - Consider implementing token limits per user

2. **Hosting costs**:
   - App Service: Basic tier (~$15/month)
   - Container Apps: Consumption-based pricing

3. **Other services**:
   - Application Insights: Free tier for basic monitoring
   - Azure Communication Services (if used): Pay-as-you-go

## Security Considerations

1. **Store sensitive information** in Azure Key Vault
2. **Implement rate limiting** to prevent abuse
3. **Set up proper authentication** for any admin interfaces
4. **Regularly update dependencies** to address security vulnerabilities 