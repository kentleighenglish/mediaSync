#!/usr/bin/env bash

source ./.env

if [ -f /.dockerenv ]; then
	apk add --no-cache ffmpeg;
fi;

if [ $MEDIA_TYPE = 'films' ]; then
	echo "Starting transmission-daemon"
	case "$(pidof transmission-daemon | wc -w)" in
		0)	transmission-daemon
			;;
		1)
			echo "transmission-daemon already running"
			;;
		*)
			echo "Killing transmission-daemon duplicates"
			kill $(pidof transmission-daemon | awk '{print $1}')
			;;
	esac;
	echo "";
fi

if ! command -v ffmpeg &> /dev/null
then
    echo "ffmpeg is required, please install it"
    exit
fi

node index;
