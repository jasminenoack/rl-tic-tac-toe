# Use an official Node.js runtime as a parent image
FROM node:22

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install any needed packages
RUN npm install

# Copy the rest of the application's code to the working directory
COPY . .

# Build the TypeScript code
RUN npm run build

# Make port 8080 available to the world outside this container
EXPOSE 8080

# Run the command to start the server
CMD ["npm", "start"]