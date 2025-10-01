# Base image for Node.js
FROM node:14-alpine

# Set the working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the application code
COPY . /app

# Expose the port
EXPOSE 3002

# Command to start the server
CMD ["npm", "start"]



