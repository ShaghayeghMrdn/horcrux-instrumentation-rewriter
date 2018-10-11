// pass path to the files as arguments
var fs = require('fs')

OUTFILE = "out"
invocation1 = JSON.parse(fs.readFileSync(process.argv[2],"utf-8"))
invocation2 = JSON.parse(fs.readFileSync(process.argv[3], "utf-8"))

total = Object.keys(invocation2).length
//console.log("plt time is", process.argv[5]);
//console.log("Total number of invocations is", total);
matches = 0
total_notc = 0
matches_time = 0
for (var key2 in invocation2){
	if (invocation2[key2].length != 0) total_notc+=1 
	for (var key1 in invocation1){
		if (key2 == key1 && invocation2[key2].length !=0 && invocation1[key1].length != 0 && JSON.stringify(invocation2[key2][0]) === JSON.stringify(invocation1[key1][0])){
			matches +=1;
			if (process.argv[4] == "-t"){
				//console.log(invocation2[key2]);
				matches_time += (invocation2[key2][1] + invocation1[key1][1])/2;
			}
			break;
		}
	}
}
//console.log(total);
//fs.writeFileSync(OUTFILE, matches*1.0/total);
if (process.argv[4] == "-p") console.log(matches*1.0/total_notc);
else console.log(matches_time/Number(process.argv[5]));
