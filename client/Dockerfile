# Use an official Node.js runtime as a parent image
FROM node:22

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json
# Copy the rest of the application code
COPY . .

# Make port 3000 available
EXPOSE 3000

# Run the command to start the development server
CMD ["/bin/sh", "-c", "rm -f package-lock.json && npm install && npm start"]