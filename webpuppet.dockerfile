FROM public.ecr.aws/debian/debian:unstable

RUN apt-get update && \
  apt-get install -y --no-install-recommends \
  autotools-dev \
  build-essential \
  ca-certificates \
  chromium \
  curl \
  dumb-init \
  ffmpeg \
  fonts-liberation \
  git \
  libpcre2-dev \
  librsvg2-common \
  libx265-dev \
  libxml2-dev \
  man \
  publicsuffix \
  socat \
  tini \
  unzip \
  wget \
  xtrans-dev \
  xz-utils \
  zlib1g-dev \
  && \
  apt-get clean

WORKDIR /tmp

ENV NGINX_VERSION=1.27.3
RUN apt-get install -y libssl-dev && \
  wget https://nginx.org/download/nginx-${NGINX_VERSION}.tar.gz && \
  tar -xvf nginx-${NGINX_VERSION}.tar.gz && \
  git clone https://github.com/sergey-dryabzhinsky/nginx-rtmp-module && \
  cd nginx-${NGINX_VERSION} && \
  ./configure --add-module=../nginx-rtmp-module --with-http_ssl_module && \
  make -j4 && \
  make install && \
  rm -rf /tmp/*

# test it
RUN chromium --no-sandbox --temp-profile --headless --dump-dom https://www.google.com > /dev/null

RUN wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
RUN curl -fsSL https://bun.sh/install | bash

RUN bash -c 'source ~/.nvm/nvm.sh && nvm install v23'

ENV NVM_DIR="/root/.nvm"

WORKDIR /usr/local/puppet
RUN mkdir -p /usr/local/puppet

COPY package* /usr/local/puppet/
COPY bun.* /usr/local/puppet/

COPY serve.sh /usr/local/puppet/
# RUN bash -c ' source ~/.nvm/nvm.sh && npm install'
RUN bash -c 'source ~/.bashrc && bun install'

COPY webpuppet /usr/local/puppet/webpuppet
COPY nodets.sh /usr/local/puppet/

EXPOSE 7777/tcp

COPY nginx.conf /usr/local/nginx/conf/nginx.conf

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/puppet/nodets.sh"]

