#!/bin/bash -xe 

mkdir -p out

ENDPOINT=http://localhost:7777

SESSION=$(curl -X POST $ENDPOINT/session/create)

curl -v $ENDPOINT/session/$SESSION/goto \
  --header "Content-Type: application/json" \
  --request PUT \
  --data '{"url":"https://www.britishmuseumshoponline.org"}'

curl -v $ENDPOINT/session/$SESSION/screencast/start \
  --header "Content-Type: application/json" \
  --request PUT \
  --data '{}'

sleep 2

curl -v $ENDPOINT/session/$SESSION/content \
  --header "Content-Type: application/json" \
  --request PUT \
  --data '{}' > out/p1.html

curl -v $ENDPOINT/session/$SESSION/tap \
  --header "Content-Type: application/json" \
  --request PUT \
  --data '{"selector": "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll"}'
