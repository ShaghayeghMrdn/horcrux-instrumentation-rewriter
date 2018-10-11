var fs = require('fs')

record = JSON.parse(fs.readFileSync(process.argv[2], "utf-8"))
replay = JSON.parse(fs.readFileSync(process.argv[3],"utf-8"))
unmatch_replay = []
replay.forEach(function(site1){
	found = false;
	record.forEach(function(site2){
		if (site1.request.url == site2.request.url)
			found = true
	});
	if (!found)
		unmatch_replay.push(site1.request.url);
});
//console.log(unmatch_replay);
console.log(unmatch_replay.length*100/replay.length);
console.log(record.length, replay.length);

