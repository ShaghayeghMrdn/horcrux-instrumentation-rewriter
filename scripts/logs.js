var fs = require('fs')
var util = require('util')

var flag = process.argv[2];
var log1, log2;
try {
	log1 = JSON.parse(fs.readFileSync(process.argv[3], "utf-8"))
	log2 = JSON.parse(fs.readFileSync(process.argv[4],"utf-8"))

	if (!log1.length)
		process.stderr.write(util.format("Empty logs: " + process.argv[2] + "\n"));
	if (!log2.length)
		process.stderr.write("Empty logs: " + process.argv[2] + "\n");

} catch (e) {
	if (flag != "-l") {
		var val = e.toString().indexOf("unmodified") >= 0 ? true : false; 
		process.stderr.write(util.format("na", val && "na",!val && "na","\n"));
	}
	//process.exit();
}

function getConsoleLogs(logs1){
	var caches = []
	logs1.forEach((l)=>{
		if (l.type == "log")
			caches.push(l.args.map((e)=>{return e.value}));
	});
	if (!caches.length) return;
	var hits = caches.reduce((result, e)=>{
		if (String(e[0]).indexOf("hit")>=0) result.push(e[0]); return result;},[]);
	var misses  = caches.reduce((result, e)=>{
		if (String(e[0]).indexOf("miss")>=0) result.push(e); return result;
	});
	var numberOfFunctions;
	logs1.forEach((c)=>{
		var _fileName = process.argv[3].split('/');
		var fileName = _fileName[_fileName.length -2];
		if (c.type == "log" && String(c.args[0].value).indexOf("total") >=0 && c.stackTrace.callFrames[0].url.indexOf(fileName) >= 0)
			numberOfFunctions = c.args[0].value;
	});
	//numberOfFunctions.replace( /^\D+/g, '')
	console.log(hits.length + "," +  misses.length);
}
function getExceptionsDiff(){
	process.stdout.write(util.format(calculateErrors(log1) - matchingExceptions(log1, log2), calculateErrors(log1), calculateErrors(log2)));
}

function matchingExceptions(log1, log2){
	var exceptions1 = [];
	var exceptionCount = 0;
	log1.forEach((l) => {
		if (l.exceptionDetails){
			var exception = l.exceptionDetails.exception.description || "";
			exceptions1.push(exception.substr(0, exception.indexOf("at")));
		}
	});
	var exceptions2 = [];
	log2.forEach((l) => {
		if (l.exceptionDetails){
			var exception = l.exceptionDetails.exception.description || "";
			exceptions2.push(exception.substr(0, exception.indexOf("at")));
		}
	});
	//console.log(exceptions1);
	//console.log(exceptions2);
	for (var ex1 in exceptions1){
		for (var ex2 in exceptions2){
			if (exceptions1[ex1] == exceptions2[ex2]) {
				exceptionCount++;
				break;
			}
		}
	}
	//console.log(exceptions1);
	//console.log(exceptions2);
	return exceptionCount;

}

function calculateErrors(log){
	var count=0;
	log.forEach((l) => {
		if (l.exceptionDetails) {
			count++;
		}
	});
	return count;
}
		
if (flag != "-l" && flag !== "-e") { console.error("No flag provided: \nUsage: node logs.js <firstLog> <secondLog> <flag>"); process.exit(); }
if (flag == "-e") getExceptionsDiff();
else if (flag == "-l") {getConsoleLogs(log1);}
