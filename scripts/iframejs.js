var fs  = require('fs')

log = JSON.parse(fs.readFileSync(process.argv[2], "utf-8"));

var myre = /.*tracer.* is not defined/g
log.forEach((l)=>{
	if (l.exceptionDetails && myre.exec(l.exceptionDetails.exception.description))
		console.log(l.exceptionDetails.url);
});
