#!/bin/sh

if [ -f /.dockerenv ]; then
	echo "Installing ffmpeg";
	apk add --no-cache ffmpeg;
	echo "Installing transmission";
	apk add --no-cache transmission-daemon
	echo "Installing transmission-cli";
	apk add --no-cache transmission-cli
else
	source ./.env;
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

if ! command -v transmission-remote &> /dev/null
then
    echo "transmission-remote is required, please install it"
    exit
fi

node index;
