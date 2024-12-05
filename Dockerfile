# Step 1: Use an official Node.js runtime as the base image
FROM node:18-alpine

# Step 2: Set the working directory inside the container
WORKDIR /app

# Step 3: Create secrets directory
RUN mkdir -p /app/secrets

# Step 4: Copy package.json and package-lock.json to install dependencies
COPY package*.json ./ 

# Step 5: Install dependencies
RUN npm install --legacy-peer-deps

# Step 6: Copy the service account key with a more robust approach
# Use wildcard to handle potential filename variations
COPY *serviceAccount*.json /app/secrets/serviceAccountKey.json

# Step 7: Copy the entire project directory into the container
COPY . . 

# Step 8: Copy the .env file into the container to make sure environment variables are available
COPY .env .env 

# Step 9: List contents of directories to verify files (useful for debugging)
RUN ls -la && echo "Secrets directory:" && ls -la /app/secrets

# Step 10: Expose the port the application runs on
EXPOSE 5000

# Step 11: Create a non-root user for security (optional but recommended)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Step 12: Set the default command to run the application
CMD ["npm", "start"]
