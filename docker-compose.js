version: '3'
services:
  bot:
    build: .
    environment:
      - TOKEN=${TOKEN}
      - REDIS_URL=redis://redis
    depends_on:
      - redis

  redis:
    image: redis:alpine
    volumes:
      - redis_data:/data

  dashboard:
    image: nginx
    ports:
      - "80:80"
    volumes:
      - ./dashboard:/usr/share/nginx/html

volumes:
  redis_data:
