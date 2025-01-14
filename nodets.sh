#!/bin/bash
source ~/.nvm/nvm.sh
/usr/local/nginx/sbin/nginx
exec node --experimental-strip-types "$@"
