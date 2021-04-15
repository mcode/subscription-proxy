FROM node:14

# Create app directory
WORKDIR /usr/src/app
RUN npm install
COPY . .
EXPOSE 8080
CMD npm start
