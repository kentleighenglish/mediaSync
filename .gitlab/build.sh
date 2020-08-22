#!/bin/bash

tag=$CI_BUILD_REF_SLUG

repo="media-sync"

# Get buildx
mkdir -p $HOME/.docker/cli-plugins/

wget -O $HOME/.docker/cli-plugins/docker-buildx https://github.com/docker/buildx/releases/download/v0.2.0/buildx-v0.2.0.linux-arm-v7
chmod a+x $HOME/.docker/cli-plugins/docker-buildx
echo -e "{\n  \"experimental\": \"enabled\" }" | tee $HOME/.docker/config.json

#export DOCKER_CLI_EXPERIMENTAL=enabled

# Start up QEMU to allow arm7l emulation
docker run --rm --privileged multiarch/qemu-user-static --reset -p yes
#docker run --rm --privileged docker/binfmt:820fdd95a9972a5308930a2bdfb8573dd4447ad3

docker buildx ls

buildImage()
{
	name=$@
	if [ "$tag" != 'master' ]; then
		if [ "$tag" != '' ]; then
			name="$name:$tag"
		fi
	fi

	echo "Logging in"
	docker login rg.nl-ams.scw.cloud/ikenga -u $ACCESS_TOKEN -p $SECRET_TOKEN

	echo "Building $name";
	docker buildx build  --platform=linux/arm/v7 --target=$@ --tag=$name .;

	echo "Tagging..."
	docker tag $name rg.nl-ams.scw.cloud/ikenga/$name

	echo "Pushing..."
	docker push rg.nl-ams.scw.cloud/ikenga/$name
	echo;
}

buildImage $repo
