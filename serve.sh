#!/bin/bash -xe

source ~/.nvm/nvm.sh

/usr/local/nginx/sbin/nginx
exec node --experimental-strip-types webpuppet/puppet_server.ts
