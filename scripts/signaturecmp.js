//This module takes as input two files containing
//stringified signatures
//it compares the two signature  files and reports on matching signature percentage
var fs = require('fs')
var util = require('util')

signature1 = JSON.parse(fs.readFileSync(process.argv[2], "utf-8"))
signature2 = JSON.parse(fs.readFileSync(process.argv[3], "utf-8"))


//Iterate through the second signature object and finding corresponding matches
matchCount = 0;
function compare(sig1, sig2){
	for (var node2 in sig2){
		for(var node1 in sig1){
			if (node1 == node2 && JSON.stringify(sig2[node2]) == JSON.stringify(sig1[node1])) {
				matchCount++;
				break;
			}
			
		}
	}

	process.stdout.write(util.format(matchCount/Object.keys(sig2).length));
}

compare(signature1, signature2);


