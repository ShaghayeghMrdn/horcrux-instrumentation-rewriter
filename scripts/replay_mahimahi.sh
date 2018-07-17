# $1 -> path to the list of pages
# $2 -> path to the recorded pages
# $3 -> path to the output directory

replay(){
	mkdir -p $3
	mm-webreplay $1 node inspectChrome.js -u $2 -c -l -o $3 &
	replay_pid=$!
	#waitForNode
	sleep 1;
	waitForNode
	kill -9 $replay_pid
}


waitForNode(){
	count=0
	while [[ $count != 1 ]]; do
		count=`ps aux | grep node | wc | awk '{print $1}'` 
		echo "Current count is", $count
		sleep 2
	done
}


waitForChrome(){
	count=0
	echo "waiting"
	curr_time=`date +'%s'`
	while [[  $count != 3 ]]; do
		count=`ps aux | grep chromium-browser | wc | awk '{print $1}'`
		echo "current count is" $count
		n_time=`date +'%s'`
		elapsed=`expr $n_time - $curr_time`
		echo "Elapsed time since: ", $elapsed
		if [ $elapsed -gt 30 ]; then
			echo "TIMED OUT..."
			ps aux | grep 9222 | awk '{print $2}' | xargs kill -9
		fi
		sleep 1;
	done
}

while IFS='' read -r line || [[ -n "$line" ]]; do
	echo "replaying url: " $line
	url=`echo $line | cut -d'/' -f 3`
	path="$2"/"$url"
	replay $path $line $3/"$url";
	sleep 3
done < "$1"
