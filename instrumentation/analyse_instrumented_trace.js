/*
The following script will extract the functions declared and invoked from the instrumented javascript 
code and will analyse the global effects of each of these functions
*/

var MAXRESULT = 100000;

var tracer = __tracer

var functions = {};
var uniqueFunctions = [];
var callsites = {}
var ids = [];
var nodesHandle = tracer.trackNodes();
tracer.newNodes(nodesHandle).forEach(function (n) {
	if (n.type === 'function') {
		functions[n.id] = n;
		ids.push(n.id);
	} else if (n.type == 'callsite'){
		callsites[n.id] = n;	
	}
});

var logHandle = tracer.trackLogs({ids: ids});
var invocations = tracer.logDelta(logHandle, MAXRESULT);

console.log("Number of functions: " + Object.keys(functions).length);
console.log("Number of invocations: " + invocations.length);

var modifiedFunctionCounter = 0
importantFunctions = []
invocations.forEach(function(entry){
	if (Object.keys(entry.globalDelta) > 0){
		importantFunctions.push(entry);
	}
	if (uniqueFunctions.indexOf(entry.nodeId) < 0){
		uniqueFunctions.push(entry.nodeId);
	}
});
console.log("Total number of unqiue functions executed " + uniqueFunctions.length);
console.log("Total number of modified functions: " + importantFunctions.length);

var totalTimeSaved = 0
invocations.forEach(function(entry){
	if (Object.keys(entry.globalDelta)>0){
			totalTimeSaved += entry.duration;
	}
});
console.log("Total time that can be saved: " + totalTimeSaved);
