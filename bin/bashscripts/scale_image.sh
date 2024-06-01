#!/bin/bash

if [ $# -eq 0 ]; then
    echo "Please provide the path to an image as a parameter."
    exit 1
fi

IMAGE_PATH=$1

if [ ! -f "$IMAGE_PATH" ]; then
    echo "The file $IMAGE_PATH does not exist."
    exit 1
fi

OUTPUT_PATH="${IMAGE_PATH%.*}_scaled.${IMAGE_PATH##*.}"

ORIGINAL_HEIGHT=$(sips -g pixelHeight "$IMAGE_PATH" | tail -n 1 | awk '{print $2}')
NEW_HEIGHT=$((ORIGINAL_HEIGHT / 2))

sips -Z "$NEW_HEIGHT" "$IMAGE_PATH" --out "$OUTPUT_PATH"

echo "The image has been successfully scaled to $OUTPUT_PATH."
