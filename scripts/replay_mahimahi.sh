
replay(){
	mm-webreplay $1 ./replay_helper.sh $2 &
	replay_pid=$!
	waitForNode
	waitForChrome
	kill -9 $replay_pid
}


waitForNode(){
	count=0
	while [[ $count != 2 ]]; do
		count=`ps aux | grep timeline-trace.js | wc | awk '{print $1}'` 
	done
}

waitForChrome(){
	count=0
	while [[ $count != 1 ]]; do
		count=`ps aux | grep chromium-browser | wc | awk '{print $1}'` 
		echo "current chrome instance count is" $count
		sleep 2;
	done
}



while IFS='' read -r line || [[ -n "$line" ]]; do
	echo "replaying url: " $line
	path=/tmp/`echo $line | cut -d'/' -f 3`
	replay $path $line;
done < "$1"
