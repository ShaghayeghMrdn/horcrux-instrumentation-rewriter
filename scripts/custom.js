

/*
This file contains code snippet which would be executed using the runtime
interface
It will also contain the corresponding handler

*/

var fs = require('fs');


var getCustomStat = async function(fetchCommand, Runtime, outputFile){
    var _result = await Runtime.evaluate({expression : fetchCommand, returnByValue: true});
    var result = _result.result;

    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log("Done fetching cache statistics");

}
var getCacheStats = async function(Runtime, outDir){
    var fetchCommand = '__tracer.getCacheStats()';
    var _cacheStats = await Runtime.evaluate({expression : fetchCommand, returnByValue: true});
    var cacheStats = _cacheStats.result;

    fs.writeFileSync(outDir +"/cacheStats", JSON.stringify(cacheStats, null, 2));
    console.log("Done fetching cache statistics");
}

var getNonCacheable = async function(Runtime, outDir){
    var fetchCommand = '__tracer.getNonCacheableFunctions()';
    var _cacheStats = await Runtime.evaluate({expression : fetchCommand, returnByValue: true});
    var cacheStats = _cacheStats.result;

    fs.writeFileSync(outDir +"/noncache", JSON.stringify(cacheStats, null, 2));
    console.log("Done fetching non-cache statistics");
}

var getFunctionStats = async function(Runtime, outDir) {
    var stats = {};
    var fetchCommand = '__tracer.getFunctionStats()';
    var _fnStats = await Runtime.evaluate({expression : fetchCommand, returnByValue: true});
    stats['fnStats'] = _fnStats.result;

    const reducer = (accumulator, currentValue) => accumulator + currentValue;
    fetchCommand = `Object.values(__tracer.getInvocations()).reduce(${reducer})`
    var _invocations = await Runtime.evaluate({expression : fetchCommand, returnByValue: true});
    stats['invocations'] = _invocations.result;

    fs.writeFileSync(outDir +"/fnStats", JSON.stringify(stats, null, 2));
    console.log("Done fetching function statistics");    
    // fetchCommand = '__tracer.geInvocations()';
    // var _fnStats = await Runtime.evaluate({expression : fetchCommand, returnByValue: true});

}

var getInvocationProperties = async function(Runtime, outFile, fetchCommand){
    var _fnStats = await Runtime.evaluate({expression : fetchCommand, returnByValue: true});
    var stats = _fnStats.result;

    fs.writeFileSync(outFile, JSON.stringify(stats, null, 2));
    console.log("Done fetching Invocation properties");    
}

function escapeBackSlash(str){
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\^\$\|\'\_]/g, "\\$&");
}

var runPostLoadScripts = async function(Runtime){
    //process final signature
    var processCommand = '__tracer.processFinalSignature()'
    var cmdOutput = await Runtime.evaluate({expression : processCommand, returnByValue: true});

    if (cmdOutput.exceptionDetails){
        console.error("Error while processing final signature: " + 
            cmdOutput.exceptionDetails.exception.description);
        // errors.push(outDir);
        return cmdOutput.exceptionDetails.exception.description;
    }

    //stringify the final signature
    processCommand = '__tracer.storeSignature()'
    var cmdOutput = await Runtime.evaluate({expression : processCommand, returnByValue: true});

    if (cmdOutput.exceptionDetails){
        console.error("Error while processing final signature: " + 
            cmdOutput.exceptionDetails.exception.description);
        // errors.push(outDir);
        return cmdOutput.exceptionDetails.exception.description;
    }

    console.log("successfully ran the post load scripts");

    return 0;
}

var getProcessedSignature = async function(Runtime, outDir){
    

    var keys = [];
    var errors = [];
    var processedSignature = {};
    // var expression = '__tracer.getInvocations();';
    var expression = 'Object.keys(__tracer.getCustomCache())';
    var cachedSignature;

    var _query = await Runtime.evaluate({expression:expression, returnByValue: true});
    if (_query.code) {
        console.error("Error while fetching processed Signature length");
        errors.push(outDir);
        return;
    }

    keys = _query.result.value;
   
   if (!keys.length) {
    fs.writeFileSync(outDir + "/Signature", JSON.stringify({}, null, 4));
    console.log("No entry in processed Signature");
    return;
   }

    console.log("Starting to extract custom data of length "  + keys.length );

    for (var index in keys){
        var key = keys[index];
        key  = escapeBackSlash(key);
        var _query;
        try {
           _query = await Runtime.evaluate({expression:`__tracer.getCustomCache()['${key}']`, returnByValue: true});
        } catch (e) {
            console.log("error while fetching key " + key);
            continue;
        }

        if (_query.code) {
            errors.push(_query.exceptionDetails);
            console.log("error while fetching key " + key);
            return;
        }

        processedSignature[key] = _query["result"]["value"];

        // if (processedSignature[key] && processedSignature[key].reads instanceof Set)
        //     processedSignature[key].reads = [...processedSignature[key].reads]
        // if (processedSignature[key] && processedSignature[key].writes instanceof Set)
        //     processedSignature[key].writes = [...processedSignature[key].writes]

        if ( (index/keys.length*100) % 10 == 0) {
            console.log(index/keys.length*100, "% done...");
        }

    }

    fs.writeFileSync(outDir+ "/Signature", JSON.stringify(processedSignature, null, 4));
    fs.writeFileSync(outDir + "/errors", JSON.stringify(errors));

}

var roughSizeOfObject = function( object ) {

    var objectList = [];
    var stack = [ object ];
    var bytes = 0;

    while ( stack.length ) {
        var value = stack.pop();

        if ( typeof value === 'boolean' ) {
            bytes += 4;
        }
        else if ( typeof value === 'string' ) {
            bytes += value.length * 2;
        }
        else if ( typeof value === 'number' ) {
            bytes += 8;
        }
        else if
        (
            typeof value === 'object'
            && objectList.indexOf( value ) === -1
        )
        {
            objectList.push( value );

            for( var i in value ) {
                stack.push( value[ i ] );
            }
        }
    }
    return bytes;
}
var getCacheSize = async function(Runtime, outDir) {
    var fetchCommand = `
        var roughSizeOfObject = ${roughSizeOfObject};
        roughSizeOfObject(__tracer.getProcessedSignature());
    `
    var _cacheSize = await Runtime.evaluate({expression : fetchCommand, returnByValue: true});
    var cacheSize = _cacheSize.result ? _cacheSize.result.value : 0;
    fs.writeFileSync(outDir + "/cacheSize_orig", JSON.stringify(cacheSize));
    fetchCommand = "roughSizeOfObject(__tracer.getStoredSignature());"
    var _cacheSize = await Runtime.evaluate({expression : fetchCommand, returnByValue: true});
    var cacheSize = _cacheSize.result ? _cacheSize.result.value : 0;
     fs.writeFileSync(outDir + "/cacheSize_proc", JSON.stringify(cacheSize));
    console.log("Done fetching the cache size");

}


module.exports = {
    getCacheStats : getCacheStats,
    getCacheSize : getCacheSize,
    getFunctionStats: getFunctionStats,
    getCustomStat: getCustomStat,
    getInvocationProperties: getInvocationProperties,
    getProcessedSignature : getProcessedSignature,
    runPostLoadScripts: runPostLoadScripts 
}