var fs = require('fs')
var util = require('util')

signature = JSON.parse(fs.readFileSync(process.argv[2], "utf-8"))

stats = {}
	
function computeStats(sig){
	var numberOfFunctions = Object.keys(sig).length;
	var functionsWithReads = 0;
	var functionsWithWrites = 0;
	var functionsWithArguments = 0;
	var functionsWithReturn = 0;

	for (var node in sig){
		if (sig[node].reads)
			functionsWithReads++;
		if (sig[node].writes)
			functionsWithWrites++;
		if (sig[node]["arguments"] && sig[node]["arguments"].before)
			functionsWithArguments++;
		if (sig[node].returnValue)
			functionsWithReturn++;
	}
	
	stats["fWithReads"] = functionsWithReads/numberOfFunctions;
	stats["fWithWrites"] = functionsWithWrites/numberOfFunctions;
	stats["fWithArguments"] = functionsWithArguments/numberOfFunctions;
	stats["fWithReturns"] = functionsWithReturn/numberOfFunctions;
	stats["totalFuncs"] = numberOfFunctions;
}

computeStats(signature);
switch (process.argv[3]) {
	case 'r':
		console.log(stats["fWithReads"]);
		break;
	case 'w':
		console.log(stats["fWithWrites"]);
		break;
	case 'a':
		console.log(stats["fWithArguments"]);
		break;
	case 're':
		console.log(stats["fWithReturns"]);
		break;
}

