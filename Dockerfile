# Usamos Node.js versión 22
FROM node:22-slim

# Instalamos dependencias necesarias para que WhatsApp funcione en Linux
RUN apt-get update && apt-get install -y \
    git \
    ffmpeg \
    imagemagick \
    && rm -rf /var/lib/apt/lists/*

# Creamos la carpeta de la app
WORKDIR /app

# Copiamos el package.json
COPY package.json .

# Instalamos las librerías (esto genera el lockfile automáticamente en la nube)
RUN npm install

# Copiamos el resto del código
COPY . .

# Comando para arrancar el bot
CMD ["node", "index.js"]
