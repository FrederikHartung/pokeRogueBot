#!/bin/bash

# param check
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 [0|1]"
    exit 1
fi

# URL of the api
URL="http://localhost:8080/api/start"

# parse input to boolean
if [ "$1" -eq 1 ]; then
    ACTIVE="true"
elif [ "$1" -eq 0 ]; then
    ACTIVE="false"
else
    echo "Invalid argument. Use 0 or 1."
    exit 1
fi

# do a post request to the api
curl -X POST "${URL}" -d "active=${ACTIVE}" -H "Content-Type: application/x-www-form-urlencoded"

# check if the request was successful
if [ $? -eq 0 ]; then
    echo "Request successful"
else
    echo "Request failed"
    exit 1
fi
