

/*
This file contains code snippet which would be executed using the runtime
interface
It will also contain the corresponding handler

*/

var fs = require('fs');

var getCacheStats = async function(Runtime, outDir){
    var fetchCommand = '__tracer.getCacheStats()';
    var _cacheStats = await Runtime.evaluate({expression : fetchCommand, returnByValue: true});
    var cacheStats = _cacheStats.result;

    fs.writeFileSync(outDir +"/cacheStats", JSON.stringify(cacheStats, null, 2));
    console.log("Done fetching cache statistics");
}


module.exports = {
    getCacheStats : getCacheStats
}