# $1 -> path to the list of pages
# $2 -> path to the recorded pages
# $3 -> path to the output directory
# $4 -> port for chrome

replay(){
	mkdir -p $3
	#mm-webreplay $1 node inspectChrome.js -u $2 -l --coverage -t -j --log -o $3 -p $4 &> replayOutput/`echo $2 | cut -d '/' -f3` &
	#mm-webreplay $1 node inspectChrome.js -u $2 -l --log -o $3 -p $4 &
    mm-webreplay $1 node inspectChrome.js -u $2 -l -t -j --log -o $3 -p $4 &> results/replayOutput/`echo $2 | cut -d '/' -f3` &
	replay_pid=$!
	#waitForNode
	waitForNode $4
	echo "Done waiting"
	sleep 1
	ps aux | grep replayshell | awk '{print $2}' | xargs kill -9
	# kill -9 $replay_pid
}


# The comparison of count variable is with 2, because for some reason there is an additional 
# process started by root on the same node port
waitForNode(){
	count=0
	start_time=`date +'%s'`
	while [[ $count != 1 ]]; do
		count=`ps aux | grep $1 | wc | awk '{print $1}'` 
		echo "Current count is", $count
		curr_time=`date +'%s'`
		elapsed=`expr $curr_time - $start_time`
		echo $elapsed
		# if [ $elapsed -gt 120 ]; then
		# 	echo "TIMED OUT..."
		# 	ps aux | grep $1 | awk '{print $2}' | xargs kill -9
		# fi
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
	replay $path $line $3/"$url" $4;
	sleep 2
done < "$1"
