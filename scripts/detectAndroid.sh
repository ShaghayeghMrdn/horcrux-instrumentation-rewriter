#!/bin/sh


sendText(){
    curl -X POST https://textbelt.com/text \
   --data-urlencode phone='7347735216' \
   --data-urlencode message='Android device disconnected' \
   -d key=textbelt
}

adbCmd=`adb devices | wc -l`

if [ $adbCmd -ne 3 ]; then 
    echo "Sending text"
    sendText
fi