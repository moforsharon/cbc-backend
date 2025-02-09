# Use a Node.js version that supports ReadableStream
FROM node:18

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy the rest of the application code
COPY . .

# Expose the port your server runs on
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
