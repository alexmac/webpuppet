all: build

clean:
	rm -rf out

build:
	docker build --progress=plain -t webpuppet -f webpuppet.dockerfile .

	docker run --rm -t -p 7777:7777/tcp -p 9000:9000/tcp \
    -v "${PWD}:/usr/local/puppet" \
    -v "${PWD}/nginx.conf:/usr/local/nginx/conf/nginx.conf" \
    webpuppet -- webpuppet/screenshot_page.ts \
    --url 'https://docs.github.com/en/rest/orgs/orgs?apiVersion=2022-11-28' \
    --out '/usr/local/puppet/out'

	docker run --rm -t -p 7777:7777/tcp -p 9000:9000/tcp \
    -v "${PWD}:/usr/local/puppet" \
    -v "${PWD}/nginx.conf:/usr/local/nginx/conf/nginx.conf" \
    webpuppet -- webpuppet/puppet_server.ts

.PHONY: all build
