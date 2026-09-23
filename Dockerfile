FROM node:24-alpine
WORKDIR /app
COPY src ./src
COPY public ./public
USER node
ENV HOST=0.0.0.0 PORT=8080 STATIC_DIR=/app/public
EXPOSE 8080
CMD ["node", "src/server.mts"]
