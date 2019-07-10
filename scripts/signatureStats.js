var fs = require('fs')
var util = require('util')
var program = require('commander');


program
	.option('-i, --input [input]', 'input signature file')
	.option('--verbose','verbose output')
	.parse(process.argv);
	

function parseSig(sig){
	var parsed={};
	Object.keys(sig).forEach((key)=>{
		parsed[key] = JSON.parse(sig[key]);
	})
	return parsed;
}

function analyseState(stateKeys, sig){
	var empty = [];
	Object.keys(sig).forEach((nodeId)=>{
		if (typeof sig[nodeId] == "string") return;
		if (stateKeys.filter(e=>sig[nodeId][e].length>0).length == 0)
			empty.push(nodeId);
	})
	return empty;
}
function computeStats(sig){
	var processed = parseSig(sig);

	var readKeys = Object.keys(processed[Object.keys(processed)[0]]).filter(e=>e.indexOf("read")>=0);
	var writeKeys = Object.keys(processed[Object.keys(processed)[0]]).filter(e=>e.indexOf("read")>=0);
	
	_emptyReads = analyseState(readKeys, processed);
	_emptyWrites = analyseState(writeKeys, processed);

	process.stdout.write(util.format(_emptyWrites.length, _emptyReads.length, Object.keys(processed).length,));
	if (program.verbose) {
		console.log("reads:" + JSON.stringify(_emptyReads));
		console.log("writes:" + JSON.stringify(_emptyWrites));
	}

}
signature = JSON.parse(fs.readFileSync(program.input, "utf-8"))
computeStats(signature);

