var fs = require('fs')
var util = require('util')

log1 = JSON.parse(fs.readFileSync(process.argv[2], "utf-8"))
log2 = JSON.parse(fs.readFileSync(process.argv[3],"utf-8"))

process.stdout.write(util.format(calculateErros(log1) - calculateErros(log2), log1.length, log2.length));


function calculateErros(log){
	var count=0;
	log.forEach((l) => {
		if (l.exceptionDetails)
			count++;
	});
	return count;
}
		

