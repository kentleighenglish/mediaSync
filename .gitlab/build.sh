#!/bin/bash

tag=$CI_BUILD_REF_SLUG

repo="media-sync"

# Put docker in experimental mode
export DOCKER_CLI_EXPERIMENTAL=enabled

# Start up QEMU to allow arm7l emulation
docker run --privileged --rm docker/binfmt:a7996909642ee92942dcd6cff44b9b95f08dad64

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
	docker buildx build  --platform linux/arm/v7 --target=$@ --tag=$name .;

	echo "Tagging..."
	docker tag $name rg.nl-ams.scw.cloud/ikenga/$name

	echo "Pushing..."
	docker push rg.nl-ams.scw.cloud/ikenga/$name
	echo;
}

buildImage $repo
