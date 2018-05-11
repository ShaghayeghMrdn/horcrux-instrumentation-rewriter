
#chromium-browser --remote-debugging-port=9222 --ignore-certificate-errors --user-data-dir=/tmp/nonexistent$(date +%s%N) &> /dev/null &
#chrome_pid=$!
#sleep 2
node inspectChrome.js "$1"
